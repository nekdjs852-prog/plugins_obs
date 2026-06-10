import { Modal, App, Setting, Notice } from 'obsidian';
import { ExportFormat, BoardData } from './types';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
}

export class ExportModal extends Modal {
  private format: ExportFormat = 'png';
  private filename: string;
  private boardData: BoardData;
  private boardRoot: HTMLElement;
  private onConfirm: ((opts: ExportOptions) => void) | null = null;

  constructor(app: App, boardData: BoardData, boardRoot: HTMLElement, defaultFilename: string) {
    super(app);
    this.boardData = boardData;
    this.boardRoot = boardRoot;
    this.filename = defaultFilename;
  }

  openAndWait(): Promise<ExportOptions | null> {
    return new Promise((resolve) => {
      this.onConfirm = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ib-export-modal');
    contentEl.createEl('h2', { text: 'Export Board' });

    new Setting(contentEl)
      .setName('Format')
      .setDesc('Choose the export format')
      .addDropdown(d => {
        d.addOptions({ png: 'PNG Image', svg: 'SVG Vector', json: 'JSON Data' });
        d.setValue(this.format);
        d.onChange(v => { this.format = v as ExportFormat; this._updateExtension(); });
      });

    let filenameInput: HTMLInputElement;
    new Setting(contentEl)
      .setName('Filename')
      .setDesc('Name of the exported file')
      .addText(t => {
        filenameInput = t.inputEl;
        t.setValue(this.filename);
        t.onChange(v => { this.filename = v; });
      });

    const btnContainer = contentEl.createDiv({ cls: 'ib-export-btn-container' });
    const cancelBtn = btnContainer.createEl('button', { text: 'Cancel', cls: 'ib-export-btn ib-export-btn--cancel' });
    cancelBtn.addEventListener('click', () => { this.close(); this.onConfirm?.(null); });
    const exportBtn = btnContainer.createEl('button', { text: 'Export', cls: 'ib-export-btn ib-export-btn--confirm' });
    exportBtn.addEventListener('click', async () => { await this._doExport(); });
  }

  onClose(): void { this.contentEl.empty(); }

  private _updateExtension(): void {
    const base = this.filename.replace(/\.(png|svg|json)$/i, '');
    this.filename = `${base}.${this.format}`;
    const input = this.contentEl.querySelector<HTMLInputElement>('.setting-item:nth-child(3) input');
    if (input) input.value = this.filename;
  }

  private async _doExport(): Promise<void> {
    try {
      switch (this.format) {
        case 'json': await this._exportJSON(); break;
        case 'png': await this._exportPNG(); break;
        case 'svg': await this._exportSVG(); break;
      }
      this.close();
      this.onConfirm?.({ format: this.format, filename: this.filename });
    } catch (err) {
      new Notice(`Export failed: ${(err as Error).message}`);
    }
  }

  private async _exportJSON(): Promise<void> {
    const json = JSON.stringify(this.boardData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    this._downloadBlob(blob, this._ensureExtension(this.filename, '.json'));
    new Notice('Board exported as JSON');
  }

  private async _exportPNG(): Promise<void> {
    const canvas = await this._renderToCanvas();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to create PNG');
    this._downloadBlob(blob, this._ensureExtension(this.filename, '.png'));
    new Notice('Board exported as PNG');
  }

  private async _exportSVG(): Promise<void> {
    const svgContent = this._renderToSVG();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    this._downloadBlob(blob, this._ensureExtension(this.filename, '.svg'));
    new Notice('Board exported as SVG');
  }

  private async _renderToCanvas(): Promise<HTMLCanvasElement> {
    const nodes = this.boardData.nodes;
    const strokes = this.boardData.strokes;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
    }
    for (const s of strokes) {
      for (const [px, py] of s.points) {
        minX = Math.min(minX, px); minY = Math.min(minY, py);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    const padding = 40;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(padding - minX, padding - minY);

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.tool === 'marker') { ctx.globalAlpha = s.opacity * 0.45; ctx.lineWidth = s.width * 3; }
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
      ctx.restore();
    }

    for (const n of nodes) {
      ctx.save();
      ctx.fillStyle = n.fillColor.startsWith('var(') ? '#2d2d3d' : n.fillColor;
      ctx.strokeStyle = n.borderColor.startsWith('var(') ? '#4a4a5a' : n.borderColor;
      ctx.lineWidth = n.borderWidth;
      if (n.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(n.x + n.width / 2, n.y + n.height / 2, n.width / 2, n.height / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else {
        const r = Math.min(n.borderRadius, n.width / 2, n.height / 2);
        this._roundRect(ctx, n.x, n.y, n.width, n.height, r);
        ctx.fill(); ctx.stroke();
      }
      if (n.text) {
        ctx.fillStyle = '#cccccc'; ctx.font = '14px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.text, n.x + n.width / 2, n.y + n.height / 2, n.width - 16);
      }
      ctx.restore();
    }
    return canvas;
  }

  private _renderToSVG(): string {
    const nodes = this.boardData.nodes;
    const strokes = this.boardData.strokes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
    }
    for (const s of strokes) {
      for (const [px, py] of s.points) {
        minX = Math.min(minX, px); minY = Math.min(minY, py);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    const padding = 40;
    const w = maxX - minX + padding * 2, h = maxY - minY + padding * 2;
    const ox = padding - minX, oy = padding - minY;
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
    parts.push(`<rect width="${w}" height="${h}" fill="#1e1e2e"/>`);
    parts.push(`<g transform="translate(${ox},${oy})">`);

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
      const opacity = s.tool === 'marker' ? s.opacity * 0.45 : s.opacity;
      const width = s.tool === 'marker' ? s.width * 3 : s.width;
      parts.push(`<path d="${d}" stroke="${s.color}" stroke-width="${width}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    for (const n of nodes) {
      const fill = n.fillColor.startsWith('var(') ? '#2d2d3d' : n.fillColor;
      const stroke = n.borderColor.startsWith('var(') ? '#4a4a5a' : n.borderColor;
      if (n.type === 'ellipse') {
        parts.push(`<ellipse cx="${n.x + n.width / 2}" cy="${n.y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${n.borderWidth}"/>`);
      } else {
        const r = Math.min(n.borderRadius, n.width / 2, n.height / 2);
        parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${n.borderWidth}"/>`);
      }
      if (n.text) {
        parts.push(`<text x="${n.x + n.width / 2}" y="${n.y + n.height / 2}" fill="#cccccc" font-size="14" text-anchor="middle" dominant-baseline="central">${this._escapeXml(n.text)}</text>`);
      }
    }
    parts.push('</g>');
    parts.push('</svg>');
    return parts.join('\n');
  }

  private _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  private _downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private _ensureExtension(filename: string, ext: string): string {
    if (filename.toLowerCase().endsWith(ext)) return filename;
    return filename.replace(/\.[^.]+$/, '') + ext;
  }

  private _escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
