import { Stroke, StrokeTool, StrokeLayer, LayerObject, generateId } from './types';
import { HistoryManager } from './HistoryManager';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class DrawManager {
  private permanentStrokes: Map<string, Stroke> = new Map();
  private tempStrokes: Map<string, Stroke> = new Map();
  private laserStrokes: Map<string, Stroke> = new Map();

  // per-stroke SVG элементы постоянных штрихов (живут в worldLayer, порядок по z-index)
  private strokeElements: Map<string, SVGSVGElement> = new Map();

  private currentStroke: Stroke | null = null;

  private worldLayer: HTMLElement;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  private history: HistoryManager;

  onChange: (() => void) | null = null;
  /** Внешний аллокатор единого z-порядка. */
  zAlloc: (() => number) | null = null;

  constructor(
    worldLayer: HTMLElement,
    tempCanvas: HTMLCanvasElement,
    history: HistoryManager,
  ) {
    this.worldLayer = worldLayer;
    this.tempCanvas = tempCanvas;
    this.tempCtx = tempCanvas.getContext('2d')!;
    this.history = history;
  }

  startStroke(tool: StrokeTool, color: string, width: number, opacity = 1, smoothing = 0.5): void {
    const layer: StrokeLayer = tool === 'laser' ? 'laser' : 'permanent';
    const now = Date.now();
    this.currentStroke = {
      id: generateId(),
      type: 'stroke',
      tool,
      layer,
      points: [],
      color,
      width,
      opacity,
      smoothing,
      createdAt: now,
      pointTimestamps: [],
    };

    // лазер регистрируем сразу, чтобы LaserRenderer мог рисовать на лету
    if (tool === 'laser') {
      this.laserStrokes.set(this.currentStroke.id, this.currentStroke);
    }
  }

  addPoint(x: number, y: number): void {
    if (!this.currentStroke) return;
    this.currentStroke.points.push([x, y]);

    if (this.currentStroke.pointTimestamps) {
      this.currentStroke.pointTimestamps.push(Date.now());
    }
    // превью рисуется в renderWithTransform (render loop)
  }

  endStroke(): Stroke | null {
    if (!this.currentStroke) return null;
    const stroke = this.currentStroke;
    this.currentStroke = null;

    if (stroke.points.length < 2) {
      // чистим лазерный штрих если он завис с 1 точкой
      if (stroke.layer === 'laser') {
        this.laserStrokes.delete(stroke.id);
      }
      return null;
    }

    if (stroke.tool === 'eraser') {
      this._eraseAt(stroke);
      return null;
    }

    if (stroke.layer === 'laser') {
      return stroke;
    }

    stroke.zIndex = this.zAlloc ? this.zAlloc() : (this.permanentStrokes.size + 1);
    stroke.name = stroke.tool === 'marker' ? 'Маркер' : 'Карандаш';
    stroke.hidden = false;

    this.permanentStrokes.set(stroke.id, stroke);
    this._renderStrokeEl(stroke);

    this.history.push({
      type: 'draw-stroke',
      undo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._removeStrokeEl(stroke.id);
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._renderStrokeEl(stroke);
        this._emitChange();
      },
    });

    this._emitChange();
    return stroke;
  }

  addTempStroke(stroke: Stroke): void {
    stroke.layer = 'temp';
    this.tempStrokes.set(stroke.id, stroke);
  }

  clearTemp(): void {
    this.tempStrokes.clear();
    this._clearCanvas(this.tempCtx);
  }

  deleteStroke(id: string): void {
    const stroke = this.permanentStrokes.get(id);
    if (!stroke) return;
    this.permanentStrokes.delete(id);
    this._removeStrokeEl(id);
    this.history.push({
      type: 'delete-stroke',
      undo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._renderStrokeEl(stroke);
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._removeStrokeEl(stroke.id);
        this._emitChange();
      },
    });
    this._emitChange();
  }

  getLaserStrokes(): Map<string, Stroke> {
    return this.laserStrokes;
  }

  removeLaserStroke(id: string): void {
    this.laserStrokes.delete(id);
  }

  // ─── Layer API ──────────────────────────────────────────────
  setZIndex(id: string, z: number): void {
    const s = this.permanentStrokes.get(id);
    if (!s) return;
    s.zIndex = z;
    const el = this.strokeElements.get(id);
    if (el) el.style.zIndex = String(z);
    this._emitChange();
  }

  setHidden(id: string, hidden: boolean): void {
    const s = this.permanentStrokes.get(id);
    if (!s) return;
    s.hidden = hidden;
    const el = this.strokeElements.get(id);
    if (el) el.style.display = hidden ? 'none' : '';
    this._emitChange();
  }

  setName(id: string, name: string): void {
    const s = this.permanentStrokes.get(id);
    if (!s) return;
    s.name = name;
    this._emitChange();
  }

  getLayerObjects(): LayerObject[] {
    return Array.from(this.permanentStrokes.values()).map((s) => ({
      id: s.id,
      kind: 'stroke' as const,
      name: s.name ?? (s.tool === 'marker' ? 'Маркер' : 'Карандаш'),
      zIndex: s.zIndex ?? 0,
      hidden: !!s.hidden,
      subtype: s.tool,
    }));
  }

  serialise(includeTempStrokes: boolean): Stroke[] {
    const arr: Stroke[] = Array.from(this.permanentStrokes.values());
    if (includeTempStrokes) {
      arr.push(...Array.from(this.tempStrokes.values()));
    }
    return arr;
  }

  deserialise(data: Stroke[]): void {
    this.permanentStrokes.clear();
    this.tempStrokes.clear();
    this._clearStrokeEls();
    // у старых досок штрихи без zIndex рисовались поверх нод — держим их сверху
    let fallbackZ = 1;
    for (const s of data) {
      if (s.layer === 'temp') {
        this.tempStrokes.set(s.id, s);
      } else {
        if (s.zIndex === undefined) s.zIndex = 1_000_000 + fallbackZ++;
        if (s.name === undefined) s.name = s.tool === 'marker' ? 'Маркер' : 'Карандаш';
        if (s.hidden === undefined) s.hidden = false;
        this.permanentStrokes.set(s.id, s);
        this._renderStrokeEl(s);
      }
    }
    this._redrawTemp();
  }

  resize(w: number, h: number): void {
    this.tempCanvas.width = w;
    this.tempCanvas.height = h;
    this._redrawTemp();
  }

  // рендерит только превью текущего штриха и сохранённые temp-штрихи на экранном tempCanvas
  renderWithTransform(offsetX: number, offsetY: number, zoom: number): void {
    this._clearCanvas(this.tempCtx);
    this.tempCtx.save();
    this.tempCtx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    for (const s of this.tempStrokes.values()) {
      this._drawStrokeRaw(this.tempCtx, s);
    }
    if (this.currentStroke && this.currentStroke.layer !== 'laser') {
      this._drawStrokeRaw(this.tempCtx, this.currentStroke);
    }
    this.tempCtx.restore();
  }

  // ─── per-stroke SVG ─────────────────────────────────────────

  private _renderStrokeEl(stroke: Stroke): void {
    let svg = this.strokeElements.get(stroke.id);
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      svg.classList.add('ib-stroke');
      svg.dataset.strokeId = stroke.id;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
      this.worldLayer.appendChild(svg);
      this.strokeElements.set(stroke.id, svg);
    }
    this._updateStrokeEl(stroke);
  }

  private _updateStrokeEl(stroke: Stroke): void {
    const svg = this.strokeElements.get(stroke.id);
    if (!svg) return;
    const path = svg.querySelector('path');
    if (!path) return;

    const isMarker = stroke.tool === 'marker';
    path.setAttribute('d', this._strokePathD(stroke));
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', String(isMarker ? stroke.width * 3 : stroke.width));
    path.setAttribute('opacity', String(isMarker ? stroke.opacity * 0.45 : stroke.opacity));

    svg.style.zIndex = String(stroke.zIndex ?? 0);
    svg.style.display = stroke.hidden ? 'none' : '';
  }

  private _removeStrokeEl(id: string): void {
    const el = this.strokeElements.get(id);
    if (el) {
      el.remove();
      this.strokeElements.delete(id);
    }
  }

  private _clearStrokeEls(): void {
    for (const el of this.strokeElements.values()) el.remove();
    this.strokeElements.clear();
  }

  // строит SVG path d с тем же квадратичным сглаживанием, что и canvas-рендер
  private _strokePathD(stroke: Stroke): string {
    const pts = stroke.points;
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      if (stroke.smoothing > 0 && i < pts.length - 1) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        d += ` Q${pts[i][0]},${pts[i][1]} ${xc},${yc}`;
      } else {
        d += ` L${pts[i][0]},${pts[i][1]}`;
      }
    }
    return d;
  }

  private _redrawTemp(): void {
    this._clearCanvas(this.tempCtx);
    for (const s of this.tempStrokes.values()) {
      this._drawStrokeOnCanvas(this.tempCtx, s);
    }
  }

  private _drawStrokeOnCanvas(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    ctx.save();
    this._drawStrokeRaw(ctx, stroke);
    ctx.restore();
  }

  // рисует штрих на canvas (для temp-превью); трансформ задаёт вызывающий
  private _drawStrokeRaw(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    if (stroke.points.length < 2) return;
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'marker') {
      ctx.globalAlpha = stroke.opacity * 0.45;
      ctx.lineWidth = stroke.width * 3;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
    for (let i = 1; i < stroke.points.length; i++) {
      if (stroke.smoothing > 0 && i < stroke.points.length - 1) {
        const xc = (stroke.points[i][0] + stroke.points[i + 1][0]) / 2;
        const yc = (stroke.points[i][1] + stroke.points[i + 1][1]) / 2;
        ctx.quadraticCurveTo(stroke.points[i][0], stroke.points[i][1], xc, yc);
      } else {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private _clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // ластик — удаляет штрихи рядом с путём ластика
  private _eraseAt(eraserStroke: Stroke): void {
    const pts = eraserStroke.points;
    const toDelete: string[] = [];

    for (const [id, s] of this.permanentStrokes) {
      for (const ep of pts) {
        for (const sp of s.points) {
          const dist = Math.hypot(ep[0] - sp[0], ep[1] - sp[1]);
          if (dist < eraserStroke.width + s.width) {
            toDelete.push(id);
            break;
          }
        }
        if (toDelete[toDelete.length - 1] === id) break;
      }
    }

    for (const id of toDelete) {
      this.deleteStroke(id);
    }
  }

  private _emitChange(): void {
    if (this.onChange) this.onChange();
  }
}
