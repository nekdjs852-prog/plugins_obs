/**
 * ConnectorManager — CRUD for SVG connectors between nodes.
 * Connectors live in a shared SVG layer and automatically update
 * when nodes move.
 * Supports detaching endpoints to create free-floating anchors (Issue #3).
 */
import { Connector, LineType, ArrowHead, generateId } from './types';
import { NodeManager } from './NodeManager';
import { HistoryManager } from './HistoryManager';

interface AnchorPoint {
  x: number;
  y: number;
}

/**
 * Free-floating anchor — stores a board-space position for a detached endpoint.
 * The key is a synthetic ID stored in connector.startItemId / endItemId.
 */
interface FreeAnchor {
  x: number;
  y: number;
}

export class ConnectorManager {
  private connectors: Map<string, Connector> = new Map();
  private svgElements: Map<string, SVGElement> = new Map();
  private svgRoot: SVGSVGElement;
  private defs: SVGDefsElement;
  private nodeManager: NodeManager;
  private history: HistoryManager;

  /** Free-floating anchors for detached endpoints. */
  private freeAnchors: Map<string, FreeAnchor> = new Map();

  onChange: (() => void) | null = null;
  /** Callback: show a context menu at screen position with items. */
  onContextMenu: ((x: number, y: number, items: { label: string; action: () => void }[]) => void) | null = null;

  constructor(svgRoot: SVGSVGElement, nodeManager: NodeManager, history: HistoryManager) {
    this.svgRoot = svgRoot;
    this.nodeManager = nodeManager;
    this.history = history;

    // Create <defs> for markers (arrowheads etc.)
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svgRoot.prepend(this.defs);
    this._ensureMarkers();

    // Right-click on connector → context menu (Issue #3)
    this.svgRoot.addEventListener('contextmenu', (e) => this._onContextMenu(e));
  }

  // ─── CRUD ────────────────────────────────────────────────────

  createConnector(
    startItemId: string,
    endItemId: string,
    opts: Partial<Connector> = {},
  ): Connector {
    const connector: Connector = {
      id: generateId(),
      startItemId,
      endItemId,
      lineType: opts.lineType ?? 'quadratic',
      color: opts.color ?? 'var(--text-muted)',
      width: opts.width ?? 2,
      arrowStart: opts.arrowStart ?? 'none',
      arrowEnd: opts.arrowEnd ?? 'arrow',
      dashed: opts.dashed ?? false,
    };

    this.connectors.set(connector.id, connector);
    this._renderConnector(connector);

    this.history.push({
      type: 'create-connector',
      undo: () => this.deleteConnector(connector.id, true),
      redo: () => {
        this.connectors.set(connector.id, connector);
        this._renderConnector(connector);
        this._emitChange();
      },
    });

    this._emitChange();
    return connector;
  }

  updateConnector(id: string, changes: Partial<Connector>, skipHistory = false): void {
    const c = this.connectors.get(id);
    if (!c) return;
    const prev = { ...c };
    Object.assign(c, changes);
    this._updateSvgElement(c);

    if (!skipHistory) {
      this.history.push({
        type: 'update-connector',
        undo: () => {
          Object.assign(c, prev);
          this._updateSvgElement(c);
          this._emitChange();
        },
        redo: () => {
          Object.assign(c, changes);
          this._updateSvgElement(c);
          this._emitChange();
        },
      });
    }
    this._emitChange();
  }

  deleteConnector(id: string, skipHistory = false): void {
    const c = this.connectors.get(id);
    if (!c) return;
    const svg = this.svgElements.get(id);
    if (svg) {
      svg.remove();
      this.svgElements.delete(id);
    }
    this.connectors.delete(id);

    if (!skipHistory) {
      this.history.push({
        type: 'delete-connector',
        undo: () => {
          this.connectors.set(c.id, c);
          this._renderConnector(c);
          this._emitChange();
        },
        redo: () => this.deleteConnector(c.id, true),
      });
    }
    this._emitChange();
  }

  getConnector(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getAllConnectors(): Connector[] {
    return Array.from(this.connectors.values());
  }

  /** Delete all connectors attached to a given node id. */
  deleteConnectorsForNode(nodeId: string): void {
    for (const c of this.connectors.values()) {
      if (c.startItemId === nodeId || c.endItemId === nodeId) {
        this.deleteConnector(c.id);
      }
    }
  }

  // ─── Detach / reconnect (Issue #3) ──────────────────────────

  /**
   * Detach one endpoint of a connector, creating a free-floating anchor
   * at the current position of the previously-attached node's centre.
   */
  detachEnd(connectorId: string, which: 'start' | 'end'): void {
    const c = this.connectors.get(connectorId);
    if (!c) return;
    const nodeId = which === 'start' ? c.startItemId : c.endItemId;
    const pos = this._anchor(nodeId);
    if (!pos) return;

    const freeId = 'free-' + generateId();
    this.freeAnchors.set(freeId, { x: pos.x, y: pos.y });

    const prev = which === 'start' ? c.startItemId : c.endItemId;
    if (which === 'start') {
      c.startItemId = freeId;
    } else {
      c.endItemId = freeId;
    }
    this._updateSvgElement(c);

    this.history.push({
      type: 'detach-connector',
      undo: () => {
        if (which === 'start') c.startItemId = prev;
        else c.endItemId = prev;
        this.freeAnchors.delete(freeId);
        this._updateSvgElement(c);
        this._emitChange();
      },
      redo: () => {
        this.freeAnchors.set(freeId, { x: pos.x, y: pos.y });
        if (which === 'start') c.startItemId = freeId;
        else c.endItemId = freeId;
        this._updateSvgElement(c);
        this._emitChange();
      },
    });
    this._emitChange();
  }

  /** Reconnect a detached endpoint to a node. */
  reconnectEnd(connectorId: string, which: 'start' | 'end', nodeId: string): void {
    const c = this.connectors.get(connectorId);
    if (!c) return;
    const oldId = which === 'start' ? c.startItemId : c.endItemId;
    if (which === 'start') c.startItemId = nodeId;
    else c.endItemId = nodeId;
    this.freeAnchors.delete(oldId);
    this._updateSvgElement(c);
    this._emitChange();
  }

  /** Check if an endpoint references a free anchor (detached). */
  isFreeAnchor(itemId: string): boolean {
    return this.freeAnchors.has(itemId);
  }

  // ─── Refresh all connectors (call after node move) ──────────

  refreshAll(): void {
    for (const c of this.connectors.values()) {
      this._updateSvgElement(c);
    }
  }

  /** Refresh only connectors attached to a node. */
  refreshForNode(nodeId: string): void {
    for (const c of this.connectors.values()) {
      if (c.startItemId === nodeId || c.endItemId === nodeId) {
        this._updateSvgElement(c);
      }
    }
  }

  // ─── Context menu (Issue #3) ────────────────────────────────

  private _onContextMenu(e: Event): void {
    const me = e as MouseEvent;
    const hit = (me.target as Element)?.closest('.ib-connector') as SVGElement | null;
    if (!hit) return;
    me.preventDefault();
    me.stopPropagation();
    const cid = hit.dataset.connectorId;
    if (!cid) return;
    const c = this.connectors.get(cid);
    if (!c) return;

    const items: { label: string; action: () => void }[] = [];

    // Detach start
    if (!this.isFreeAnchor(c.startItemId)) {
      items.push({ label: 'Detach start', action: () => this.detachEnd(cid, 'start') });
    }
    // Detach end
    if (!this.isFreeAnchor(c.endItemId)) {
      items.push({ label: 'Detach end', action: () => this.detachEnd(cid, 'end') });
    }
    // Line type toggles
    const nextType: Record<string, LineType> = { straight: 'quadratic', quadratic: 'orthogonal', orthogonal: 'straight' };
    items.push({
      label: `Style: ${c.lineType} → ${nextType[c.lineType]}`,
      action: () => this.updateConnector(cid, { lineType: nextType[c.lineType] }),
    });
    // Toggle dashed
    items.push({ label: c.dashed ? 'Solid line' : 'Dashed line', action: () => this.updateConnector(cid, { dashed: !c.dashed }) });
    // Delete
    items.push({ label: 'Delete connector', action: () => this.deleteConnector(cid) });

    if (this.onContextMenu) {
      this.onContextMenu(me.clientX, me.clientY, items);
    }
  }

  // ─── Serialisation ──────────────────────────────────────────

  serialise(): Connector[] {
    return this.getAllConnectors();
  }

  deserialise(data: Connector[]): void {
    this.clear();
    for (const c of data) {
      this.connectors.set(c.id, c);
      this._renderConnector(c);
    }
  }

  clear(): void {
    for (const el of this.svgElements.values()) {
      el.remove();
    }
    this.connectors.clear();
    this.svgElements.clear();
    this.freeAnchors.clear();
  }

  // ─── SVG rendering ─────────────────────────────────────────

  /** Compute the centre anchor point of a node (board coordinates). */
  private _anchor(nodeId: string): AnchorPoint | null {
    // Check free anchors first (detached endpoints)
    const free = this.freeAnchors.get(nodeId);
    if (free) return { x: free.x, y: free.y };
    const node = this.nodeManager.getNode(nodeId);
    if (!node) return null;
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }

  /** Compute edge anchor — the point on the border of a rectangle closest
   *  to the opposite anchor. */
  private _edgeAnchor(nodeId: string, targetX: number, targetY: number): AnchorPoint {
    // Free anchor — just return its position directly
    const free = this.freeAnchors.get(nodeId);
    if (free) return { x: free.x, y: free.y };

    const node = this.nodeManager.getNode(nodeId);
    if (!node) return { x: targetX, y: targetY };

    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const hw = node.width / 2;
    const hh = node.height / 2;

    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    // Scale so it hits the edge
    const scaleX = hw / Math.abs(dx || 1);
    const scaleY = hh / Math.abs(dy || 1);
    const scale = Math.min(scaleX, scaleY);

    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  private _renderConnector(c: Connector): void {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.dataset.connectorId = c.id;
    g.classList.add('ib-connector');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('ib-connector-path');

    // Hit area for easier selection
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.classList.add('ib-connector-hit');
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '14');
    hitPath.setAttribute('fill', 'none');

    g.appendChild(hitPath);
    g.appendChild(path);
    this.svgRoot.appendChild(g);
    this.svgElements.set(c.id, g);

    this._updateSvgElement(c);
  }

  private _updateSvgElement(c: Connector): void {
    const g = this.svgElements.get(c.id);
    if (!g) return;
    const path = g.querySelector('.ib-connector-path') as SVGPathElement | null;
    const hitPath = g.querySelector('.ib-connector-hit') as SVGPathElement | null;
    if (!path) return;

    const startCenter = this._anchor(c.startItemId);
    const endCenter = this._anchor(c.endItemId);
    if (!startCenter || !endCenter) return;

    const start = this._edgeAnchor(c.startItemId, endCenter.x, endCenter.y);
    const end = this._edgeAnchor(c.endItemId, startCenter.x, startCenter.y);

    const d = this._buildPath(c.lineType, start, end);
    path.setAttribute('d', d);
    path.setAttribute('stroke', c.color);
    path.setAttribute('stroke-width', String(c.width));
    path.setAttribute('fill', 'none');
    if (c.dashed) {
      path.setAttribute('stroke-dasharray', '8 4');
    } else {
      path.removeAttribute('stroke-dasharray');
    }

    // Markers
    if (c.arrowEnd === 'arrow') {
      path.setAttribute('marker-end', 'url(#ib-arrowhead)');
    } else {
      path.removeAttribute('marker-end');
    }
    if (c.arrowStart === 'arrow') {
      path.setAttribute('marker-start', 'url(#ib-arrowhead-start)');
    } else {
      path.removeAttribute('marker-start');
    }

    if (hitPath) hitPath.setAttribute('d', d);
  }

  /** Build an SVG path string for the given line type. */
  private _buildPath(lineType: LineType, start: AnchorPoint, end: AnchorPoint): string {
    switch (lineType) {
      case 'straight':
        return `M${start.x},${start.y} L${end.x},${end.y}`;
      case 'quadratic': {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        // Perpendicular offset for a nice curve
        const offset = Math.min(Math.hypot(dx, dy) * 0.15, 60);
        const cx = mx - (dy / Math.hypot(dx, dy)) * offset;
        const cy = my + (dx / Math.hypot(dx, dy)) * offset;
        return `M${start.x},${start.y} Q${cx},${cy} ${end.x},${end.y}`;
      }
      case 'orthogonal': {
        const midX = (start.x + end.x) / 2;
        return `M${start.x},${start.y} L${midX},${start.y} L${midX},${end.y} L${end.x},${end.y}`;
      }
      default:
        return `M${start.x},${start.y} L${end.x},${end.y}`;
    }
  }

  /** Ensure SVG marker definitions exist. */
  private _ensureMarkers(): void {
    // Arrowhead end
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    m.setAttribute('id', 'ib-arrowhead');
    m.setAttribute('markerWidth', '10');
    m.setAttribute('markerHeight', '7');
    m.setAttribute('refX', '10');
    m.setAttribute('refY', '3.5');
    m.setAttribute('orient', 'auto');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '0 0, 10 3.5, 0 7');
    poly.setAttribute('fill', 'var(--text-muted)');
    m.appendChild(poly);
    this.defs.appendChild(m);

    // Arrowhead start (reversed)
    const ms = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    ms.setAttribute('id', 'ib-arrowhead-start');
    ms.setAttribute('markerWidth', '10');
    ms.setAttribute('markerHeight', '7');
    ms.setAttribute('refX', '0');
    ms.setAttribute('refY', '3.5');
    ms.setAttribute('orient', 'auto-start-reverse');
    const polys = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polys.setAttribute('points', '10 0, 0 3.5, 10 7');
    polys.setAttribute('fill', 'var(--text-muted)');
    ms.appendChild(polys);
    this.defs.appendChild(ms);
  }

  private _emitChange(): void {
    if (this.onChange) this.onChange();
  }
}
