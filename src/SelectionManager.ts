// ВЫДЕЛЕНИЕ И РЕДАКТИРОВАНИЕ.
// Отвечает за: выбор объектов (клик, Shift-клик), рамку выделения (rubber-band),
// копирование/вставку, удаление, и правку текста внутри фигур (startTextEdit).
import { BoardNode } from './types';
import { NodeManager } from './NodeManager';
import { ConnectorManager } from './ConnectorManager';
import { HistoryManager } from './HistoryManager';

export class SelectionManager {
  private selected = new Set<string>();
  private container: HTMLElement;
  private nodeManager: NodeManager;
  private connectorManager: ConnectorManager;
  private history: HistoryManager;
  private selectionBox: HTMLElement | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private isSelecting = false;
  private clipboard: BoardNode[] = [];
  onSelectionChange: ((ids: string[]) => void) | null = null;

  constructor(c: HTMLElement, nm: NodeManager, cm: ConnectorManager, h: HistoryManager) {
    this.container = c;
    this.nodeManager = nm;
    this.connectorManager = cm;
    this.history = h;
  }

  select(nodeId: string, additive = false): void {
    if (!additive) {
      for (const id of this.selected) {
        if (id !== nodeId) {
          const el = this.nodeManager.getNodeElement(id);
          if (el) el.classList.remove('ib-selected');
        }
      }
      this.selected.clear();
    }
    this.selected.add(nodeId);
    const el = this.nodeManager.getNodeElement(nodeId);
    if (el) el.classList.add('ib-selected');
    this.onSelectionChange?.(this.getSelectedIds());
  }

  deselectAll(): void {
    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el) el.classList.remove('ib-selected');
    }
    this.selected.clear();
    this.onSelectionChange?.(this.getSelectedIds());
  }

  toggle(nodeId: string): void {
    if (this.selected.has(nodeId)) {
      this.selected.delete(nodeId);
      const el = this.nodeManager.getNodeElement(nodeId);
      if (el) el.classList.remove('ib-selected');
    } else {
      this.selected.add(nodeId);
      const el = this.nodeManager.getNodeElement(nodeId);
      if (el) el.classList.add('ib-selected');
    }
    this.onSelectionChange?.(this.getSelectedIds());
  }

  getSelectedIds(): string[] { return Array.from(this.selected); }
  isSelected(nodeId: string): boolean { return this.selected.has(nodeId); }

  startRubberBand(x: number, y: number): void {
    this.isSelecting = true;
    this.selectionStart = { x, y };
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'ib-selection-box';
    this.container.appendChild(this.selectionBox);
  }

  updateRubberBand(x: number, y: number): void {
    if (!this.isSelecting || !this.selectionStart || !this.selectionBox) return;
    const sx = Math.min(this.selectionStart.x, x);
    const sy = Math.min(this.selectionStart.y, y);
    this.selectionBox.style.left = `${sx}px`;
    this.selectionBox.style.top = `${sy}px`;
    this.selectionBox.style.width = `${Math.abs(x - this.selectionStart.x)}px`;
    this.selectionBox.style.height = `${Math.abs(y - this.selectionStart.y)}px`;
  }

  endRubberBand(x: number, y: number): void {
    if (!this.isSelecting || !this.selectionStart) return;
    this.isSelecting = false;
    const sx = Math.min(this.selectionStart.x, x), sy = Math.min(this.selectionStart.y, y);
    const ex = Math.max(this.selectionStart.x, x), ey = Math.max(this.selectionStart.y, y);

    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el) el.classList.remove('ib-selected');
    }
    this.selected.clear();

    for (const n of this.nodeManager.getAllNodes()) {
      if (n.x >= sx && n.y >= sy && n.x + n.width <= ex && n.y + n.height <= ey) {
        this.selected.add(n.id);
        const el = this.nodeManager.getNodeElement(n.id);
        if (el) el.classList.add('ib-selected');
      }
    }
    this.selectionBox?.remove();
    this.selectionBox = null;
    this.selectionStart = null;
    this.onSelectionChange?.(this.getSelectedIds());
  }

  copySelected(): void {
    this.clipboard = [];
    for (const id of this.selected) {
      const n = this.nodeManager.getNode(id);
      if (n) this.clipboard.push({ ...n });
    }
  }

  paste(): void {
    if (!this.clipboard.length) return;
    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el) el.classList.remove('ib-selected');
    }
    this.selected.clear();
    for (const c of this.clipboard) {
      const nn = this.nodeManager.createNode(c.type, c.x + 20, c.y + 20, c.width, c.height, {
        fillColor: c.fillColor, borderColor: c.borderColor, borderWidth: c.borderWidth,
        borderRadius: c.borderRadius, text: c.text, icon: c.icon,
      });
      this.selected.add(nn.id);
      const el = this.nodeManager.getNodeElement(nn.id);
      if (el) el.classList.add('ib-selected');
    }
    this.onSelectionChange?.(this.getSelectedIds());
  }

  deleteSelected(): void {
    for (const id of this.selected) {
      this.connectorManager.deleteConnectorsForNode(id);
      this.nodeManager.deleteNode(id);
    }
    this.selected.clear();
    this.onSelectionChange?.(this.getSelectedIds());
  }

  // ПРАВКА ТЕКСТА в фигуре: делаем span редактируемым (contentEditable), фокус,
  // выделяем текст. На blur/Enter — сохраняем новый текст в ноду. Слушатели снимаем,
  // чтобы не копились. (Перехват клавиш холста гасится в CanvasView через _isEditingText.)
  startTextEdit(nodeId: string): void {
    const el = this.nodeManager.getNodeElement(nodeId);
    if (!el) return;
    let textEl = el.querySelector('.ib-node-text') as HTMLElement | null;
    if (!textEl) { textEl = document.createElement('span'); textEl.className = 'ib-node-text'; el.appendChild(textEl); }
    textEl.contentEditable = 'true';
    // выделяем весь текст и ставим фокус, чтобы сразу можно было печатать
    textEl.focus();
    const sel = window.getSelection();
    if (sel && textEl.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const node = this.nodeManager.getNode(nodeId);
    const oldText = node?.text ?? '';
    const onKeyDown = (e: KeyboardEvent) => {
      // не даём горячим клавишам холста перехватывать ввод
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); finish(); }
    };
    const finish = () => {
      textEl!.contentEditable = 'false';
      const newText = textEl!.textContent ?? '';
      if (node && newText !== oldText) this.nodeManager.updateNode(nodeId, { text: newText });
      textEl!.removeEventListener('blur', finish);
      textEl!.removeEventListener('keydown', onKeyDown);
    };
    textEl.addEventListener('blur', finish);
    textEl.addEventListener('keydown', onKeyDown);
  }
}
