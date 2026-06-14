// тут фигуры (прямоугольник, эллипс, текст, картинка, группа)
// создаю/меняю/удаляю, рисую каждую как <div>. плюс z-index/скрытие/имя для панели слоёв
import { App, TFile } from 'obsidian';
import { BoardNode, NodeType, ResizeDirection, LayerObject, generateId } from './types';
import { HistoryManager } from './HistoryManager';

const DEFAULT_NODE_NAMES: Record<NodeType, string> = {
  rectangle: 'Прямоугольник',
  ellipse: 'Эллипс',
  text: 'Текст',
  group: 'Группа',
  image: 'Изображение',
};

export class NodeManager {
  private nodes: Map<string, BoardNode> = new Map();
  private nodeElements: Map<string, HTMLElement> = new Map();
  private container: HTMLElement;
  private history: HistoryManager;
  private app: App;
  private nextZIndex = 1;

  onChange: (() => void) | null = null;
  /** Внешний аллокатор единого z-порядка (общий для нод/штрихов/коннекторов). */
  zAlloc: (() => number) | null = null;

  constructor(container: HTMLElement, history: HistoryManager, app: App) {
    this.container = container;
    this.history = history;
    this.app = app;
  }

  createNode(
    type: NodeType,
    x: number,
    y: number,
    width = 160,
    height = 80,
    extra: Partial<BoardNode> = {},
  ): BoardNode {
    const node: BoardNode = {
      id: generateId(),
      type,
      x,
      y,
      width,
      height,
      fillColor: type === 'text' ? 'transparent' : (extra.fillColor ?? 'var(--background-secondary)'),
      borderColor: type === 'text' ? 'transparent' : (extra.borderColor ?? 'var(--background-modifier-border)'),
      borderWidth: type === 'text' ? 0 : (extra.borderWidth ?? 1),
      borderRadius: type === 'ellipse' ? 9999 : (extra.borderRadius ?? 6),
      text: extra.text ?? '',
      icon: extra.icon ?? '',
      imagePath: extra.imagePath,
      vaultImagePath: extra.vaultImagePath,
      fontSize: extra.fontSize ?? 14,
      fontFamily: extra.fontFamily ?? 'Inter, system-ui, sans-serif',
      textColor: extra.textColor,
      zIndex: extra.zIndex ?? (this.zAlloc ? this.zAlloc() : this.nextZIndex++),
      name: extra.name ?? DEFAULT_NODE_NAMES[type],
      hidden: extra.hidden ?? false,
      children: type === 'group' ? [] : undefined,
    };

    this.nodes.set(node.id, node);
    this._renderNode(node);

    this.history.push({
      type: 'create-node',
      undo: () => this.deleteNode(node.id, true),
      redo: () => {
        this.nodes.set(node.id, node);
        this._renderNode(node);
        this._emitChange();
      },
    });

    this._emitChange();
    return node;
  }

  updateNode(id: string, changes: Partial<BoardNode>, skipHistory = false): void {
    const node = this.nodes.get(id);
    if (!node) return;

    const prev = { ...node };
    Object.assign(node, changes);
    this._updateNodeElement(node);

    if (!skipHistory) {
      this.history.push({
        type: 'update-node',
        undo: () => {
          Object.assign(node, prev);
          this._updateNodeElement(node);
          this._emitChange();
        },
        redo: () => {
          Object.assign(node, changes);
          this._updateNodeElement(node);
          this._emitChange();
        },
      });
    }

    this._emitChange();
  }

  deleteNode(id: string, skipHistory = false): void {
    const node = this.nodes.get(id);
    if (!node) return;

    const el = this.nodeElements.get(id);
    if (el) {
      el.remove();
      this.nodeElements.delete(id);
    }
    this.nodes.delete(id);

    if (!skipHistory) {
      this.history.push({
        type: 'delete-node',
        undo: () => {
          this.nodes.set(node.id, node);
          this._renderNode(node);
          this._emitChange();
        },
        redo: () => this.deleteNode(node.id, true),
      });
    }

    this._emitChange();
  }

  getNode(id: string): BoardNode | undefined {
    return this.nodes.get(id);
  }

  // ─── Layer API ──────────────────────────────────────────────
  setZIndex(id: string, z: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.zIndex = z;
    const el = this.nodeElements.get(id);
    if (el) el.style.zIndex = String(z);
    this._emitChange();
  }

  setHidden(id: string, hidden: boolean): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.hidden = hidden;
    const el = this.nodeElements.get(id);
    if (el) el.style.display = hidden ? 'none' : '';
    this._emitChange();
  }

  setName(id: string, name: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.name = name;
    this._emitChange();
  }

  getLayerObjects(): LayerObject[] {
    return this.getAllNodes().map((n) => ({
      id: n.id,
      kind: 'node' as const,
      name: n.name ?? DEFAULT_NODE_NAMES[n.type] ?? 'Объект',
      zIndex: n.zIndex,
      hidden: !!n.hidden,
      subtype: n.type,
    }));
  }

  getAllNodes(): BoardNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeElement(id: string): HTMLElement | undefined {
    return this.nodeElements.get(id);
  }

  serialise(): BoardNode[] {
    return this.getAllNodes();
  }

  deserialise(data: BoardNode[]): void {
    this.clear();
    for (const node of data) {
      // перерезолвим путь к картинке из vault
      if (node.type === 'image' && node.vaultImagePath) {
        node.imagePath = this._resolveVaultImagePath(node.vaultImagePath);
      }
      if (node.name === undefined) node.name = DEFAULT_NODE_NAMES[node.type] ?? 'Объект';
      if (node.hidden === undefined) node.hidden = false;
      this.nodes.set(node.id, node);
      if (node.zIndex >= this.nextZIndex) {
        this.nextZIndex = node.zIndex + 1;
      }
      this._renderNode(node);
    }
  }

  clear(): void {
    for (const el of this.nodeElements.values()) {
      el.remove();
    }
    this.nodes.clear();
    this.nodeElements.clear();
    this.nextZIndex = 1;
  }

  private _renderNode(node: BoardNode): void {
    const el = document.createElement('div');
    el.className = 'ib-node';
    el.dataset.nodeId = node.id;
    el.dataset.nodeType = node.type;
    this._applyNodeStyles(el, node);

    if (node.type === 'text') {
      const span = document.createElement('span');
      span.className = 'ib-node-text';
      span.textContent = node.text;
      this._applyTextStyles(span, node);
      el.appendChild(span);
    } else if (node.type === 'image' && node.imagePath) {
      const img = document.createElement('img');
      img.className = 'ib-node-image';
      img.src = node.imagePath;
      img.draggable = false;
      el.appendChild(img);
    } else if (node.text) {
      const span = document.createElement('span');
      span.className = 'ib-node-text';
      span.textContent = node.text;
      this._applyTextStyles(span, node);
      el.appendChild(span);
    }

    // 8 ручек для ресайза
    const directions: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    for (const dir of directions) {
      const handle = document.createElement('div');
      handle.className = `ib-resize-handle ib-resize-handle--${dir}`;
      handle.dataset.resizeDir = dir;
      el.appendChild(handle);
    }

    this.container.appendChild(el);
    this.nodeElements.set(node.id, el);
  }

  private _applyNodeStyles(el: HTMLElement, node: BoardNode): void {
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.height = `${node.height}px`;
    el.style.backgroundColor = node.fillColor;
    el.style.border = `${node.borderWidth}px solid ${node.borderColor}`;
    el.style.borderRadius = `${node.borderRadius}px`;
    el.style.zIndex = String(node.zIndex);
    el.style.display = node.hidden ? 'none' : '';
  }

  private _updateNodeElement(node: BoardNode): void {
    const el = this.nodeElements.get(node.id);
    if (!el) return;
    this._applyNodeStyles(el, node);

    const textEl = el.querySelector('.ib-node-text') as HTMLElement | null;
    if (textEl) {
      textEl.textContent = node.text;
      this._applyTextStyles(textEl, node);
    }

    const imgEl = el.querySelector('.ib-node-image') as HTMLImageElement | null;
    if (imgEl && node.imagePath) {
      imgEl.src = node.imagePath;
    }
  }

  private _applyTextStyles(el: HTMLElement, node: BoardNode): void {
    if (node.fontSize) el.style.fontSize = `${node.fontSize}px`;
    if (node.fontFamily) el.style.fontFamily = node.fontFamily;
    if (node.textColor) {
      el.style.color = node.textColor;
    } else {
      el.style.color = '';
    }
  }

  private _resolveVaultImagePath(vaultPath: string): string {
    const file = this.app.vault.getAbstractFileByPath(vaultPath);
    if (file instanceof TFile) {
      return this.app.vault.getResourcePath(file);
    }
    return '';
  }

  private _emitChange(): void {
    if (this.onChange) this.onChange();
  }
}
