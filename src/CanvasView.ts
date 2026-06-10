
import { TextFileView, WorkspaceLeaf, TFile } from 'obsidian';
import { BoardData, Viewport, ToolType, ResizeDirection, InteractiveBoardSettings, DEFAULT_SETTINGS } from './types';
import { HistoryManager } from './HistoryManager';
import { NodeManager } from './NodeManager';
import { ConnectorManager } from './ConnectorManager';
import { DrawManager } from './DrawManager';
import { LaserRenderer } from './LaserRenderer';
import { SelectionManager } from './SelectionManager';
import { FullscreenManager } from './FullscreenManager';
import { Toolbar } from './Toolbar';
import { ExportModal } from './ExportModal';
import { createEmptyBoard } from './Storage';

export const VIEW_TYPE_BOARD = 'interactive-board-view';

export class CanvasView extends TextFileView {

  private boardData: BoardData = createEmptyBoard();
  private viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  private currentTool: ToolType = 'select';
  private currentColor = '#e0e0e0';
  private currentWidth = 2;
  settings: InteractiveBoardSettings = { ...DEFAULT_SETTINGS };


  private historyMgr!: HistoryManager;
  private nodeMgr!: NodeManager;
  private connectorMgr!: ConnectorManager;
  private drawMgr!: DrawManager;
  private laserRenderer!: LaserRenderer;
  private selectionMgr!: SelectionManager;
  private fullscreenMgr!: FullscreenManager;
  private toolbar!: Toolbar;


  private boardRoot!: HTMLElement;
  private worldLayer!: HTMLElement;
  private nodeLayer!: HTMLElement;
  private svgLayer!: SVGSVGElement;
  private permanentCanvas!: HTMLCanvasElement;
  private tempCanvas!: HTMLCanvasElement;
  private laserCanvas!: HTMLCanvasElement;
  private gridCanvas!: HTMLCanvasElement;


  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private isDragging = false;
  private dragNodeId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private isResizing = false;
  private resizeNodeId: string | null = null;
  private resizeStart = { x: 0, y: 0, w: 0, h: 0, nodeX: 0, nodeY: 0 };
  private resizeNodeType: string | null = null;
  private resizeDirection: ResizeDirection = 'se';
  private isDrawing = false;
  private isConnecting = false;
  private connectStartId: string | null = null;
  private spaceHeld = false;
  private pointerOnToolbar = false;


  private isCreatingShape = false;
  private creationOrigin = { x: 0, y: 0 };
  private creationPreview: HTMLElement | null = null;
  private creationTool: ToolType | null = null;

  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private animFrameId: number | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_BOARD; }
  getDisplayText(): string { return this.file?.basename ?? 'Interactive Board'; }
  getIcon(): string { return 'layout-dashboard'; }



  async onOpen(): Promise<void> {
    this._buildDOM();
    this._initManagers();
    this._initToolbar();
    this._bindEvents();
    this._startAutosave();
    this._startRenderLoop();
    this._resize();
    this._guardToolbar();
  }

  async onClose(): Promise<void> {
    this._stopAutosave();
    this._stopRenderLoop();
    this.laserRenderer.stop();
    this.fullscreenMgr.exit();
    this.toolbar.destroy();
  }



  getViewData(): string {
    this._collectBoardData();
    return JSON.stringify(this.boardData, null, 2);
  }

  setViewData(data: string, clear: boolean): void {
    try {
      this.boardData = JSON.parse(data) as BoardData;
    } catch {
      this.boardData = createEmptyBoard();
    }
    if (clear) this._clearAll();
    this._loadFromBoardData();
  }

  clear(): void {
    this.boardData = createEmptyBoard();
    this._clearAll();
  }



  private _buildDOM(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ib-root');

    this.boardRoot = contentEl.createDiv({ cls: 'ib-board-root' });
    this.gridCanvas = this.boardRoot.createEl('canvas', { cls: 'ib-grid-canvas' });

    this.worldLayer = this.boardRoot.createDiv({ cls: 'ib-world-layer' });


    this.nodeLayer = this.worldLayer.createDiv({ cls: 'ib-node-layer' });

    // SVG layer (connectors)
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.classList.add('ib-svg-layer');
    this.worldLayer.appendChild(this.svgLayer);


    this.permanentCanvas = this.boardRoot.createEl('canvas', { cls: 'ib-permanent-canvas' });
    this.tempCanvas = this.boardRoot.createEl('canvas', { cls: 'ib-temp-canvas' });
    this.laserCanvas = this.boardRoot.createEl('canvas', { cls: 'ib-laser-canvas' });
  }



  private _initManagers(): void {
    this.historyMgr = new HistoryManager();
    this.nodeMgr = new NodeManager(this.nodeLayer, this.historyMgr, this.app);
    this.connectorMgr = new ConnectorManager(this.svgLayer, this.nodeMgr, this.historyMgr);
    this.drawMgr = new DrawManager(this.permanentCanvas, this.tempCanvas, this.historyMgr);
    this.laserRenderer = new LaserRenderer(this.laserCanvas, this.drawMgr, { ...this.settings.laserParams });
    this.selectionMgr = new SelectionManager(this.nodeLayer, this.nodeMgr, this.connectorMgr, this.historyMgr);
    this.fullscreenMgr = new FullscreenManager(this.boardRoot);

    const markDirty = () => { this.dirty = true; };
    this.nodeMgr.onChange = markDirty;
    this.connectorMgr.onChange = markDirty;
    this.drawMgr.onChange = markDirty;

    this.connectorMgr.onContextMenu = (x, y, items) => this._showContextMenu(x, y, items);

    this.laserRenderer.start();
  }

  private _showContextMenu(sx: number, sy: number, items: { label: string; action: () => void }[]): void {
    this.boardRoot.querySelector('.ib-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'ib-context-menu';

    const rect = this.boardRoot.getBoundingClientRect();
    menu.style.left = `${sx - rect.left}px`;
    menu.style.top = `${sy - rect.top}px`;

    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'ib-context-menu-item';
      btn.textContent = item.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        menu.remove();
      });
      menu.appendChild(btn);
    }

    this.boardRoot.appendChild(menu);

    const close = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('pointerdown', close, true);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
  }



  private _initToolbar(): void {
    this.toolbar = new Toolbar(this.boardRoot, {
      onToolChange: (tool) => {
        this.currentTool = tool;
        this._updateDrawActiveState();
      },
      onColorChange: (c) => {
        this.currentColor = c;
        this._applyColorToSelection(c);
      },
      onWidthChange: (w) => { this.currentWidth = w; },
      onLaserColorChange: (c) => {
        this.settings.laserParams.color = c;
        this.laserRenderer.setParams({ color: c });
      },
      onUndo: () => this.historyMgr.undo(),
      onRedo: () => this.historyMgr.redo(),
      onFitToScreen: () => this._fitToScreen(),
      onFullscreen: () => this.fullscreenMgr.toggle(),
      onExport: () => this._openExportModal(),
      onFontSizeChange: (size) => this._applyFontSizeToSelection(size),
      onFontFamilyChange: (family) => this._applyFontFamilyToSelection(family),
      onTextColorChange: (color) => this._applyTextColorToSelection(color),
    });
  }

  private _applyColorToSelection(color: string): void {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node && node.type !== 'image') {
        this.nodeMgr.updateNode(id, { fillColor: color });
      }
    }
  }

  private _applyFontSizeToSelection(size: number): void {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { fontSize: size });
      }
    }
  }

  private _applyFontFamilyToSelection(family: string): void {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { fontFamily: family });
      }
    }
  }

  private _applyTextColorToSelection(color: string): void {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { textColor: color });
      }
    }
  }





  private _openExportModal(): void {
    this._collectBoardData();
    const defaultName = (this.file?.basename ?? 'board') + '.png';
    const modal = new ExportModal(this.app, this.boardData, this.boardRoot, defaultName);
    modal.openAndWait();
  }



  private _bindEvents(): void {
    const root = this.boardRoot;


    root.addEventListener('pointerdown', this._onPointerDown);
    root.addEventListener('pointermove', this._onPointerMove);
    root.addEventListener('pointerup', this._onPointerUp);


    root.addEventListener('wheel', this._onWheel, { passive: false });


    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);


    window.addEventListener('resize', this._onResize);


    root.addEventListener('contextmenu', (e) => {
      if (e.button === 1) e.preventDefault();
    });


    root.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.classList.add('ib-drag-over');
    });
    root.addEventListener('dragleave', (e) => {
      e.preventDefault();
      root.classList.remove('ib-drag-over');
    });
    root.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.classList.remove('ib-drag-over');
      this._handleDrop(e);
    });


    root.addEventListener('paste', (e: ClipboardEvent) => {
      this._handlePaste(e);
    });
  }



  private _onPointerDown = (e: PointerEvent): void => {
    if (this.pointerOnToolbar) return;

    const boardPt = this._screenToBoard(e.clientX, e.clientY);

    if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.viewport.x, y: e.clientY - this.viewport.y };
      this.boardRoot.style.cursor = 'grabbing';
      return;
    }

    if (this.spaceHeld) {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.viewport.x, y: e.clientY - this.viewport.y };
      this.boardRoot.style.cursor = 'grabbing';
      return;
    }

    if (['pencil', 'marker', 'eraser', 'laser'].includes(this.currentTool)) {
      this.isDrawing = true;
      const tool = this.currentTool as 'pencil' | 'marker' | 'eraser' | 'laser';
      const color = this.currentTool === 'eraser' ? '#000'
                   : this.currentTool === 'laser' ? this.settings.laserParams.color
                   : this.currentColor;
      this.drawMgr.startStroke(tool, color, this.currentWidth);
      this.drawMgr.addPoint(boardPt.x, boardPt.y);
      return;
    }

    const target = (e.target as HTMLElement).closest('.ib-node') as HTMLElement | null;

    if (this.currentTool === 'connector') {
      if (target) {
        const nodeId = target.dataset.nodeId!;
        if (!this.isConnecting) {
          this.isConnecting = true;
          this.connectStartId = nodeId;
        } else {
          if (this.connectStartId && this.connectStartId !== nodeId) {
            this.connectorMgr.createConnector(this.connectStartId, nodeId);
          }
          this.isConnecting = false;
          this.connectStartId = null;
        }
      } else {
        this.isConnecting = false;
        this.connectStartId = null;
      }
      return;
    }

    if (this.currentTool === 'select') {
      if (target) {
        const nodeId = target.dataset.nodeId!;
        const handleEl = (e.target as HTMLElement).closest('.ib-resize-handle') as HTMLElement | null;
        if (handleEl) {
          this.isResizing = true;
          this.resizeNodeId = nodeId;
          const node = this.nodeMgr.getNode(nodeId)!;
          this.resizeDirection = (handleEl.dataset.resizeDir as ResizeDirection) || 'se';
          this.resizeStart = {
            x: e.clientX, y: e.clientY,
            w: node.width, h: node.height,
            nodeX: node.x, nodeY: node.y,
          };
          this.resizeNodeType = node.type;
          const resizeEl = this.nodeMgr.getNodeElement(nodeId);
          if (resizeEl) resizeEl.style.transition = 'none';
          return;
        }

        this.selectionMgr.select(nodeId, e.shiftKey);
        this.isDragging = true;
        this.dragNodeId = nodeId;
        const node = this.nodeMgr.getNode(nodeId)!;
        this.dragOffset = { x: boardPt.x - node.x, y: boardPt.y - node.y };
      } else {
        this.selectionMgr.deselectAll();
        this.selectionMgr.startRubberBand(boardPt.x, boardPt.y);
      }
      return;
    }

    if (this.currentTool === 'image') {
      this.isCreatingShape = true;
      this.creationOrigin = { ...boardPt };
      this.creationTool = 'image';
      this._showCreationPreview(boardPt.x, boardPt.y);
      return;
    }

    if (['rectangle', 'ellipse', 'text', 'group'].includes(this.currentTool)) {
      this.isCreatingShape = true;
      this.creationOrigin = { ...boardPt };
      this.creationTool = this.currentTool;
      this._showCreationPreview(boardPt.x, boardPt.y);
      return;
    }
  };

  private _onPointerMove = (e: PointerEvent): void => {
    const boardPt = this._screenToBoard(e.clientX, e.clientY);

    if (this.isPanning) {
      this.viewport.x = e.clientX - this.panStart.x;
      this.viewport.y = e.clientY - this.panStart.y;
      this._applyViewport();
      return;
    }

    if (this.isDrawing) {
      this.drawMgr.addPoint(boardPt.x, boardPt.y);
      return;
    }

    if (this.isDragging && this.dragNodeId) {
      let nx = boardPt.x - this.dragOffset.x;
      let ny = boardPt.y - this.dragOffset.y;
      if (this.settings.snapToGrid) {
        nx = Math.round(nx / this.settings.gridSize) * this.settings.gridSize;
        ny = Math.round(ny / this.settings.gridSize) * this.settings.gridSize;
      }
      this.nodeMgr.updateNode(this.dragNodeId, { x: nx, y: ny }, true);
      this.connectorMgr.refreshForNode(this.dragNodeId);
      return;
    }

    if (this.isResizing && this.resizeNodeId) {
      const dx = (e.clientX - this.resizeStart.x) / this.viewport.zoom;
      const dy = (e.clientY - this.resizeStart.y) / this.viewport.zoom;
      const dir = this.resizeDirection;
      const MIN_W = 40;
      const MIN_H = 30;

      let newX = this.resizeStart.nodeX;
      let newY = this.resizeStart.nodeY;
      let newW = this.resizeStart.w;
      let newH = this.resizeStart.h;

      if (dir.includes('e')) {
        newW = Math.max(MIN_W, this.resizeStart.w + dx);
      } else if (dir.includes('w')) {
        const dw = Math.min(dx, this.resizeStart.w - MIN_W);
        newX = this.resizeStart.nodeX + dw;
        newW = this.resizeStart.w - dw;
      }

      if (dir.includes('s')) {
        newH = Math.max(MIN_H, this.resizeStart.h + dy);
      } else if (dir.includes('n')) {
        const dh = Math.min(dy, this.resizeStart.h - MIN_H);
        newY = this.resizeStart.nodeY + dh;
        newH = this.resizeStart.h - dh;
      }

      if (this.resizeNodeType === 'ellipse') {
        const maxDim = Math.max(newW, newH);
        if (dir.length === 2) {
          newW = maxDim;
          newH = maxDim;
        }
      }

      this.nodeMgr.updateNode(this.resizeNodeId, {
        x: newX, y: newY, width: newW, height: newH,
      }, true);
      this.connectorMgr.refreshForNode(this.resizeNodeId);
      return;
    }

    if (this.isCreatingShape && this.creationPreview) {
      this._updateCreationPreview(boardPt.x, boardPt.y);
      return;
    }

    this.selectionMgr.updateRubberBand(boardPt.x, boardPt.y);
  };

  private _onPointerUp = (e: PointerEvent): void => {
    const boardPt = this._screenToBoard(e.clientX, e.clientY);

    if (this.isPanning) {
      this.isPanning = false;
      this.boardRoot.style.cursor = '';
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      this.drawMgr.endStroke();
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.dragNodeId = null;
      return;
    }

    if (this.isResizing) {
      if (this.resizeNodeId) {
        const el = this.nodeMgr.getNodeElement(this.resizeNodeId);
        if (el) el.style.transition = '';
      }
      this.isResizing = false;
      this.resizeNodeId = null;
      this.resizeNodeType = null;
      return;
    }

    if (this.isCreatingShape) {
      this._finishCreation(boardPt.x, boardPt.y);
      return;
    }

    this.selectionMgr.endRubberBand(boardPt.x, boardPt.y);
  };



  private _showCreationPreview(x: number, y: number): void {
    this.creationPreview = document.createElement('div');
    this.creationPreview.className = 'ib-creation-preview';

    if (this.creationTool === 'ellipse') {
      this.creationPreview.classList.add('ib-creation-preview--ellipse');
    }
    if (this.creationTool === 'text') {
      this.creationPreview.classList.add('ib-creation-preview--text');
    }

    this.creationPreview.style.left = `${x}px`;
    this.creationPreview.style.top = `${y}px`;
    this.creationPreview.style.width = '0px';
    this.creationPreview.style.height = '0px';

    this.nodeLayer.appendChild(this.creationPreview);
  }

  private _updateCreationPreview(currentX: number, currentY: number): void {
    if (!this.creationPreview) return;

    const x = Math.min(this.creationOrigin.x, currentX);
    const y = Math.min(this.creationOrigin.y, currentY);
    const w = Math.abs(currentX - this.creationOrigin.x);
    const h = Math.abs(currentY - this.creationOrigin.y);

    this.creationPreview.style.left = `${x}px`;
    this.creationPreview.style.top = `${y}px`;
    this.creationPreview.style.width = `${w}px`;
    this.creationPreview.style.height = `${h}px`;
  }

  private _finishCreation(endX: number, endY: number): void {
    this.isCreatingShape = false;

    if (this.creationPreview) {
      this.creationPreview.remove();
      this.creationPreview = null;
    }

    const x = Math.min(this.creationOrigin.x, endX);
    const y = Math.min(this.creationOrigin.y, endY);
    let w = Math.abs(endX - this.creationOrigin.x);
    let h = Math.abs(endY - this.creationOrigin.y);

    const MIN_SIZE = 20;

    if (this.creationTool === 'image') {
      if (w < MIN_SIZE && h < MIN_SIZE) {
        this._openImagePicker(x, y, 0, 0);
      } else {
        this._openImagePicker(x, y, Math.max(w, 40), Math.max(h, 30));
      }
      this.creationTool = null;
      return;
    }

    if (w < MIN_SIZE && h < MIN_SIZE) {
      w = 160;
      h = this.creationTool === 'text' ? 40 : 80;
    } else {
      w = Math.max(w, 40);
      h = Math.max(h, 30);
    }

    const type = this.creationTool as any;
    const extra: any = {};
    if (type !== 'text') {
      extra.fillColor = this.currentColor;
    }

    const node = this.nodeMgr.createNode(type, x, y, w, h, extra);

    this.selectionMgr.select(node.id);
    this.creationTool = null;

    if (type === 'text') {
      setTimeout(() => {
        this.selectionMgr.startTextEdit(node.id);
      }, 50);
    }


  }

  private _openImagePicker(x: number, y: number, targetW = 0, targetH = 0): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        await this._importImageFile(file, x, y, targetW, targetH);
      }
      input.remove();
    });
    input.addEventListener('cancel', () => input.remove());
    input.click();
  }

  private async _handleDrop(e: DragEvent): Promise<void> {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const boardPt = this._screenToBoard(e.clientX, e.clientY);
    let offsetX = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        await this._importImageFile(file, boardPt.x + offsetX, boardPt.y, 0, 0, true);
        offsetX += 220;
      }
    }
  }

  private async _handlePaste(e: ClipboardEvent): Promise<void> {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const rect = this.boardRoot.getBoundingClientRect();
          const cx = (rect.width / 2 - this.viewport.x) / this.viewport.zoom;
          const cy = (rect.height / 2 - this.viewport.y) / this.viewport.zoom;
          await this._importImageFile(blob, cx - 100, cy - 75);
        }
        break;
      }
    }
  }

  private async _importImageFile(
    file: File, x: number, y: number,
    targetW = 0, targetH = 0, fullRes = false,
  ): Promise<void> {
    const vaultDir = this.file?.parent?.path ?? '';
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = vaultDir ? `${vaultDir}/img_${timestamp}_${safeName}` : `img_${timestamp}_${safeName}`;

    const buffer = await file.arrayBuffer();
    const created = await this.app.vault.createBinary(destPath, buffer);
    const resourcePath = this.app.vault.getResourcePath(created);

    const dims = await this._getImageDimensions(resourcePath);

    let w: number, h: number;
    if (targetW > 0 && targetH > 0) {
      w = targetW;
      h = targetH;
    } else if (fullRes) {
      w = dims.w;
      h = dims.h;
    } else {
      const maxW = 400;
      const scale = dims.w > maxW ? maxW / dims.w : 1;
      w = Math.round(dims.w * scale);
      h = Math.round(dims.h * scale);
    }

    const node = this.nodeMgr.createNode('image', x, y, w, h, {
      imagePath: resourcePath,
      vaultImagePath: destPath,
    });
    this.selectionMgr.select(node.id);
  }

  private _getImageDimensions(src: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 200, h: 150 });
      img.src = src;
    });
  }

  private _onDblClick = (e: MouseEvent): void => {
    if (this.pointerOnToolbar) return;
    const target = (e.target as HTMLElement).closest('.ib-node') as HTMLElement | null;
    if (target) {
      const nodeId = target.dataset.nodeId!;
      const node = this.nodeMgr.getNode(nodeId);
      if (node) {
        this.selectionMgr.startTextEdit(nodeId);
      }
    }
  };

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const rect = this.boardRoot.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newZoom = Math.min(5, Math.max(0.1, this.viewport.zoom * zoomFactor));
    this.viewport.x = mx - (mx - this.viewport.x) * (newZoom / this.viewport.zoom);
    this.viewport.y = my - (my - this.viewport.y) * (newZoom / this.viewport.zoom);
    this.viewport.zoom = newZoom;
    this._applyViewport();
  };

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ') { this.spaceHeld = true; e.preventDefault(); }
    if (e.key === 'Delete' || e.key === 'Backspace') this.selectionMgr.deleteSelected();
    if (e.ctrlKey && e.key === 'z') this.historyMgr.undo();
    if (e.ctrlKey && e.key === 'y') this.historyMgr.redo();
    if (e.ctrlKey && e.key === 'c') this.selectionMgr.copySelected();
    if (e.ctrlKey && e.key === 'v') this.selectionMgr.paste();

    if (!e.ctrlKey && !e.altKey) {
      const map: Record<string, ToolType> = {
        v: 'select', r: 'rectangle', e: 'ellipse', t: 'text', i: 'image',
        c: 'connector', p: 'pencil', m: 'marker', x: 'eraser', l: 'laser',
      };
      if (map[e.key]) {
        this.currentTool = map[e.key];
        this.toolbar.setActiveTool(this.currentTool);
        this._updateDrawActiveState();
      }
    }

    if (e.key === 'F11') { e.preventDefault(); this.fullscreenMgr.toggle(); }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ') this.spaceHeld = false;
  };


  private _applyViewport(): void {
    this.worldLayer.style.transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.zoom})`;
    this._drawGrid();
  }

  private _screenToBoard(sx: number, sy: number): { x: number; y: number } {
    const rect = this.permanentCanvas.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.viewport.x) / this.viewport.zoom,
      y: (sy - rect.top - this.viewport.y) / this.viewport.zoom,
    };
  }

  private _fitToScreen(): void {
    const nodes = this.nodeMgr.getAllNodes();
    if (nodes.length === 0) { this.viewport = { x: 0, y: 0, zoom: 1 }; this._applyViewport(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const bw = maxX - minX, bh = maxY - minY;
    const rect = this.boardRoot.getBoundingClientRect();
    const padding = 60;
    const zoom = Math.min((rect.width - padding * 2) / bw, (rect.height - padding * 2) / bh, 2);
    this.viewport.zoom = zoom;
    this.viewport.x = (rect.width - bw * zoom) / 2 - minX * zoom;
    this.viewport.y = (rect.height - bh * zoom) / 2 - minY * zoom;
    this._applyViewport();
  }


  private _drawGrid(): void {
    const canvas = this.gridCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gs = this.settings.gridSize * this.viewport.zoom;
    if (gs < 6) return; // too dense
    const offX = this.viewport.x % gs;
    const offY = this.viewport.y % gs;
    ctx.strokeStyle = 'var(--background-modifier-border)';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    for (let x = offX; x < canvas.width; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = offY; y < canvas.height; y += gs) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }


  private _onResize = (): void => { this._resize(); };

  private _resize(): void {
    const rect = this.boardRoot.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    [this.gridCanvas, this.permanentCanvas, this.tempCanvas, this.laserCanvas].forEach(c => {
      c.width = w;
      c.height = h;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    });
    this.svgLayer.setAttribute('width', String(w));
    this.svgLayer.setAttribute('height', String(h));
    this.drawMgr.resize(w, h);
    this.laserRenderer.resize(w, h);
    this._drawGrid();
  }


  private _startRenderLoop(): void {
    const loop = () => {
      this.drawMgr.renderWithTransform(this.viewport.x, this.viewport.y, this.viewport.zoom);
      this.laserRenderer.renderWithTransform(this.viewport.x, this.viewport.y, this.viewport.zoom);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private _stopRenderLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
  }


  private _startAutosave(): void {
    this.autosaveTimer = setInterval(() => {
      if (this.dirty) {
        this.dirty = false;

        this.requestSave();
      }
    }, this.settings.autosaveIntervalMs);
    this.boardRoot.addEventListener('dblclick', this._onDblClick);
  }

  private _stopAutosave(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
  }

  private _collectBoardData(): void {
    this.boardData.nodes = this.nodeMgr.serialise();
    this.boardData.connectors = this.connectorMgr.serialise();
    this.boardData.strokes = this.drawMgr.serialise(this.settings.saveTempStrokes);
    this.boardData.viewport = { ...this.viewport };
    this.boardData.laserParams = { ...this.settings.laserParams };
  }

  private _loadFromBoardData(): void {
    this.nodeMgr.deserialise(this.boardData.nodes);
    this.connectorMgr.deserialise(this.boardData.connectors);
    this.drawMgr.deserialise(this.boardData.strokes);
    this.viewport = { ...this.boardData.viewport };
    if (this.boardData.laserParams) {
      this.laserRenderer.setParams(this.boardData.laserParams);
    }
    this._applyViewport();
  }

  private _clearAll(): void {
    this.nodeMgr.clear();
    this.connectorMgr.clear();
    this.drawMgr.clearTemp();
    this.historyMgr.clear();
  }

  private _guardToolbar(): void {
    const toolbarEl = this.toolbar.getElement();
    toolbarEl.addEventListener('pointerenter', () => { this.pointerOnToolbar = true; });
    toolbarEl.addEventListener('pointerleave', () => { this.pointerOnToolbar = false; });
    toolbarEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
  }

  // при активном инструменте рисования ноды пропускают клики
  private _updateDrawActiveState(): void {
    const isDrawTool = ['pencil', 'marker', 'eraser', 'laser'].includes(this.currentTool);
    this.nodeLayer.classList.toggle('ib-draw-active', isDrawTool);
    this.svgLayer.classList.toggle('ib-draw-active', isDrawTool);
  }
}
