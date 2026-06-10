import { Stroke, LaserParams } from './types';
import { DrawManager } from './DrawManager';

export class LaserRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawManager: DrawManager;
  private params: LaserParams;
  private animationId: number | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement, drawManager: DrawManager, params: LaserParams) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.drawManager = drawManager;
    this.params = { ...params };
  }

  setParams(params: Partial<LaserParams>): void {
    Object.assign(this.params, params);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop(): void {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  renderWithTransform(offsetX: number, offsetY: number, zoom: number): void {
    const now = Date.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);

    const strokes = this.drawManager.getLaserStrokes();
    const expired: string[] = [];

    for (const [id, stroke] of strokes) {
      const isFullyExpired = this._drawLaserStroke(stroke, now);
      if (isFullyExpired) {
        expired.push(id);
      }
    }

    this.ctx.restore();

    for (const id of expired) {
      this.drawManager.removeLaserStroke(id);
    }
  }

  private _loop = (): void => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this._loop);
  };

  // рисует один лазерный штрих с затуханием от хвоста к голове
  // возвращает true если штрих полностью истёк
  private _drawLaserStroke(stroke: Stroke, now: number): boolean {
    const pts = stroke.points;
    // мало точек — ещё рисуется, не удаляем
    if (pts.length < 2) return false;

    const timestamps = stroke.pointTimestamps;
    if (!timestamps || timestamps.length < 2) {
      return this._drawLaserStrokeFallback(stroke, now);
    }

    const ctx = this.ctx;
    const duration = this.params.duration;
    let allExpired = true;

    // ищем первый видимый сегмент
    let firstVisible = -1;
    for (let i = 0; i < pts.length; i++) {
      const age = now - timestamps[i];
      if (this._computeAlpha(age, duration) > 0) {
        firstVisible = i;
        break;
      }
    }
    if (firstVisible < 0) return true;

    for (let i = Math.max(firstVisible, 1); i < pts.length; i++) {
      const segAge = now - timestamps[i - 1];
      const alpha = this._computeAlpha(segAge, duration);

      if (alpha <= 0) continue;
      allExpired = false;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke.color || this.params.color;
      ctx.lineWidth = this.params.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (this.params.glow > 0) {
        ctx.shadowColor = stroke.color || this.params.color;
        ctx.shadowBlur = this.params.glow * alpha;
      }

      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);

      if (i < pts.length - 1) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
      } else {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }

      ctx.stroke();
      ctx.restore();
    }

    return allExpired;
  }

  // фоллбэк: равномерное затухание если нет таймстампов на каждую точку
  private _drawLaserStrokeFallback(stroke: Stroke, now: number): boolean {
    const pts = stroke.points;
    if (pts.length < 2) return true;

    const age = now - (stroke.createdAt ?? now);
    const alpha = this._computeAlpha(age, this.params.duration);

    if (alpha <= 0) return true;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke.color || this.params.color;
    ctx.lineWidth = this.params.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.params.glow > 0) {
      ctx.shadowColor = stroke.color || this.params.color;
      ctx.shadowBlur = this.params.glow * alpha;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);

    for (let i = 1; i < pts.length; i++) {
      if (i < pts.length - 1) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
      } else {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
    }

    ctx.stroke();
    ctx.restore();

    return false;
  }

  private _computeAlpha(ageMs: number, duration: number): number {
    const t = ageMs / duration;
    if (t >= 1) return 0;
    if (t <= 0) return 1;

    switch (this.params.fadeCurve) {
      case 'exp':
        return Math.pow(1 - t, 2.5);
      case 'linear':
      default:
        return 1 - t;
    }
  }
}
