import { LayerObject } from './types';

export interface LayersPanelHost {
  getLayerObjects(): LayerObject[];
  reorderTo(orderedTopToBottom: string[]): void;
  setObjectHidden(id: string, hidden: boolean): void;
  setObjectName(id: string, name: string): void;
  selectObject(id: string): void;
  getSelectedIds(): string[];
}

// иконка по типу объекта
const ICONS: Record<string, string> = {
  rectangle: '▭',
  ellipse: '◯',
  text: 'T',
  image: '🖼',
  group: '▢',
  pencil: '✎',
  marker: '🖊',
  connector: '↘',
};

const EYE_OPEN = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="9" cy="9" r="2.2"/></svg>`;
const EYE_CLOSED = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l14 10"/><path d="M6.5 5.2A8.6 8.6 0 0 1 9 5c5 0 8 6 8 6a14 14 0 0 1-2.4 2.8M4.2 6.6A14 14 0 0 0 1 11s3 6 8 6a8 8 0 0 0 2.4-.4"/></svg>`;

export class LayersPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private host: LayersPanelHost;
  private visible = false;
  private dragId: string | null = null;

  constructor(parent: HTMLElement, host: LayersPanelHost) {
    this.host = host;

    this.el = document.createElement('div');
    this.el.className = 'ib-layers-panel';
    this.el.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'ib-layers-header';
    header.textContent = 'Слои';
    this.el.appendChild(header);

    this.listEl = document.createElement('div');
    this.listEl.className = 'ib-layers-list';
    this.el.appendChild(this.listEl);

    parent.appendChild(this.el);

    // не отдаём события холсту (выделение/рисование)
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('wheel', (e) => e.stopPropagation());
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'flex' : 'none';
    if (this.visible) this.refresh();
  }

  isVisible(): boolean { return this.visible; }

  destroy(): void { this.el.remove(); }

  refresh(): void {
    if (!this.visible) return;
    const selected = new Set(this.host.getSelectedIds());
    const objects = this.host.getLayerObjects(); // уже отсортированы сверху-вниз
    this.listEl.empty();

    if (objects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ib-layers-empty';
      empty.textContent = 'Пусто';
      this.listEl.appendChild(empty);
      return;
    }

    for (const obj of objects) {
      this.listEl.appendChild(this._buildRow(obj, selected.has(obj.id)));
    }
  }

  private _buildRow(obj: LayerObject, isSelected: boolean): HTMLElement {
    const row = document.createElement('div');
    row.className = 'ib-layer-row';
    if (isSelected) row.classList.add('ib-layer-row--selected');
    if (obj.hidden) row.classList.add('ib-layer-row--hidden');
    row.dataset.layerId = obj.id;
    row.draggable = true;

    // глаз — скрыть/показать
    const eye = document.createElement('button');
    eye.className = 'ib-layer-eye';
    eye.innerHTML = obj.hidden ? EYE_CLOSED : EYE_OPEN;
    eye.title = obj.hidden ? 'Показать' : 'Скрыть';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      this.host.setObjectHidden(obj.id, !obj.hidden);
      this.refresh();
    });
    row.appendChild(eye);

    // иконка типа
    const icon = document.createElement('span');
    icon.className = 'ib-layer-icon';
    icon.textContent = ICONS[obj.subtype ?? ''] ?? '◆';
    row.appendChild(icon);

    // имя
    const name = document.createElement('span');
    name.className = 'ib-layer-name';
    name.textContent = obj.name;
    name.title = obj.name;
    row.appendChild(name);

    // выбор объекта по клику
    row.addEventListener('click', () => {
      this.host.selectObject(obj.id);
      this.refresh();
    });

    // переименование по двойному клику
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._startRename(name, obj);
    });

    // drag & drop порядок
    row.addEventListener('dragstart', (e) => {
      this.dragId = obj.id;
      row.classList.add('ib-layer-row--dragging');
      e.dataTransfer?.setData('text/plain', obj.id);
    });
    row.addEventListener('dragend', () => {
      this.dragId = null;
      row.classList.remove('ib-layer-row--dragging');
      this.listEl.querySelectorAll('.ib-layer-row--dragover')
        .forEach((r) => r.classList.remove('ib-layer-row--dragover'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('ib-layer-row--dragover');
    });
    row.addEventListener('dragleave', () => row.classList.remove('ib-layer-row--dragover'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('ib-layer-row--dragover');
      if (this.dragId && this.dragId !== obj.id) {
        this._reorder(this.dragId, obj.id);
      }
    });

    return row;
  }

  private _startRename(nameEl: HTMLElement, obj: LayerObject): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ib-layer-rename-input';
    input.value = obj.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (commit: boolean) => {
      const val = input.value.trim();
      if (commit && val) this.host.setObjectName(obj.id, val);
      input.removeEventListener('blur', onBlur);
      this.refresh();
    };
    const onBlur = () => finish(true);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  }

  // перемещает dragId на позицию targetId в порядке сверху-вниз
  private _reorder(dragId: string, targetId: string): void {
    const order = this.host.getLayerObjects().map((o) => o.id);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragId);
    this.host.reorderTo(order);
    this.refresh();
  }
}
