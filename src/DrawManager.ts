import { Stroke, StrokeTool, StrokeLayer, generateId } from './types';
import { HistoryManager } from './HistoryManager';

export class DrawManager {
  private permanentStrokes: Map<string, Stroke> = new Map();
  private tempStrokes: Map<string, Stroke> = new Map();
  private laserStrokes: Map<string, Stroke> = new Map();

  private currentStroke: Stroke | null = null;

  private permanentCanvas: HTMLCanvasElement;
  private permanentCtx: CanvasRenderingContext2D;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  private history: HistoryManager;

  onChange: (() => void) | null = null;

  constructor(
    permanentCanvas: HTMLCanvasElement,
    tempCanvas: HTMLCanvasElement,
    history: HistoryManager,
  ) {
    this.permanentCanvas = permanentCanvas;
    this.permanentCtx = permanentCanvas.getContext('2d')!;
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

    // превью при рисовании
    if (this.currentStroke.layer === 'permanent') {
      this._drawStrokeOnCanvas(this.tempCtx, this.currentStroke);
    }
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

    this.permanentStrokes.set(stroke.id, stroke);
    this._redrawPermanent();
    this._clearCanvas(this.tempCtx);

    this.history.push({
      type: 'draw-stroke',
      undo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._redrawPermanent();
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._redrawPermanent();
        this._emitChange();
      },
    });

    this._emitChange();
    return stroke;
  }

  addTempStroke(stroke: Stroke): void {
    stroke.layer = 'temp';
    this.tempStrokes.set(stroke.id, stroke);
    this._redrawTemp();
  }

  clearTemp(): void {
    this.tempStrokes.clear();
    this._clearCanvas(this.tempCtx);
  }

  deleteStroke(id: string): void {
    const stroke = this.permanentStrokes.get(id);
    if (!stroke) return;
    this.permanentStrokes.delete(id);
    this._redrawPermanent();
    this.history.push({
      type: 'delete-stroke',
      undo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._redrawPermanent();
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._redrawPermanent();
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
    for (const s of data) {
      if (s.layer === 'temp') {
        this.tempStrokes.set(s.id, s);
      } else {
        this.permanentStrokes.set(s.id, s);
      }
    }
    this._redrawPermanent();
    this._redrawTemp();
  }

  resize(w: number, h: number): void {
    this.permanentCanvas.width = w;
    this.permanentCanvas.height = h;
    this.tempCanvas.width = w;
    this.tempCanvas.height = h;
    this._redrawPermanent();
    this._redrawTemp();
  }

  renderWithTransform(offsetX: number, offsetY: number, zoom: number): void {
    this._clearCanvas(this.permanentCtx);
    this.permanentCtx.save();
    this.permanentCtx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    for (const s of this.permanentStrokes.values()) {
      this._drawStrokeRaw(this.permanentCtx, s);
    }
    this.permanentCtx.restore();

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

  private _redrawPermanent(): void {
    this._clearCanvas(this.permanentCtx);
    for (const s of this.permanentStrokes.values()) {
      this._drawStrokeOnCanvas(this.permanentCtx, s);
    }
  }

  private _redrawTemp(): void {
    this._clearCanvas(this.tempCtx);
    for (const s of this.tempStrokes.values()) {
      this._drawStrokeOnCanvas(this.tempCtx, s);
    }
  }

  private _drawStrokeOnCanvas(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    if (stroke.points.length < 2) return;
    ctx.save();
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
    ctx.restore();
  }

  // то же что _drawStrokeOnCanvas, но без save/restore — трансформ задаёт вызывающий
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
