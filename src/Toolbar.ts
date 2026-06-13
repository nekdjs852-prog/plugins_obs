import { ToolType, BoardNode } from './types';

export interface ToolbarCallbacks {
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onLaserColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitToScreen: () => void;
  onFullscreen: () => void;
  onExport: () => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onTextColorChange: (color: string) => void;
  onToggleLayers: () => void;
}

interface ToolDef {
  id: ToolType;
  svg: string;
  title: string;
  group: string;
}


const SVG_ICONS: Record<string, string> = {
  select: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l5 12 2-5 5-2L3 3z"/></svg>`,

  rectangle: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10" rx="1.5"/></svg>`,

  ellipse: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="9" cy="9" rx="7" ry="5"/></svg>`,

  text: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="14" y2="4"/><line x1="9" y1="4" x2="9" y2="15"/><line x1="6" y1="15" x2="12" y2="15"/></svg>`,

  image: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="14" height="12" rx="1.5"/><circle cx="6.5" cy="7.5" r="1.5"/><path d="M2 13l4-4 3 3 2-2 5 5" stroke-linejoin="round"/></svg>`,

  connector: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="14" r="2"/><circle cx="14" cy="4" r="2"/><line x1="5.5" y1="12.5" x2="12.5" y2="5.5"/><polyline points="10,4 14,4 14,8"/></svg>`,

  pencil: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 2.5l3 3L6 15H3v-3L12.5 2.5z"/><line x1="10" y1="5" x2="13" y2="8"/></svg>`,

  marker: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15l2-6 7-7 3 3-7 7-5 3z"/><line x1="8" y1="5" x2="13" y2="10"/></svg>`,

  eraser: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15h10"/><path d="M3.5 11.5l4-8 7 4-4 8-4-1-3-3z"/><line x1="7.5" y1="7.5" x2="11.5" y2="11.5"/></svg>`,

  laser: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="2"/><path d="M9 3v2"/><path d="M9 13v2"/><path d="M3 9h2"/><path d="M13 9h2"/><path d="M5 5l1.5 1.5"/><path d="M11.5 11.5L13 13"/><path d="M13 5l-1.5 1.5"/><path d="M6.5 11.5L5 13"/></svg>`,

  undo: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,8 2,5 5,2"/><path d="M2 5h10a4 4 0 0 1 0 8H8"/></svg>`,

  redo: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="13,8 16,5 13,2"/><path d="M16 5H6a4 4 0 0 0 0 8h4"/></svg>`,

  fitScreen: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 2,2 6,2"/><polyline points="12,2 16,2 16,6"/><polyline points="16,12 16,16 12,16"/><polyline points="6,16 2,16 2,12"/></svg>`,

  fullscreen: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,2 2,2 2,6"/><polyline points="16,6 16,2 12,2"/><polyline points="12,16 16,16 16,12"/><polyline points="2,12 2,16 6,16"/><line x1="2" y1="2" x2="7" y2="7"/><line x1="11" y1="11" x2="16" y2="16"/><line x1="16" y1="2" x2="11" y2="7"/><line x1="7" y1="11" x2="2" y2="16"/></svg>`,

  save: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 16H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h9l4 4v9a1 1 0 0 1-1 1z"/><polyline points="13,16 13,10 5,10 5,16"/><polyline points="5,2 5,6 11,6"/></svg>`,

  layers: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="9,2 16,6 9,10 2,6"/><polyline points="2,9.5 9,13.5 16,9.5"/><polyline points="2,12.5 9,16.5 16,12.5"/></svg>`,

};


const COLOR_CAPABLE_TOOLS: ToolType[] = [
  'rectangle', 'ellipse', 'text', 'connector', 'pencil', 'marker',
];


const FONT_CAPABLE_TOOLS: ToolType[] = ['text', 'rectangle', 'ellipse', 'group'];


const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Outfit', value: 'Outfit, sans-serif' },
  { label: 'Fira Code', value: '"Fira Code", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
  { label: 'Times', value: '"Times New Roman", serif' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const TOOLS: ToolDef[] = [
  { id: 'select', svg: SVG_ICONS.select, title: 'Select (V)', group: 'pointer' },
  { id: 'rectangle', svg: SVG_ICONS.rectangle, title: 'Rectangle (R)', group: 'shape' },
  { id: 'ellipse', svg: SVG_ICONS.ellipse, title: 'Ellipse (E)', group: 'shape' },
  { id: 'text', svg: SVG_ICONS.text, title: 'Text (T)', group: 'shape' },
  { id: 'image', svg: SVG_ICONS.image, title: 'Image (I)', group: 'shape' },
  { id: 'connector', svg: SVG_ICONS.connector, title: 'Connector (C)', group: 'shape' },

  { id: 'pencil', svg: SVG_ICONS.pencil, title: 'Pencil (P)', group: 'draw' },
  { id: 'marker', svg: SVG_ICONS.marker, title: 'Marker (M)', group: 'draw' },
  { id: 'eraser', svg: SVG_ICONS.eraser, title: 'Eraser (X)', group: 'draw' },
  { id: 'laser', svg: SVG_ICONS.laser, title: 'Laser (L)', group: 'draw' },
];


const LASER_COLORS = [
  '#ff3333', '#33ff33', '#3399ff', '#ff9900',
  '#ff33ff', '#ffff00', '#00ffcc', '#ffffff',
];

export class Toolbar {
  private el: HTMLElement;
  private callbacks: ToolbarCallbacks;
  private currentTool: ToolType = 'select';
  private toolButtons = new Map<ToolType, HTMLElement>();
  private laserColorPanel: HTMLElement | null = null;
  private currentLaserColor = '#ff3333';


  private colorWheelContainer: HTMLElement | null = null;
  private colorWheelCanvas: HTMLCanvasElement | null = null;
  private colorBrightnessSlider: HTMLInputElement | null = null;
  private colorPreview: HTMLElement | null = null;
  private currentHue = 0;
  private currentSat = 100;
  private currentLight = 50;
  private selectedColor = '#e0e0e0';
  private colorSwatchBtn: HTMLElement | null = null;


  private fontControlsContainer: HTMLElement | null = null;
  private fontSizeInput: HTMLInputElement | null = null;
  private fontFamilySelect: HTMLSelectElement | null = null;
  private selectionNode: BoardNode | null = null;


  private textColorSwatchBtn: HTMLElement | null = null;
  private textColorPopup: HTMLElement | null = null;
  private textColorCanvas: HTMLCanvasElement | null = null;
  private textColorBrightnessSlider: HTMLInputElement | null = null;
  private textColorPreview: HTMLElement | null = null;
  private textColorHue = 0;
  private textColorSat = 0;
  private textColorLight = 80;
  private selectedTextColor = 'var(--text-normal)';
  private textColorUseDefault = true;


  constructor(parent: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;

    this.el = document.createElement('div');
    this.el.className = 'ib-toolbar';
    parent.appendChild(this.el);

    this._build();
  }

  setActiveTool(tool: ToolType): void {
    this.currentTool = tool;
    for (const [id, btn] of this.toolButtons) {
      btn.classList.toggle('ib-toolbar-btn--active', id === tool);
    }
    this._toggleLaserColorPanel(tool === 'laser');
    this._refreshContextPanels();
  }

  /**
   * Контекст выделения: при выделении ноды показываем настройки шрифта/цвета
   * и синхронизируем значения с этой нодой. null — выделение снято.
   */
  setSelectionContext(node: BoardNode | null): void {
    this.selectionNode = node;
    if (node) {
      if (this.fontSizeInput) this.fontSizeInput.value = String(node.fontSize ?? 14);
      if (this.fontFamilySelect && node.fontFamily) this.fontFamilySelect.value = node.fontFamily;
      if (node.fillColor && !node.fillColor.startsWith('var(') && node.type !== 'image') {
        this.selectedColor = node.fillColor;
        if (this.colorSwatchBtn) this.colorSwatchBtn.style.backgroundColor = node.fillColor;
        if (this.colorPreview) this.colorPreview.style.backgroundColor = node.fillColor;
      }
      this.textColorUseDefault = !node.textColor;
      this.selectedTextColor = node.textColor ?? 'var(--text-normal)';
      this._updateTextColorSwatch();
    }
    this._refreshContextPanels();
  }

  // показываем панели шрифта/цвета если их поддерживает активный инструмент ЛИБО что-то выделено
  private _refreshContextPanels(): void {
    const showFont = FONT_CAPABLE_TOOLS.includes(this.currentTool) || this.selectionNode !== null;
    const showColor = COLOR_CAPABLE_TOOLS.includes(this.currentTool)
      || (this.selectionNode !== null && this.selectionNode.type !== 'image');
    this._toggleFontControls(showFont);
    this._toggleColorWheel(showColor);
  }

  getElement(): HTMLElement { return this.el; }

  destroy(): void {
    this.el.remove();
  }



  private _build(): void {
    // Tool buttons
    const toolGroup = this._group();
    for (const t of TOOLS) {
      const btn = this._svgBtn(t.svg, t.title, () => {
        this.setActiveTool(t.id);
        this.callbacks.onToolChange(t.id);
      });
      this.toolButtons.set(t.id, btn);
      toolGroup.appendChild(btn);
    }
    this.el.appendChild(toolGroup);

    this.el.appendChild(this._sep());

    // Width slider
    const widthWrap = this._group();
    const widthInput = document.createElement('input');
    widthInput.type = 'range';
    widthInput.min = '1';
    widthInput.max = '20';
    widthInput.value = '2';
    widthInput.className = 'ib-toolbar-range';
    widthInput.title = 'Line width';
    widthInput.addEventListener('input', () => this.callbacks.onWidthChange(Number(widthInput.value)));
    widthWrap.appendChild(widthInput);
    this.el.appendChild(widthWrap);

    this.el.appendChild(this._sep());

    // Action buttons
    const actGroup = this._group();
    actGroup.appendChild(this._svgBtn(SVG_ICONS.undo, 'Undo (Ctrl+Z)', this.callbacks.onUndo));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.redo, 'Redo (Ctrl+Y)', this.callbacks.onRedo));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.fitScreen, 'Fit to screen', this.callbacks.onFitToScreen));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.layers, 'Слои', this.callbacks.onToggleLayers));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.fullscreen, 'Fullscreen (F11)', this.callbacks.onFullscreen));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.save, 'Export', this.callbacks.onExport));
    this.el.appendChild(actGroup);

    // Build sub-panels (hidden by default)
    this._buildLaserColorPanel();
    this._buildColorWheel();
    this._buildFontControls();


    this.setActiveTool('select');
  }



  private _buildColorWheel(): void {
    this.colorWheelContainer = document.createElement('div');
    this.colorWheelContainer.className = 'ib-color-wheel-panel';
    this.colorWheelContainer.style.display = 'none';

    // Color swatch button (shows current color, toggles the wheel popup)
    this.colorSwatchBtn = document.createElement('button');
    this.colorSwatchBtn.className = 'ib-color-swatch-btn';
    this.colorSwatchBtn.style.backgroundColor = this.selectedColor;
    this.colorSwatchBtn.title = 'Pick color';
    this.colorWheelContainer.appendChild(this.colorSwatchBtn);

    // Popup that appears on click
    const popup = document.createElement('div');
    popup.className = 'ib-color-wheel-popup';
    popup.style.display = 'none';

    // Canvas for the hue/sat ring
    this.colorWheelCanvas = document.createElement('canvas');
    this.colorWheelCanvas.width = 180;
    this.colorWheelCanvas.height = 180;
    this.colorWheelCanvas.className = 'ib-color-wheel-canvas';
    popup.appendChild(this.colorWheelCanvas);

    // Lightness slider
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'ib-color-wheel-slider-wrap';
    const lLabel = document.createElement('span');
    lLabel.textContent = 'L';
    lLabel.className = 'ib-color-wheel-label';
    sliderWrap.appendChild(lLabel);
    this.colorBrightnessSlider = document.createElement('input');
    this.colorBrightnessSlider.type = 'range';
    this.colorBrightnessSlider.min = '5';
    this.colorBrightnessSlider.max = '95';
    this.colorBrightnessSlider.value = '50';
    this.colorBrightnessSlider.className = 'ib-color-wheel-lightness';
    sliderWrap.appendChild(this.colorBrightnessSlider);
    popup.appendChild(sliderWrap);

    // Preview swatch
    this.colorPreview = document.createElement('div');
    this.colorPreview.className = 'ib-color-wheel-preview';
    this.colorPreview.style.backgroundColor = this.selectedColor;
    popup.appendChild(this.colorPreview);

    this.colorWheelContainer.appendChild(popup);
    this.el.appendChild(this.colorWheelContainer);

    // Events
    this.colorSwatchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popup.style.display !== 'none';
      popup.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) this._drawColorWheel();
    });

    // Close popup when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (popup.style.display !== 'none' && !this.colorWheelContainer!.contains(e.target as Node)) {
        popup.style.display = 'none';
      }
    });

    this.colorWheelCanvas.addEventListener('pointerdown', (e) => {
      this._pickColorFromWheel(e);
      const onMove = (me: PointerEvent) => this._pickColorFromWheel(me);
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    this.colorBrightnessSlider.addEventListener('input', () => {
      this.currentLight = Number(this.colorBrightnessSlider!.value);
      this._applyColor();
      this._drawColorWheel();
    });
  }


  private _drawColorWheel(): void {
    const canvas = this.colorWheelCanvas!;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, w, h);

    // Draw hue ring
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, ${this.currentLight}%)`;
      ctx.fill();
    }

    // Draw saturation gradient in the center circle
    const gradR = innerR - 4;
    for (let y = -gradR; y <= gradR; y += 2) {
      for (let x = -gradR; x <= gradR; x += 2) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist > gradR) continue;
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        const sat = (dist / gradR) * 100;
        ctx.fillStyle = `hsl(${angle}, ${sat}%, ${this.currentLight}%)`;
        ctx.fillRect(cx + x, cy + y, 2, 2);
      }
    }

    // Draw indicator dot
    const indicatorAngle = this.currentHue * Math.PI / 180;
    const indicatorR = innerR + (outerR - innerR) / 2;
    if (this.currentSat > 70) {
      // Indicator on the ring
      const ix = cx + Math.cos(indicatorAngle) * indicatorR;
      const iy = cy + Math.sin(indicatorAngle) * indicatorR;
      this._drawIndicator(ctx, ix, iy);
    } else {
      // Indicator on the inner circle
      const satR = (this.currentSat / 100) * (gradR);
      const ix = cx + Math.cos(indicatorAngle) * satR;
      const iy = cy + Math.sin(indicatorAngle) * satR;
      this._drawIndicator(ctx, ix, iy);
    }
  }

  private _drawIndicator(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }


  private _pickColorFromWheel(e: PointerEvent): void {
    e.stopPropagation();
    const canvas = this.colorWheelCanvas!;
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width) - cx;
    const y = (e.clientY - rect.top) * (canvas.height / rect.height) - cy;

    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;
    const dist = Math.sqrt(x * x + y * y);
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    this.currentHue = Math.round(angle);

    if (dist <= innerR - 4) {
      // Inside the saturation circle
      this.currentSat = Math.round(Math.min(100, (dist / (innerR - 4)) * 100));
    } else {
      // On the hue ring
      this.currentSat = 100;
    }

    this._applyColor();
    this._drawColorWheel();
  }


  private _applyColor(): void {
    this.selectedColor = `hsl(${this.currentHue}, ${this.currentSat}%, ${this.currentLight}%)`;
    if (this.colorSwatchBtn) this.colorSwatchBtn.style.backgroundColor = this.selectedColor;
    if (this.colorPreview) this.colorPreview.style.backgroundColor = this.selectedColor;
    this.callbacks.onColorChange(this.selectedColor);
  }


  private _toggleColorWheel(show: boolean): void {
    if (this.colorWheelContainer) {
      this.colorWheelContainer.style.display = show ? 'flex' : 'none';
    }
  }



  private _buildLaserColorPanel(): void {
    this.laserColorPanel = document.createElement('div');
    this.laserColorPanel.className = 'ib-laser-color-panel';
    this.laserColorPanel.style.display = 'none';

    const label = document.createElement('span');
    label.className = 'ib-laser-color-label';
    label.textContent = 'Laser:';
    this.laserColorPanel.appendChild(label);

    for (const color of LASER_COLORS) {
      const swatch = document.createElement('button');
      swatch.className = 'ib-laser-color-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      if (color === this.currentLaserColor) {
        swatch.classList.add('ib-laser-color-swatch--active');
      }
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentLaserColor = color;
        this.laserColorPanel!.querySelectorAll('.ib-laser-color-swatch').forEach(s =>
          s.classList.toggle('ib-laser-color-swatch--active', (s as HTMLElement).style.backgroundColor === swatch.style.backgroundColor)
        );
        this.callbacks.onLaserColorChange(color);
      });
      this.laserColorPanel.appendChild(swatch);
    }

    this.el.appendChild(this.laserColorPanel);
  }

  private _toggleLaserColorPanel(show: boolean): void {
    if (this.laserColorPanel) {
      this.laserColorPanel.style.display = show ? 'flex' : 'none';
    }
  }



  private _svgBtn(svgMarkup: string, title: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'ib-toolbar-btn';
    btn.title = title;
    btn.innerHTML = svgMarkup;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  private _group(): HTMLElement {
    const g = document.createElement('div');
    g.className = 'ib-toolbar-group';
    return g;
  }

  private _sep(): HTMLElement {
    const s = document.createElement('div');
    s.className = 'ib-toolbar-sep';
    return s;
  }



  private _buildFontControls(): void {
    this.fontControlsContainer = document.createElement('div');
    this.fontControlsContainer.className = 'ib-font-controls-panel';
    this.fontControlsContainer.style.display = 'none';

    // Font size
    const sizeWrap = document.createElement('div');
    sizeWrap.className = 'ib-font-size-wrap';
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'ib-font-label';
    sizeLabel.textContent = 'Size';
    sizeWrap.appendChild(sizeLabel);

    this.fontSizeInput = document.createElement('input');
    this.fontSizeInput.type = 'number';
    this.fontSizeInput.min = '8';
    this.fontSizeInput.max = '120';
    this.fontSizeInput.value = '14';
    this.fontSizeInput.className = 'ib-font-size-input';
    this.fontSizeInput.title = 'Font size (px)';
    this.fontSizeInput.addEventListener('change', () => {
      const size = Math.min(120, Math.max(8, Number(this.fontSizeInput!.value)));
      this.fontSizeInput!.value = String(size);
      this.callbacks.onFontSizeChange(size);
    });
    sizeWrap.appendChild(this.fontSizeInput);

    const pxLabel = document.createElement('span');
    pxLabel.className = 'ib-font-label';
    pxLabel.textContent = 'px';
    sizeWrap.appendChild(pxLabel);

    this.fontControlsContainer.appendChild(sizeWrap);

    // Font family
    const familyWrap = document.createElement('div');
    familyWrap.className = 'ib-font-family-wrap';
    const familyLabel = document.createElement('span');
    familyLabel.className = 'ib-font-label';
    familyLabel.textContent = 'Font';
    familyWrap.appendChild(familyLabel);

    this.fontFamilySelect = document.createElement('select');
    this.fontFamilySelect.className = 'ib-font-family-select';
    this.fontFamilySelect.title = 'Font family';
    for (const f of FONT_FAMILIES) {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = f.value;
      this.fontFamilySelect.appendChild(opt);
    }
    this.fontFamilySelect.addEventListener('change', () => {
      this.callbacks.onFontFamilyChange(this.fontFamilySelect!.value);
    });
    familyWrap.appendChild(this.fontFamilySelect);

    this.fontControlsContainer.appendChild(familyWrap);

    // ─── Text color picker ─────────────────────────────────────
    this._buildTextColorPicker(this.fontControlsContainer);

    this.el.appendChild(this.fontControlsContainer);
  }

  private _toggleFontControls(show: boolean): void {
    if (this.fontControlsContainer) {
      this.fontControlsContainer.style.display = show ? 'flex' : 'none';
    }
  }



  private _buildTextColorPicker(parent: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.className = 'ib-text-color-wrap';

    const label = document.createElement('span');
    label.className = 'ib-font-label';
    label.textContent = 'Color';
    wrap.appendChild(label);

    // Swatch button
    this.textColorSwatchBtn = document.createElement('button');
    this.textColorSwatchBtn.className = 'ib-text-color-swatch-btn';
    this.textColorSwatchBtn.title = 'Text color';
    this.textColorSwatchBtn.innerHTML = `<span class="ib-text-color-swatch-letter">A</span>`;
    wrap.appendChild(this.textColorSwatchBtn);

    // Popup
    this.textColorPopup = document.createElement('div');
    this.textColorPopup.className = 'ib-text-color-popup';
    this.textColorPopup.style.display = 'none';

    // "Default" button to reset to theme color
    const defaultBtn = document.createElement('button');
    defaultBtn.className = 'ib-text-color-default-btn';
    defaultBtn.textContent = 'Default';
    defaultBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.textColorUseDefault = true;
      this.selectedTextColor = 'var(--text-normal)';
      this._updateTextColorSwatch();
      this.callbacks.onTextColorChange(this.selectedTextColor);
    });
    this.textColorPopup.appendChild(defaultBtn);

    // Quick-pick palette
    const palette = document.createElement('div');
    palette.className = 'ib-text-color-palette';
    const quickColors = [
      '#ffffff', '#cccccc', '#888888', '#333333', '#000000',
      '#ff4444', '#ff8844', '#ffcc00', '#44cc44', '#44aaff',
      '#8866ff', '#ff44cc', '#ff6688', '#00ccaa', '#aabb00',
    ];
    for (const c of quickColors) {
      const swatch = document.createElement('button');
      swatch.className = 'ib-text-color-quick-swatch';
      swatch.style.backgroundColor = c;
      swatch.title = c;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.textColorUseDefault = false;
        this.selectedTextColor = c;
        this._updateTextColorSwatch();
        this.callbacks.onTextColorChange(c);
      });
      palette.appendChild(swatch);
    }
    this.textColorPopup.appendChild(palette);

    // Mini HSL canvas for custom color
    this.textColorCanvas = document.createElement('canvas');
    this.textColorCanvas.width = 160;
    this.textColorCanvas.height = 160;
    this.textColorCanvas.className = 'ib-text-color-canvas';
    this.textColorPopup.appendChild(this.textColorCanvas);

    // Lightness slider
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'ib-color-wheel-slider-wrap';
    const lLabel = document.createElement('span');
    lLabel.textContent = 'L';
    lLabel.className = 'ib-color-wheel-label';
    sliderWrap.appendChild(lLabel);
    this.textColorBrightnessSlider = document.createElement('input');
    this.textColorBrightnessSlider.type = 'range';
    this.textColorBrightnessSlider.min = '5';
    this.textColorBrightnessSlider.max = '95';
    this.textColorBrightnessSlider.value = String(this.textColorLight);
    this.textColorBrightnessSlider.className = 'ib-color-wheel-lightness';
    sliderWrap.appendChild(this.textColorBrightnessSlider);
    this.textColorPopup.appendChild(sliderWrap);

    // Preview
    this.textColorPreview = document.createElement('div');
    this.textColorPreview.className = 'ib-text-color-preview';
    this.textColorPreview.textContent = 'Sample Text';
    this.textColorPopup.appendChild(this.textColorPreview);

    wrap.appendChild(this.textColorPopup);
    parent.appendChild(wrap);

    // ── Events ──
    this.textColorSwatchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = this.textColorPopup!.style.display !== 'none';
      this.textColorPopup!.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) this._drawTextColorWheel();
    });

    document.addEventListener('mousedown', (e) => {
      if (this.textColorPopup && this.textColorPopup.style.display !== 'none'
          && !wrap.contains(e.target as Node)) {
        this.textColorPopup.style.display = 'none';
      }
    });

    this.textColorCanvas.addEventListener('pointerdown', (e) => {
      this._pickTextColorFromWheel(e);
      const onMove = (me: PointerEvent) => this._pickTextColorFromWheel(me);
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    this.textColorBrightnessSlider.addEventListener('input', () => {
      this.textColorLight = Number(this.textColorBrightnessSlider!.value);
      this._applyTextColor();
      this._drawTextColorWheel();
    });
  }

  private _drawTextColorWheel(): void {
    const canvas = this.textColorCanvas!;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, w, h);

    // Draw hue ring
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, ${this.textColorLight}%)`;
      ctx.fill();
    }

    // Draw saturation gradient in center
    const gradR = innerR - 4;
    for (let y = -gradR; y <= gradR; y += 2) {
      for (let x = -gradR; x <= gradR; x += 2) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist > gradR) continue;
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        const sat = (dist / gradR) * 100;
        ctx.fillStyle = `hsl(${angle}, ${sat}%, ${this.textColorLight}%)`;
        ctx.fillRect(cx + x, cy + y, 2, 2);
      }
    }

    // Indicator
    if (!this.textColorUseDefault) {
      const indicatorAngle = this.textColorHue * Math.PI / 180;
      if (this.textColorSat > 70) {
        const indicatorR = innerR + (outerR - innerR) / 2;
        const ix = cx + Math.cos(indicatorAngle) * indicatorR;
        const iy = cy + Math.sin(indicatorAngle) * indicatorR;
        this._drawIndicator(ctx, ix, iy);
      } else {
        const satR = (this.textColorSat / 100) * gradR;
        const ix = cx + Math.cos(indicatorAngle) * satR;
        const iy = cy + Math.sin(indicatorAngle) * satR;
        this._drawIndicator(ctx, ix, iy);
      }
    }
  }

  private _pickTextColorFromWheel(e: PointerEvent): void {
    e.stopPropagation();
    const canvas = this.textColorCanvas!;
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width) - cx;
    const y = (e.clientY - rect.top) * (canvas.height / rect.height) - cy;

    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;
    const dist = Math.sqrt(x * x + y * y);
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    this.textColorHue = Math.round(angle);
    this.textColorSat = dist <= innerR - 4
      ? Math.round(Math.min(100, (dist / (innerR - 4)) * 100))
      : 100;

    this.textColorUseDefault = false;
    this._applyTextColor();
    this._drawTextColorWheel();
  }

  private _applyTextColor(): void {
    this.selectedTextColor = `hsl(${this.textColorHue}, ${this.textColorSat}%, ${this.textColorLight}%)`;
    this.textColorUseDefault = false;
    this._updateTextColorSwatch();
    this.callbacks.onTextColorChange(this.selectedTextColor);
  }

  private _updateTextColorSwatch(): void {
    const letterEl = this.textColorSwatchBtn?.querySelector('.ib-text-color-swatch-letter') as HTMLElement | null;
    if (letterEl) {
      letterEl.style.color = this.textColorUseDefault ? '' : this.selectedTextColor;
      letterEl.classList.toggle('ib-text-color--custom', !this.textColorUseDefault);
    }
    if (this.textColorPreview) {
      this.textColorPreview.style.color = this.textColorUseDefault ? 'var(--text-normal)' : this.selectedTextColor;
    }
  }

}
