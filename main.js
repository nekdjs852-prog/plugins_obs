var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => InteractiveBoardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  defaultNodeFill: "var(--background-secondary)",
  defaultNodeBorder: "var(--background-modifier-border)",
  defaultConnectorColor: "var(--text-muted)",
  gridSize: 20,
  snapToGrid: true,
  autosaveIntervalMs: 5e3,
  saveTempStrokes: false,
  laserParams: {
    color: "#ff3333",
    width: 4,
    duration: 1500,
    fadeCurve: "exp",
    trailLength: 80,
    glow: 12
  }
};
function generateId() {
  return "ib-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// src/CanvasView.ts
var import_obsidian4 = require("obsidian");

// src/HistoryManager.ts
var HistoryManager = class {
  constructor() {
    this.undoStack = [];
    // выполненные действия (можно отменить)
    this.redoStack = [];
    // отменённые действия (можно повторить)
    this.maxSize = 200;
  }
  // лимит истории, чтобы не росла бесконечно
  // записать новое действие; новое действие очищает стек redo (ветка истории сбрасывается)
  push(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }
  // отменить последнее действие и переложить его в redo
  undo() {
    const action = this.undoStack.pop();
    if (!action)
      return;
    action.undo();
    this.redoStack.push(action);
  }
  // повторить последнее отменённое и вернуть его в undo
  redo() {
    const action = this.redoStack.pop();
    if (!action)
      return;
    action.redo();
    this.undoStack.push(action);
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
};

// src/NodeManager.ts
var import_obsidian = require("obsidian");
var DEFAULT_NODE_NAMES = {
  rectangle: "\u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A",
  ellipse: "\u042D\u043B\u043B\u0438\u043F\u0441",
  text: "\u0422\u0435\u043A\u0441\u0442",
  group: "\u0413\u0440\u0443\u043F\u043F\u0430",
  image: "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435"
};
var NodeManager = class {
  constructor(container, history, app) {
    this.nodes = /* @__PURE__ */ new Map();
    this.nodeElements = /* @__PURE__ */ new Map();
    this.nextZIndex = 1;
    this.onChange = null;
    /** Внешний аллокатор единого z-порядка (общий для нод/штрихов/коннекторов). */
    this.zAlloc = null;
    this.container = container;
    this.history = history;
    this.app = app;
  }
  createNode(type, x, y, width = 160, height = 80, extra = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const node = {
      id: generateId(),
      type,
      x,
      y,
      width,
      height,
      fillColor: type === "text" ? "transparent" : (_a = extra.fillColor) != null ? _a : "var(--background-secondary)",
      borderColor: type === "text" ? "transparent" : (_b = extra.borderColor) != null ? _b : "var(--background-modifier-border)",
      borderWidth: type === "text" ? 0 : (_c = extra.borderWidth) != null ? _c : 1,
      borderRadius: type === "ellipse" ? 9999 : (_d = extra.borderRadius) != null ? _d : 6,
      text: (_e = extra.text) != null ? _e : "",
      icon: (_f = extra.icon) != null ? _f : "",
      imagePath: extra.imagePath,
      vaultImagePath: extra.vaultImagePath,
      fontSize: (_g = extra.fontSize) != null ? _g : 14,
      fontFamily: (_h = extra.fontFamily) != null ? _h : "Inter, system-ui, sans-serif",
      textColor: extra.textColor,
      zIndex: (_i = extra.zIndex) != null ? _i : this.zAlloc ? this.zAlloc() : this.nextZIndex++,
      name: (_j = extra.name) != null ? _j : DEFAULT_NODE_NAMES[type],
      hidden: (_k = extra.hidden) != null ? _k : false,
      children: type === "group" ? [] : void 0
    };
    this.nodes.set(node.id, node);
    this._renderNode(node);
    this.history.push({
      type: "create-node",
      undo: () => this.deleteNode(node.id, true),
      redo: () => {
        this.nodes.set(node.id, node);
        this._renderNode(node);
        this._emitChange();
      }
    });
    this._emitChange();
    return node;
  }
  updateNode(id, changes, skipHistory = false) {
    const node = this.nodes.get(id);
    if (!node)
      return;
    const prev = { ...node };
    Object.assign(node, changes);
    this._updateNodeElement(node);
    if (!skipHistory) {
      this.history.push({
        type: "update-node",
        undo: () => {
          Object.assign(node, prev);
          this._updateNodeElement(node);
          this._emitChange();
        },
        redo: () => {
          Object.assign(node, changes);
          this._updateNodeElement(node);
          this._emitChange();
        }
      });
    }
    this._emitChange();
  }
  deleteNode(id, skipHistory = false) {
    const node = this.nodes.get(id);
    if (!node)
      return;
    const el = this.nodeElements.get(id);
    if (el) {
      el.remove();
      this.nodeElements.delete(id);
    }
    this.nodes.delete(id);
    if (!skipHistory) {
      this.history.push({
        type: "delete-node",
        undo: () => {
          this.nodes.set(node.id, node);
          this._renderNode(node);
          this._emitChange();
        },
        redo: () => this.deleteNode(node.id, true)
      });
    }
    this._emitChange();
  }
  getNode(id) {
    return this.nodes.get(id);
  }
  // ─── Layer API ──────────────────────────────────────────────
  setZIndex(id, z) {
    const node = this.nodes.get(id);
    if (!node)
      return;
    node.zIndex = z;
    const el = this.nodeElements.get(id);
    if (el)
      el.style.zIndex = String(z);
    this._emitChange();
  }
  setHidden(id, hidden) {
    const node = this.nodes.get(id);
    if (!node)
      return;
    node.hidden = hidden;
    const el = this.nodeElements.get(id);
    if (el)
      el.style.display = hidden ? "none" : "";
    this._emitChange();
  }
  setName(id, name) {
    const node = this.nodes.get(id);
    if (!node)
      return;
    node.name = name;
    this._emitChange();
  }
  getLayerObjects() {
    return this.getAllNodes().map((n) => {
      var _a, _b;
      return {
        id: n.id,
        kind: "node",
        name: (_b = (_a = n.name) != null ? _a : DEFAULT_NODE_NAMES[n.type]) != null ? _b : "\u041E\u0431\u044A\u0435\u043A\u0442",
        zIndex: n.zIndex,
        hidden: !!n.hidden,
        subtype: n.type
      };
    });
  }
  getAllNodes() {
    return Array.from(this.nodes.values());
  }
  getNodeElement(id) {
    return this.nodeElements.get(id);
  }
  serialise() {
    return this.getAllNodes();
  }
  deserialise(data) {
    var _a;
    this.clear();
    for (const node of data) {
      if (node.type === "image" && node.vaultImagePath) {
        node.imagePath = this._resolveVaultImagePath(node.vaultImagePath);
      }
      if (node.name === void 0)
        node.name = (_a = DEFAULT_NODE_NAMES[node.type]) != null ? _a : "\u041E\u0431\u044A\u0435\u043A\u0442";
      if (node.hidden === void 0)
        node.hidden = false;
      this.nodes.set(node.id, node);
      if (node.zIndex >= this.nextZIndex) {
        this.nextZIndex = node.zIndex + 1;
      }
      this._renderNode(node);
    }
  }
  clear() {
    for (const el of this.nodeElements.values()) {
      el.remove();
    }
    this.nodes.clear();
    this.nodeElements.clear();
    this.nextZIndex = 1;
  }
  _renderNode(node) {
    const el = document.createElement("div");
    el.className = "ib-node";
    el.dataset.nodeId = node.id;
    el.dataset.nodeType = node.type;
    this._applyNodeStyles(el, node);
    if (node.type === "text") {
      const span = document.createElement("span");
      span.className = "ib-node-text";
      span.textContent = node.text;
      this._applyTextStyles(span, node);
      el.appendChild(span);
    } else if (node.type === "image" && node.imagePath) {
      const img = document.createElement("img");
      img.className = "ib-node-image";
      img.src = node.imagePath;
      img.draggable = false;
      el.appendChild(img);
    } else if (node.text) {
      const span = document.createElement("span");
      span.className = "ib-node-text";
      span.textContent = node.text;
      this._applyTextStyles(span, node);
      el.appendChild(span);
    }
    const directions = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    for (const dir of directions) {
      const handle = document.createElement("div");
      handle.className = `ib-resize-handle ib-resize-handle--${dir}`;
      handle.dataset.resizeDir = dir;
      el.appendChild(handle);
    }
    this.container.appendChild(el);
    this.nodeElements.set(node.id, el);
  }
  _applyNodeStyles(el, node) {
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.height = `${node.height}px`;
    el.style.backgroundColor = node.fillColor;
    el.style.border = `${node.borderWidth}px solid ${node.borderColor}`;
    el.style.borderRadius = `${node.borderRadius}px`;
    el.style.zIndex = String(node.zIndex);
    el.style.display = node.hidden ? "none" : "";
  }
  _updateNodeElement(node) {
    const el = this.nodeElements.get(node.id);
    if (!el)
      return;
    this._applyNodeStyles(el, node);
    const textEl = el.querySelector(".ib-node-text");
    if (textEl) {
      textEl.textContent = node.text;
      this._applyTextStyles(textEl, node);
    }
    const imgEl = el.querySelector(".ib-node-image");
    if (imgEl && node.imagePath) {
      imgEl.src = node.imagePath;
    }
  }
  _applyTextStyles(el, node) {
    if (node.fontSize)
      el.style.fontSize = `${node.fontSize}px`;
    if (node.fontFamily)
      el.style.fontFamily = node.fontFamily;
    if (node.textColor) {
      el.style.color = node.textColor;
    } else {
      el.style.color = "";
    }
  }
  _resolveVaultImagePath(vaultPath) {
    const file = this.app.vault.getAbstractFileByPath(vaultPath);
    if (file instanceof import_obsidian.TFile) {
      return this.app.vault.getResourcePath(file);
    }
    return "";
  }
  _emitChange() {
    if (this.onChange)
      this.onChange();
  }
};

// src/ConnectorManager.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var ConnectorManager = class {
  constructor(worldLayer, defsSvg, nodeManager, history) {
    this.connectors = /* @__PURE__ */ new Map();
    // per-connector обёртка <svg>, живёт в worldLayer, порядок по z-index
    this.svgElements = /* @__PURE__ */ new Map();
    this.onChange = null;
    /** Внешний аллокатор единого z-порядка. */
    this.zAlloc = null;
    /** Free-floating anchors for detached endpoints. */
    this.freeAnchors = /* @__PURE__ */ new Map();
    /** Callback: show a context menu at screen position with items. */
    this.onContextMenu = null;
    this.worldLayer = worldLayer;
    this.defsSvg = defsSvg;
    this.nodeManager = nodeManager;
    this.history = history;
    this.defs = document.createElementNS(SVG_NS, "defs");
    this.defsSvg.appendChild(this.defs);
    this._ensureMarkers();
    this.worldLayer.addEventListener("contextmenu", (e) => this._onContextMenu(e));
  }
  // ─── CRUD ────────────────────────────────────────────────────
  createConnector(startItemId, endItemId, opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const connector = {
      id: generateId(),
      startItemId,
      endItemId,
      lineType: (_a = opts.lineType) != null ? _a : "quadratic",
      color: (_b = opts.color) != null ? _b : "var(--text-muted)",
      width: (_c = opts.width) != null ? _c : 2,
      arrowStart: (_d = opts.arrowStart) != null ? _d : "none",
      arrowEnd: (_e = opts.arrowEnd) != null ? _e : "arrow",
      dashed: (_f = opts.dashed) != null ? _f : false,
      zIndex: (_g = opts.zIndex) != null ? _g : this.zAlloc ? this.zAlloc() : this.connectors.size + 1,
      name: (_h = opts.name) != null ? _h : "\u041A\u043E\u043D\u043D\u0435\u043A\u0442\u043E\u0440",
      hidden: (_i = opts.hidden) != null ? _i : false
    };
    this.connectors.set(connector.id, connector);
    this._renderConnector(connector);
    this.history.push({
      type: "create-connector",
      undo: () => this.deleteConnector(connector.id, true),
      redo: () => {
        this.connectors.set(connector.id, connector);
        this._renderConnector(connector);
        this._emitChange();
      }
    });
    this._emitChange();
    return connector;
  }
  updateConnector(id, changes, skipHistory = false) {
    const c = this.connectors.get(id);
    if (!c)
      return;
    const prev = { ...c };
    Object.assign(c, changes);
    this._updateSvgElement(c);
    if (!skipHistory) {
      this.history.push({
        type: "update-connector",
        undo: () => {
          Object.assign(c, prev);
          this._updateSvgElement(c);
          this._emitChange();
        },
        redo: () => {
          Object.assign(c, changes);
          this._updateSvgElement(c);
          this._emitChange();
        }
      });
    }
    this._emitChange();
  }
  deleteConnector(id, skipHistory = false) {
    const c = this.connectors.get(id);
    if (!c)
      return;
    const svg = this.svgElements.get(id);
    if (svg) {
      svg.remove();
      this.svgElements.delete(id);
    }
    this.connectors.delete(id);
    if (!skipHistory) {
      this.history.push({
        type: "delete-connector",
        undo: () => {
          this.connectors.set(c.id, c);
          this._renderConnector(c);
          this._emitChange();
        },
        redo: () => this.deleteConnector(c.id, true)
      });
    }
    this._emitChange();
  }
  getConnector(id) {
    return this.connectors.get(id);
  }
  getAllConnectors() {
    return Array.from(this.connectors.values());
  }
  // ─── Layer API ──────────────────────────────────────────────
  setZIndex(id, z) {
    const c = this.connectors.get(id);
    if (!c)
      return;
    c.zIndex = z;
    const svg = this.svgElements.get(id);
    if (svg)
      svg.style.zIndex = String(z);
    this._emitChange();
  }
  setHidden(id, hidden) {
    const c = this.connectors.get(id);
    if (!c)
      return;
    c.hidden = hidden;
    const svg = this.svgElements.get(id);
    if (svg)
      svg.style.display = hidden ? "none" : "";
    this._emitChange();
  }
  setName(id, name) {
    const c = this.connectors.get(id);
    if (!c)
      return;
    c.name = name;
    this._emitChange();
  }
  getLayerObjects() {
    return this.getAllConnectors().map((c) => {
      var _a, _b;
      return {
        id: c.id,
        kind: "connector",
        name: (_a = c.name) != null ? _a : "\u041A\u043E\u043D\u043D\u0435\u043A\u0442\u043E\u0440",
        zIndex: (_b = c.zIndex) != null ? _b : 0,
        hidden: !!c.hidden,
        subtype: "connector"
      };
    });
  }
  /** Delete all connectors attached to a given node id. */
  deleteConnectorsForNode(nodeId) {
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
  detachEnd(connectorId, which) {
    const c = this.connectors.get(connectorId);
    if (!c)
      return;
    const nodeId = which === "start" ? c.startItemId : c.endItemId;
    const pos = this._anchor(nodeId);
    if (!pos)
      return;
    const freeId = "free-" + generateId();
    this.freeAnchors.set(freeId, { x: pos.x, y: pos.y });
    const prev = which === "start" ? c.startItemId : c.endItemId;
    if (which === "start") {
      c.startItemId = freeId;
    } else {
      c.endItemId = freeId;
    }
    this._updateSvgElement(c);
    this.history.push({
      type: "detach-connector",
      undo: () => {
        if (which === "start")
          c.startItemId = prev;
        else
          c.endItemId = prev;
        this.freeAnchors.delete(freeId);
        this._updateSvgElement(c);
        this._emitChange();
      },
      redo: () => {
        this.freeAnchors.set(freeId, { x: pos.x, y: pos.y });
        if (which === "start")
          c.startItemId = freeId;
        else
          c.endItemId = freeId;
        this._updateSvgElement(c);
        this._emitChange();
      }
    });
    this._emitChange();
  }
  /** Reconnect a detached endpoint to a node. */
  reconnectEnd(connectorId, which, nodeId) {
    const c = this.connectors.get(connectorId);
    if (!c)
      return;
    const oldId = which === "start" ? c.startItemId : c.endItemId;
    if (which === "start")
      c.startItemId = nodeId;
    else
      c.endItemId = nodeId;
    this.freeAnchors.delete(oldId);
    this._updateSvgElement(c);
    this._emitChange();
  }
  /** Check if an endpoint references a free anchor (detached). */
  isFreeAnchor(itemId) {
    return this.freeAnchors.has(itemId);
  }
  // ─── Refresh all connectors (call after node move) ──────────
  refreshAll() {
    for (const c of this.connectors.values()) {
      this._updateSvgElement(c);
    }
  }
  /** Refresh only connectors attached to a node. */
  refreshForNode(nodeId) {
    for (const c of this.connectors.values()) {
      if (c.startItemId === nodeId || c.endItemId === nodeId) {
        this._updateSvgElement(c);
      }
    }
  }
  // ─── Context menu (Issue #3) ────────────────────────────────
  _onContextMenu(e) {
    var _a;
    const me = e;
    const hit = (_a = me.target) == null ? void 0 : _a.closest(".ib-connector");
    if (!hit)
      return;
    me.preventDefault();
    me.stopPropagation();
    const cid = hit.dataset.connectorId;
    if (!cid)
      return;
    const c = this.connectors.get(cid);
    if (!c)
      return;
    const items = [];
    if (!this.isFreeAnchor(c.startItemId)) {
      items.push({ label: "Detach start", action: () => this.detachEnd(cid, "start") });
    }
    if (!this.isFreeAnchor(c.endItemId)) {
      items.push({ label: "Detach end", action: () => this.detachEnd(cid, "end") });
    }
    const nextType = { straight: "quadratic", quadratic: "orthogonal", orthogonal: "straight" };
    items.push({
      label: `Style: ${c.lineType} \u2192 ${nextType[c.lineType]}`,
      action: () => this.updateConnector(cid, { lineType: nextType[c.lineType] })
    });
    items.push({ label: c.dashed ? "Solid line" : "Dashed line", action: () => this.updateConnector(cid, { dashed: !c.dashed }) });
    items.push({ label: "Delete connector", action: () => this.deleteConnector(cid) });
    if (this.onContextMenu) {
      this.onContextMenu(me.clientX, me.clientY, items);
    }
  }
  // ─── Serialisation ──────────────────────────────────────────
  serialise() {
    return this.getAllConnectors();
  }
  deserialise(data) {
    this.clear();
    let fallbackZ = 1;
    for (const c of data) {
      if (c.zIndex === void 0)
        c.zIndex = -1e6 + fallbackZ++;
      if (c.name === void 0)
        c.name = "\u041A\u043E\u043D\u043D\u0435\u043A\u0442\u043E\u0440";
      if (c.hidden === void 0)
        c.hidden = false;
      this.connectors.set(c.id, c);
      this._renderConnector(c);
    }
  }
  clear() {
    for (const el of this.svgElements.values()) {
      el.remove();
    }
    this.connectors.clear();
    this.svgElements.clear();
    this.freeAnchors.clear();
  }
  // ─── SVG rendering ─────────────────────────────────────────
  /** Compute the centre anchor point of a node (board coordinates). */
  _anchor(nodeId) {
    const free = this.freeAnchors.get(nodeId);
    if (free)
      return { x: free.x, y: free.y };
    const node = this.nodeManager.getNode(nodeId);
    if (!node)
      return null;
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
  /** Compute edge anchor — the point on the border of a rectangle closest
   *  to the opposite anchor. */
  _edgeAnchor(nodeId, targetX, targetY) {
    const free = this.freeAnchors.get(nodeId);
    if (free)
      return { x: free.x, y: free.y };
    const node = this.nodeManager.getNode(nodeId);
    if (!node)
      return { x: targetX, y: targetY };
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const hw = node.width / 2;
    const hh = node.height / 2;
    if (dx === 0 && dy === 0)
      return { x: cx, y: cy };
    const scaleX = hw / Math.abs(dx || 1);
    const scaleY = hh / Math.abs(dy || 1);
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
  }
  _renderConnector(c) {
    var _a;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("ib-connector-svg");
    const g = document.createElementNS(SVG_NS, "g");
    g.dataset.connectorId = c.id;
    g.classList.add("ib-connector");
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("ib-connector-path");
    const hitPath = document.createElementNS(SVG_NS, "path");
    hitPath.classList.add("ib-connector-hit");
    hitPath.setAttribute("stroke", "transparent");
    hitPath.setAttribute("stroke-width", "14");
    hitPath.setAttribute("fill", "none");
    g.appendChild(hitPath);
    g.appendChild(path);
    svg.appendChild(g);
    svg.style.zIndex = String((_a = c.zIndex) != null ? _a : 0);
    svg.style.display = c.hidden ? "none" : "";
    this.worldLayer.appendChild(svg);
    this.svgElements.set(c.id, svg);
    this._updateSvgElement(c);
  }
  _updateSvgElement(c) {
    const svg = this.svgElements.get(c.id);
    if (!svg)
      return;
    const path = svg.querySelector(".ib-connector-path");
    const hitPath = svg.querySelector(".ib-connector-hit");
    if (!path)
      return;
    const startCenter = this._anchor(c.startItemId);
    const endCenter = this._anchor(c.endItemId);
    if (!startCenter || !endCenter)
      return;
    const start = this._edgeAnchor(c.startItemId, endCenter.x, endCenter.y);
    const end = this._edgeAnchor(c.endItemId, startCenter.x, startCenter.y);
    const d = this._buildPath(c.lineType, start, end);
    path.setAttribute("d", d);
    path.setAttribute("stroke", c.color);
    path.setAttribute("stroke-width", String(c.width));
    path.setAttribute("fill", "none");
    if (c.dashed) {
      path.setAttribute("stroke-dasharray", "8 4");
    } else {
      path.removeAttribute("stroke-dasharray");
    }
    if (c.arrowEnd === "arrow") {
      path.setAttribute("marker-end", "url(#ib-arrowhead)");
    } else {
      path.removeAttribute("marker-end");
    }
    if (c.arrowStart === "arrow") {
      path.setAttribute("marker-start", "url(#ib-arrowhead-start)");
    } else {
      path.removeAttribute("marker-start");
    }
    if (hitPath)
      hitPath.setAttribute("d", d);
  }
  /** Build an SVG path string for the given line type. */
  _buildPath(lineType, start, end) {
    switch (lineType) {
      case "straight":
        return `M${start.x},${start.y} L${end.x},${end.y}`;
      case "quadratic": {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const offset = Math.min(Math.hypot(dx, dy) * 0.15, 60);
        const cx = mx - dy / Math.hypot(dx, dy) * offset;
        const cy = my + dx / Math.hypot(dx, dy) * offset;
        return `M${start.x},${start.y} Q${cx},${cy} ${end.x},${end.y}`;
      }
      case "orthogonal": {
        const midX = (start.x + end.x) / 2;
        return `M${start.x},${start.y} L${midX},${start.y} L${midX},${end.y} L${end.x},${end.y}`;
      }
      default:
        return `M${start.x},${start.y} L${end.x},${end.y}`;
    }
  }
  /** Ensure SVG marker definitions exist. */
  _ensureMarkers() {
    const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    m.setAttribute("id", "ib-arrowhead");
    m.setAttribute("markerWidth", "10");
    m.setAttribute("markerHeight", "7");
    m.setAttribute("refX", "10");
    m.setAttribute("refY", "3.5");
    m.setAttribute("orient", "auto");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", "0 0, 10 3.5, 0 7");
    poly.setAttribute("fill", "var(--text-muted)");
    m.appendChild(poly);
    this.defs.appendChild(m);
    const ms = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    ms.setAttribute("id", "ib-arrowhead-start");
    ms.setAttribute("markerWidth", "10");
    ms.setAttribute("markerHeight", "7");
    ms.setAttribute("refX", "0");
    ms.setAttribute("refY", "3.5");
    ms.setAttribute("orient", "auto-start-reverse");
    const polys = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polys.setAttribute("points", "10 0, 0 3.5, 10 7");
    polys.setAttribute("fill", "var(--text-muted)");
    ms.appendChild(polys);
    this.defs.appendChild(ms);
  }
  _emitChange() {
    if (this.onChange)
      this.onChange();
  }
};

// src/DrawManager.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
var DrawManager = class {
  constructor(worldLayer, tempCanvas, history) {
    this.permanentStrokes = /* @__PURE__ */ new Map();
    this.tempStrokes = /* @__PURE__ */ new Map();
    this.laserStrokes = /* @__PURE__ */ new Map();
    // per-stroke SVG элементы постоянных штрихов (живут в worldLayer, порядок по z-index)
    this.strokeElements = /* @__PURE__ */ new Map();
    this.currentStroke = null;
    this.onChange = null;
    /** Внешний аллокатор единого z-порядка. */
    this.zAlloc = null;
    this.worldLayer = worldLayer;
    this.tempCanvas = tempCanvas;
    this.tempCtx = tempCanvas.getContext("2d");
    this.history = history;
  }
  startStroke(tool, color, width, opacity = 1, smoothing = 0.5) {
    const layer = tool === "laser" ? "laser" : "permanent";
    const now = Date.now();
    this.currentStroke = {
      id: generateId(),
      type: "stroke",
      tool,
      layer,
      points: [],
      color,
      width,
      opacity,
      smoothing,
      createdAt: now,
      pointTimestamps: []
    };
    if (tool === "laser") {
      this.laserStrokes.set(this.currentStroke.id, this.currentStroke);
    }
  }
  addPoint(x, y) {
    if (!this.currentStroke)
      return;
    this.currentStroke.points.push([x, y]);
    if (this.currentStroke.pointTimestamps) {
      this.currentStroke.pointTimestamps.push(Date.now());
    }
  }
  endStroke() {
    if (!this.currentStroke)
      return null;
    const stroke = this.currentStroke;
    this.currentStroke = null;
    if (stroke.points.length < 2) {
      if (stroke.layer === "laser") {
        this.laserStrokes.delete(stroke.id);
      }
      return null;
    }
    if (stroke.tool === "eraser") {
      this._eraseAt(stroke);
      return null;
    }
    if (stroke.layer === "laser") {
      return stroke;
    }
    stroke.zIndex = this.zAlloc ? this.zAlloc() : this.permanentStrokes.size + 1;
    stroke.name = stroke.tool === "marker" ? "\u041C\u0430\u0440\u043A\u0435\u0440" : "\u041A\u0430\u0440\u0430\u043D\u0434\u0430\u0448";
    stroke.hidden = false;
    this.permanentStrokes.set(stroke.id, stroke);
    this._renderStrokeEl(stroke);
    this.history.push({
      type: "draw-stroke",
      undo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._removeStrokeEl(stroke.id);
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._renderStrokeEl(stroke);
        this._emitChange();
      }
    });
    this._emitChange();
    return stroke;
  }
  addTempStroke(stroke) {
    stroke.layer = "temp";
    this.tempStrokes.set(stroke.id, stroke);
  }
  clearTemp() {
    this.tempStrokes.clear();
    this._clearCanvas(this.tempCtx);
  }
  deleteStroke(id) {
    const stroke = this.permanentStrokes.get(id);
    if (!stroke)
      return;
    this.permanentStrokes.delete(id);
    this._removeStrokeEl(id);
    this.history.push({
      type: "delete-stroke",
      undo: () => {
        this.permanentStrokes.set(stroke.id, stroke);
        this._renderStrokeEl(stroke);
        this._emitChange();
      },
      redo: () => {
        this.permanentStrokes.delete(stroke.id);
        this._removeStrokeEl(stroke.id);
        this._emitChange();
      }
    });
    this._emitChange();
  }
  getLaserStrokes() {
    return this.laserStrokes;
  }
  removeLaserStroke(id) {
    this.laserStrokes.delete(id);
  }
  // ─── Layer API ──────────────────────────────────────────────
  setZIndex(id, z) {
    const s = this.permanentStrokes.get(id);
    if (!s)
      return;
    s.zIndex = z;
    const el = this.strokeElements.get(id);
    if (el)
      el.style.zIndex = String(z);
    this._emitChange();
  }
  setHidden(id, hidden) {
    const s = this.permanentStrokes.get(id);
    if (!s)
      return;
    s.hidden = hidden;
    const el = this.strokeElements.get(id);
    if (el)
      el.style.display = hidden ? "none" : "";
    this._emitChange();
  }
  setName(id, name) {
    const s = this.permanentStrokes.get(id);
    if (!s)
      return;
    s.name = name;
    this._emitChange();
  }
  getLayerObjects() {
    return Array.from(this.permanentStrokes.values()).map((s) => {
      var _a, _b;
      return {
        id: s.id,
        kind: "stroke",
        name: (_a = s.name) != null ? _a : s.tool === "marker" ? "\u041C\u0430\u0440\u043A\u0435\u0440" : "\u041A\u0430\u0440\u0430\u043D\u0434\u0430\u0448",
        zIndex: (_b = s.zIndex) != null ? _b : 0,
        hidden: !!s.hidden,
        subtype: s.tool
      };
    });
  }
  serialise(includeTempStrokes) {
    const arr = Array.from(this.permanentStrokes.values());
    if (includeTempStrokes) {
      arr.push(...Array.from(this.tempStrokes.values()));
    }
    return arr;
  }
  deserialise(data) {
    this.permanentStrokes.clear();
    this.tempStrokes.clear();
    this._clearStrokeEls();
    let fallbackZ = 1;
    for (const s of data) {
      if (s.layer === "temp") {
        this.tempStrokes.set(s.id, s);
      } else {
        if (s.zIndex === void 0)
          s.zIndex = 1e6 + fallbackZ++;
        if (s.name === void 0)
          s.name = s.tool === "marker" ? "\u041C\u0430\u0440\u043A\u0435\u0440" : "\u041A\u0430\u0440\u0430\u043D\u0434\u0430\u0448";
        if (s.hidden === void 0)
          s.hidden = false;
        this.permanentStrokes.set(s.id, s);
        this._renderStrokeEl(s);
      }
    }
    this._redrawTemp();
  }
  resize(w, h) {
    this.tempCanvas.width = w;
    this.tempCanvas.height = h;
    this._redrawTemp();
  }
  // рендерит только превью текущего штриха и сохранённые temp-штрихи на экранном tempCanvas
  renderWithTransform(offsetX, offsetY, zoom) {
    this._clearCanvas(this.tempCtx);
    this.tempCtx.save();
    this.tempCtx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    for (const s of this.tempStrokes.values()) {
      this._drawStrokeRaw(this.tempCtx, s);
    }
    if (this.currentStroke && this.currentStroke.layer !== "laser") {
      this._drawStrokeRaw(this.tempCtx, this.currentStroke);
    }
    this.tempCtx.restore();
  }
  // ─── per-stroke SVG ─────────────────────────────────────────
  _renderStrokeEl(stroke) {
    let svg = this.strokeElements.get(stroke.id);
    if (!svg) {
      svg = document.createElementNS(SVG_NS2, "svg");
      svg.classList.add("ib-stroke");
      svg.dataset.strokeId = stroke.id;
      const path = document.createElementNS(SVG_NS2, "path");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      this.worldLayer.appendChild(svg);
      this.strokeElements.set(stroke.id, svg);
    }
    this._updateStrokeEl(stroke);
  }
  _updateStrokeEl(stroke) {
    var _a;
    const svg = this.strokeElements.get(stroke.id);
    if (!svg)
      return;
    const path = svg.querySelector("path");
    if (!path)
      return;
    const isMarker = stroke.tool === "marker";
    path.setAttribute("d", this._strokePathD(stroke));
    path.setAttribute("stroke", stroke.color);
    path.setAttribute("stroke-width", String(isMarker ? stroke.width * 3 : stroke.width));
    path.setAttribute("opacity", String(isMarker ? stroke.opacity * 0.45 : stroke.opacity));
    svg.style.zIndex = String((_a = stroke.zIndex) != null ? _a : 0);
    svg.style.display = stroke.hidden ? "none" : "";
  }
  _removeStrokeEl(id) {
    const el = this.strokeElements.get(id);
    if (el) {
      el.remove();
      this.strokeElements.delete(id);
    }
  }
  _clearStrokeEls() {
    for (const el of this.strokeElements.values())
      el.remove();
    this.strokeElements.clear();
  }
  // строит SVG path d с тем же квадратичным сглаживанием, что и canvas-рендер
  _strokePathD(stroke) {
    const pts = stroke.points;
    if (pts.length < 2)
      return "";
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
  _redrawTemp() {
    this._clearCanvas(this.tempCtx);
    for (const s of this.tempStrokes.values()) {
      this._drawStrokeOnCanvas(this.tempCtx, s);
    }
  }
  _drawStrokeOnCanvas(ctx, stroke) {
    ctx.save();
    this._drawStrokeRaw(ctx, stroke);
    ctx.restore();
  }
  // рисует штрих на canvas (для temp-превью); трансформ задаёт вызывающий
  _drawStrokeRaw(ctx, stroke) {
    if (stroke.points.length < 2)
      return;
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stroke.tool === "marker") {
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
  _clearCanvas(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  // ластик — удаляет штрихи рядом с путём ластика
  _eraseAt(eraserStroke) {
    const pts = eraserStroke.points;
    const toDelete = [];
    for (const [id, s] of this.permanentStrokes) {
      for (const ep of pts) {
        for (const sp of s.points) {
          const dist = Math.hypot(ep[0] - sp[0], ep[1] - sp[1]);
          if (dist < eraserStroke.width + s.width) {
            toDelete.push(id);
            break;
          }
        }
        if (toDelete[toDelete.length - 1] === id)
          break;
      }
    }
    for (const id of toDelete) {
      this.deleteStroke(id);
    }
  }
  _emitChange() {
    if (this.onChange)
      this.onChange();
  }
};

// src/LaserRenderer.ts
var LaserRenderer = class {
  constructor(canvas, drawManager, params) {
    this.animationId = null;
    this.running = false;
    this._loop = () => {
      if (!this.running)
        return;
      this.animationId = requestAnimationFrame(this._loop);
    };
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.drawManager = drawManager;
    this.params = { ...params };
  }
  setParams(params) {
    Object.assign(this.params, params);
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    this._loop();
  }
  stop() {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
  renderWithTransform(offsetX, offsetY, zoom) {
    const now = Date.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    const strokes = this.drawManager.getLaserStrokes();
    const expired = [];
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
  // рисует один лазерный штрих с затуханием от хвоста к голове
  // возвращает true если штрих полностью истёк
  _drawLaserStroke(stroke, now) {
    const pts = stroke.points;
    if (pts.length < 2)
      return false;
    const timestamps = stroke.pointTimestamps;
    if (!timestamps || timestamps.length < 2) {
      return this._drawLaserStrokeFallback(stroke, now);
    }
    const ctx = this.ctx;
    const duration = this.params.duration;
    let allExpired = true;
    let firstVisible = -1;
    for (let i = 0; i < pts.length; i++) {
      const age = now - timestamps[i];
      if (this._computeAlpha(age, duration) > 0) {
        firstVisible = i;
        break;
      }
    }
    if (firstVisible < 0)
      return true;
    for (let i = Math.max(firstVisible, 1); i < pts.length; i++) {
      const segAge = now - timestamps[i - 1];
      const alpha = this._computeAlpha(segAge, duration);
      if (alpha <= 0)
        continue;
      allExpired = false;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke.color || this.params.color;
      ctx.lineWidth = this.params.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
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
  _drawLaserStrokeFallback(stroke, now) {
    var _a;
    const pts = stroke.points;
    if (pts.length < 2)
      return true;
    const age = now - ((_a = stroke.createdAt) != null ? _a : now);
    const alpha = this._computeAlpha(age, this.params.duration);
    if (alpha <= 0)
      return true;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke.color || this.params.color;
    ctx.lineWidth = this.params.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
  _computeAlpha(ageMs, duration) {
    const t = ageMs / duration;
    if (t >= 1)
      return 0;
    if (t <= 0)
      return 1;
    switch (this.params.fadeCurve) {
      case "exp":
        return Math.pow(1 - t, 2.5);
      case "linear":
      default:
        return 1 - t;
    }
  }
};

// src/SelectionManager.ts
var SelectionManager = class {
  constructor(c, nm, cm, h) {
    this.selected = /* @__PURE__ */ new Set();
    this.selectionBox = null;
    this.selectionStart = null;
    this.isSelecting = false;
    this.clipboard = [];
    this.onSelectionChange = null;
    this.container = c;
    this.nodeManager = nm;
    this.connectorManager = cm;
    this.history = h;
  }
  select(nodeId, additive = false) {
    var _a;
    if (!additive) {
      for (const id of this.selected) {
        if (id !== nodeId) {
          const el2 = this.nodeManager.getNodeElement(id);
          if (el2)
            el2.classList.remove("ib-selected");
        }
      }
      this.selected.clear();
    }
    this.selected.add(nodeId);
    const el = this.nodeManager.getNodeElement(nodeId);
    if (el)
      el.classList.add("ib-selected");
    (_a = this.onSelectionChange) == null ? void 0 : _a.call(this, this.getSelectedIds());
  }
  deselectAll() {
    var _a;
    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el)
        el.classList.remove("ib-selected");
    }
    this.selected.clear();
    (_a = this.onSelectionChange) == null ? void 0 : _a.call(this, this.getSelectedIds());
  }
  toggle(nodeId) {
    var _a;
    if (this.selected.has(nodeId)) {
      this.selected.delete(nodeId);
      const el = this.nodeManager.getNodeElement(nodeId);
      if (el)
        el.classList.remove("ib-selected");
    } else {
      this.selected.add(nodeId);
      const el = this.nodeManager.getNodeElement(nodeId);
      if (el)
        el.classList.add("ib-selected");
    }
    (_a = this.onSelectionChange) == null ? void 0 : _a.call(this, this.getSelectedIds());
  }
  getSelectedIds() {
    return Array.from(this.selected);
  }
  isSelected(nodeId) {
    return this.selected.has(nodeId);
  }
  startRubberBand(x, y) {
    this.isSelecting = true;
    this.selectionStart = { x, y };
    this.selectionBox = document.createElement("div");
    this.selectionBox.className = "ib-selection-box";
    this.container.appendChild(this.selectionBox);
  }
  updateRubberBand(x, y) {
    if (!this.isSelecting || !this.selectionStart || !this.selectionBox)
      return;
    const sx = Math.min(this.selectionStart.x, x);
    const sy = Math.min(this.selectionStart.y, y);
    this.selectionBox.style.left = `${sx}px`;
    this.selectionBox.style.top = `${sy}px`;
    this.selectionBox.style.width = `${Math.abs(x - this.selectionStart.x)}px`;
    this.selectionBox.style.height = `${Math.abs(y - this.selectionStart.y)}px`;
  }
  endRubberBand(x, y) {
    var _a, _b;
    if (!this.isSelecting || !this.selectionStart)
      return;
    this.isSelecting = false;
    const sx = Math.min(this.selectionStart.x, x), sy = Math.min(this.selectionStart.y, y);
    const ex = Math.max(this.selectionStart.x, x), ey = Math.max(this.selectionStart.y, y);
    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el)
        el.classList.remove("ib-selected");
    }
    this.selected.clear();
    for (const n of this.nodeManager.getAllNodes()) {
      if (n.x >= sx && n.y >= sy && n.x + n.width <= ex && n.y + n.height <= ey) {
        this.selected.add(n.id);
        const el = this.nodeManager.getNodeElement(n.id);
        if (el)
          el.classList.add("ib-selected");
      }
    }
    (_a = this.selectionBox) == null ? void 0 : _a.remove();
    this.selectionBox = null;
    this.selectionStart = null;
    (_b = this.onSelectionChange) == null ? void 0 : _b.call(this, this.getSelectedIds());
  }
  copySelected() {
    this.clipboard = [];
    for (const id of this.selected) {
      const n = this.nodeManager.getNode(id);
      if (n)
        this.clipboard.push({ ...n });
    }
  }
  paste() {
    var _a;
    if (!this.clipboard.length)
      return;
    for (const id of this.selected) {
      const el = this.nodeManager.getNodeElement(id);
      if (el)
        el.classList.remove("ib-selected");
    }
    this.selected.clear();
    for (const c of this.clipboard) {
      const nn = this.nodeManager.createNode(c.type, c.x + 20, c.y + 20, c.width, c.height, {
        fillColor: c.fillColor,
        borderColor: c.borderColor,
        borderWidth: c.borderWidth,
        borderRadius: c.borderRadius,
        text: c.text,
        icon: c.icon
      });
      this.selected.add(nn.id);
      const el = this.nodeManager.getNodeElement(nn.id);
      if (el)
        el.classList.add("ib-selected");
    }
    (_a = this.onSelectionChange) == null ? void 0 : _a.call(this, this.getSelectedIds());
  }
  deleteSelected() {
    var _a;
    for (const id of this.selected) {
      this.connectorManager.deleteConnectorsForNode(id);
      this.nodeManager.deleteNode(id);
    }
    this.selected.clear();
    (_a = this.onSelectionChange) == null ? void 0 : _a.call(this, this.getSelectedIds());
  }
  // ПРАВКА ТЕКСТА в фигуре: делаем span редактируемым (contentEditable), фокус,
  // выделяем текст. На blur/Enter — сохраняем новый текст в ноду. Слушатели снимаем,
  // чтобы не копились. (Перехват клавиш холста гасится в CanvasView через _isEditingText.)
  startTextEdit(nodeId) {
    var _a;
    const el = this.nodeManager.getNodeElement(nodeId);
    if (!el)
      return;
    let textEl = el.querySelector(".ib-node-text");
    if (!textEl) {
      textEl = document.createElement("span");
      textEl.className = "ib-node-text";
      el.appendChild(textEl);
    }
    textEl.contentEditable = "true";
    textEl.focus();
    const sel = window.getSelection();
    if (sel && textEl.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const node = this.nodeManager.getNode(nodeId);
    const oldText = (_a = node == null ? void 0 : node.text) != null ? _a : "";
    const onKeyDown = (e) => {
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finish();
      }
    };
    const finish = () => {
      var _a2;
      textEl.contentEditable = "false";
      const newText = (_a2 = textEl.textContent) != null ? _a2 : "";
      if (node && newText !== oldText)
        this.nodeManager.updateNode(nodeId, { text: newText });
      textEl.removeEventListener("blur", finish);
      textEl.removeEventListener("keydown", onKeyDown);
    };
    textEl.addEventListener("blur", finish);
    textEl.addEventListener("keydown", onKeyDown);
  }
};

// src/FullscreenManager.ts
var FullscreenManager = class {
  constructor(containerEl) {
    this.isFullscreen = false;
    this.savedStyles = null;
    this.onToggle = null;
    this.containerEl = containerEl;
  }
  toggle() {
    if (this.isFullscreen)
      this.exit();
    else
      this.enter();
  }
  enter() {
    var _a;
    if (this.isFullscreen)
      return;
    this.isFullscreen = true;
    const workspace = document.querySelector(".workspace");
    if (workspace) {
      this.savedStyles = {
        overflow: workspace.style.overflow,
        position: workspace.style.position
      };
    }
    document.body.querySelectorAll(
      ".workspace-split.mod-left-split, .workspace-split.mod-right-split, .workspace-tab-header-container"
    ).forEach((el) => el.style.display = "none");
    this.containerEl.classList.add("ib-fullscreen");
    (_a = this.onToggle) == null ? void 0 : _a.call(this, true);
  }
  exit() {
    var _a;
    if (!this.isFullscreen)
      return;
    this.isFullscreen = false;
    document.body.querySelectorAll(
      ".workspace-split.mod-left-split, .workspace-split.mod-right-split, .workspace-tab-header-container"
    ).forEach((el) => el.style.display = "");
    this.containerEl.classList.remove("ib-fullscreen");
    (_a = this.onToggle) == null ? void 0 : _a.call(this, false);
  }
  getState() {
    return this.isFullscreen;
  }
};

// src/Toolbar.ts
var SVG_ICONS = {
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
  layers: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="9,2 16,6 9,10 2,6"/><polyline points="2,9.5 9,13.5 16,9.5"/><polyline points="2,12.5 9,16.5 16,12.5"/></svg>`
};
var COLOR_CAPABLE_TOOLS = [
  "rectangle",
  "ellipse",
  "text",
  "connector",
  "pencil",
  "marker"
];
var FONT_CAPABLE_TOOLS = ["text", "rectangle", "ellipse", "group"];
var FONT_FAMILIES = [
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Outfit", value: "Outfit, sans-serif" },
  { label: "Fira Code", value: '"Fira Code", monospace' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Courier", value: '"Courier New", monospace' },
  { label: "Times", value: '"Times New Roman", serif' },
  { label: "System", value: "system-ui, sans-serif" }
];
var TOOLS = [
  { id: "select", svg: SVG_ICONS.select, title: "Select (V)", group: "pointer" },
  { id: "rectangle", svg: SVG_ICONS.rectangle, title: "Rectangle (R)", group: "shape" },
  { id: "ellipse", svg: SVG_ICONS.ellipse, title: "Ellipse (E)", group: "shape" },
  { id: "text", svg: SVG_ICONS.text, title: "Text (T)", group: "shape" },
  { id: "image", svg: SVG_ICONS.image, title: "Image (I)", group: "shape" },
  { id: "connector", svg: SVG_ICONS.connector, title: "Connector (C)", group: "shape" },
  { id: "pencil", svg: SVG_ICONS.pencil, title: "Pencil (P)", group: "draw" },
  { id: "marker", svg: SVG_ICONS.marker, title: "Marker (M)", group: "draw" },
  { id: "eraser", svg: SVG_ICONS.eraser, title: "Eraser (X)", group: "draw" },
  { id: "laser", svg: SVG_ICONS.laser, title: "Laser (L)", group: "draw" }
];
var LASER_COLORS = [
  "#ff3333",
  "#33ff33",
  "#3399ff",
  "#ff9900",
  "#ff33ff",
  "#ffff00",
  "#00ffcc",
  "#ffffff"
];
var Toolbar = class {
  constructor(parent, callbacks) {
    this.currentTool = "select";
    this.toolButtons = /* @__PURE__ */ new Map();
    this.laserColorPanel = null;
    this.currentLaserColor = "#ff3333";
    this.colorWheelContainer = null;
    this.colorWheelCanvas = null;
    this.colorBrightnessSlider = null;
    this.colorPreview = null;
    this.currentHue = 0;
    this.currentSat = 100;
    this.currentLight = 50;
    this.selectedColor = "#e0e0e0";
    this.colorSwatchBtn = null;
    this.fontControlsContainer = null;
    this.fontSizeInput = null;
    this.fontFamilySelect = null;
    this.selectionNode = null;
    this.textColorSwatchBtn = null;
    this.textColorPopup = null;
    this.textColorCanvas = null;
    this.textColorBrightnessSlider = null;
    this.textColorPreview = null;
    this.textColorHue = 0;
    this.textColorSat = 0;
    this.textColorLight = 80;
    this.selectedTextColor = "var(--text-normal)";
    this.textColorUseDefault = true;
    this.callbacks = callbacks;
    this.el = document.createElement("div");
    this.el.className = "ib-toolbar";
    parent.appendChild(this.el);
    this._build();
  }
  setActiveTool(tool) {
    this.currentTool = tool;
    for (const [id, btn] of this.toolButtons) {
      btn.classList.toggle("ib-toolbar-btn--active", id === tool);
    }
    this._toggleLaserColorPanel(tool === "laser");
    this._refreshContextPanels();
  }
  /**
   * Контекст выделения: при выделении ноды показываем настройки шрифта/цвета
   * и синхронизируем значения с этой нодой. null — выделение снято.
   */
  setSelectionContext(node) {
    var _a, _b;
    this.selectionNode = node;
    if (node) {
      if (this.fontSizeInput)
        this.fontSizeInput.value = String((_a = node.fontSize) != null ? _a : 14);
      if (this.fontFamilySelect && node.fontFamily)
        this.fontFamilySelect.value = node.fontFamily;
      if (node.fillColor && !node.fillColor.startsWith("var(") && node.type !== "image") {
        this.selectedColor = node.fillColor;
        if (this.colorSwatchBtn)
          this.colorSwatchBtn.style.backgroundColor = node.fillColor;
        if (this.colorPreview)
          this.colorPreview.style.backgroundColor = node.fillColor;
      }
      this.textColorUseDefault = !node.textColor;
      this.selectedTextColor = (_b = node.textColor) != null ? _b : "var(--text-normal)";
      this._updateTextColorSwatch();
    }
    this._refreshContextPanels();
  }
  // показываем панели шрифта/цвета если их поддерживает активный инструмент ЛИБО что-то выделено
  _refreshContextPanels() {
    const showFont = FONT_CAPABLE_TOOLS.includes(this.currentTool) || this.selectionNode !== null;
    const showColor = COLOR_CAPABLE_TOOLS.includes(this.currentTool) || this.selectionNode !== null && this.selectionNode.type !== "image";
    this._toggleFontControls(showFont);
    this._toggleColorWheel(showColor);
  }
  getElement() {
    return this.el;
  }
  destroy() {
    this.el.remove();
  }
  _build() {
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
    const widthWrap = this._group();
    const widthInput = document.createElement("input");
    widthInput.type = "range";
    widthInput.min = "1";
    widthInput.max = "20";
    widthInput.value = "2";
    widthInput.className = "ib-toolbar-range";
    widthInput.title = "Line width";
    widthInput.addEventListener("input", () => this.callbacks.onWidthChange(Number(widthInput.value)));
    widthWrap.appendChild(widthInput);
    this.el.appendChild(widthWrap);
    this.el.appendChild(this._sep());
    const actGroup = this._group();
    actGroup.appendChild(this._svgBtn(SVG_ICONS.undo, "Undo (Ctrl+Z)", this.callbacks.onUndo));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.redo, "Redo (Ctrl+Y)", this.callbacks.onRedo));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.fitScreen, "Fit to screen", this.callbacks.onFitToScreen));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.layers, "\u0421\u043B\u043E\u0438", this.callbacks.onToggleLayers));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.fullscreen, "Fullscreen (F11)", this.callbacks.onFullscreen));
    actGroup.appendChild(this._svgBtn(SVG_ICONS.save, "Export", this.callbacks.onExport));
    this.el.appendChild(actGroup);
    this._buildLaserColorPanel();
    this._buildColorWheel();
    this._buildFontControls();
    this.setActiveTool("select");
  }
  _buildColorWheel() {
    this.colorWheelContainer = document.createElement("div");
    this.colorWheelContainer.className = "ib-color-wheel-panel";
    this.colorWheelContainer.style.display = "none";
    this.colorSwatchBtn = document.createElement("button");
    this.colorSwatchBtn.className = "ib-color-swatch-btn";
    this.colorSwatchBtn.style.backgroundColor = this.selectedColor;
    this.colorSwatchBtn.title = "Pick color";
    this.colorWheelContainer.appendChild(this.colorSwatchBtn);
    const popup = document.createElement("div");
    popup.className = "ib-color-wheel-popup";
    popup.style.display = "none";
    this.colorWheelCanvas = document.createElement("canvas");
    this.colorWheelCanvas.width = 180;
    this.colorWheelCanvas.height = 180;
    this.colorWheelCanvas.className = "ib-color-wheel-canvas";
    popup.appendChild(this.colorWheelCanvas);
    const sliderWrap = document.createElement("div");
    sliderWrap.className = "ib-color-wheel-slider-wrap";
    const lLabel = document.createElement("span");
    lLabel.textContent = "L";
    lLabel.className = "ib-color-wheel-label";
    sliderWrap.appendChild(lLabel);
    this.colorBrightnessSlider = document.createElement("input");
    this.colorBrightnessSlider.type = "range";
    this.colorBrightnessSlider.min = "5";
    this.colorBrightnessSlider.max = "95";
    this.colorBrightnessSlider.value = "50";
    this.colorBrightnessSlider.className = "ib-color-wheel-lightness";
    sliderWrap.appendChild(this.colorBrightnessSlider);
    popup.appendChild(sliderWrap);
    this.colorPreview = document.createElement("div");
    this.colorPreview.className = "ib-color-wheel-preview";
    this.colorPreview.style.backgroundColor = this.selectedColor;
    popup.appendChild(this.colorPreview);
    this.colorWheelContainer.appendChild(popup);
    this.el.appendChild(this.colorWheelContainer);
    this.colorSwatchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = popup.style.display !== "none";
      popup.style.display = isOpen ? "none" : "flex";
      if (!isOpen)
        this._drawColorWheel();
    });
    document.addEventListener("mousedown", (e) => {
      if (popup.style.display !== "none" && !this.colorWheelContainer.contains(e.target)) {
        popup.style.display = "none";
      }
    });
    this.colorWheelCanvas.addEventListener("pointerdown", (e) => {
      this._pickColorFromWheel(e);
      const onMove = (me) => this._pickColorFromWheel(me);
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    this.colorBrightnessSlider.addEventListener("input", () => {
      this.currentLight = Number(this.colorBrightnessSlider.value);
      this._applyColor();
      this._drawColorWheel();
    });
  }
  _drawColorWheel() {
    const canvas = this.colorWheelCanvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;
    ctx.clearRect(0, 0, w, h);
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
    const gradR = innerR - 4;
    for (let y = -gradR; y <= gradR; y += 2) {
      for (let x = -gradR; x <= gradR; x += 2) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist > gradR)
          continue;
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        const sat = dist / gradR * 100;
        ctx.fillStyle = `hsl(${angle}, ${sat}%, ${this.currentLight}%)`;
        ctx.fillRect(cx + x, cy + y, 2, 2);
      }
    }
    const indicatorAngle = this.currentHue * Math.PI / 180;
    const indicatorR = innerR + (outerR - innerR) / 2;
    if (this.currentSat > 70) {
      const ix = cx + Math.cos(indicatorAngle) * indicatorR;
      const iy = cy + Math.sin(indicatorAngle) * indicatorR;
      this._drawIndicator(ctx, ix, iy);
    } else {
      const satR = this.currentSat / 100 * gradR;
      const ix = cx + Math.cos(indicatorAngle) * satR;
      const iy = cy + Math.sin(indicatorAngle) * satR;
      this._drawIndicator(ctx, ix, iy);
    }
  }
  _drawIndicator(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  _pickColorFromWheel(e) {
    e.stopPropagation();
    const canvas = this.colorWheelCanvas;
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
      this.currentSat = Math.round(Math.min(100, dist / (innerR - 4) * 100));
    } else {
      this.currentSat = 100;
    }
    this._applyColor();
    this._drawColorWheel();
  }
  _applyColor() {
    this.selectedColor = `hsl(${this.currentHue}, ${this.currentSat}%, ${this.currentLight}%)`;
    if (this.colorSwatchBtn)
      this.colorSwatchBtn.style.backgroundColor = this.selectedColor;
    if (this.colorPreview)
      this.colorPreview.style.backgroundColor = this.selectedColor;
    this.callbacks.onColorChange(this.selectedColor);
  }
  _toggleColorWheel(show) {
    if (this.colorWheelContainer) {
      this.colorWheelContainer.style.display = show ? "flex" : "none";
    }
  }
  _buildLaserColorPanel() {
    this.laserColorPanel = document.createElement("div");
    this.laserColorPanel.className = "ib-laser-color-panel";
    this.laserColorPanel.style.display = "none";
    const label = document.createElement("span");
    label.className = "ib-laser-color-label";
    label.textContent = "Laser:";
    this.laserColorPanel.appendChild(label);
    for (const color of LASER_COLORS) {
      const swatch = document.createElement("button");
      swatch.className = "ib-laser-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      if (color === this.currentLaserColor) {
        swatch.classList.add("ib-laser-color-swatch--active");
      }
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        this.currentLaserColor = color;
        this.laserColorPanel.querySelectorAll(".ib-laser-color-swatch").forEach(
          (s) => s.classList.toggle("ib-laser-color-swatch--active", s.style.backgroundColor === swatch.style.backgroundColor)
        );
        this.callbacks.onLaserColorChange(color);
      });
      this.laserColorPanel.appendChild(swatch);
    }
    this.el.appendChild(this.laserColorPanel);
  }
  _toggleLaserColorPanel(show) {
    if (this.laserColorPanel) {
      this.laserColorPanel.style.display = show ? "flex" : "none";
    }
  }
  _svgBtn(svgMarkup, title, onClick) {
    const btn = document.createElement("button");
    btn.className = "ib-toolbar-btn";
    btn.title = title;
    btn.innerHTML = svgMarkup;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
  _group() {
    const g = document.createElement("div");
    g.className = "ib-toolbar-group";
    return g;
  }
  _sep() {
    const s = document.createElement("div");
    s.className = "ib-toolbar-sep";
    return s;
  }
  _buildFontControls() {
    this.fontControlsContainer = document.createElement("div");
    this.fontControlsContainer.className = "ib-font-controls-panel";
    this.fontControlsContainer.style.display = "none";
    const sizeWrap = document.createElement("div");
    sizeWrap.className = "ib-font-size-wrap";
    const sizeLabel = document.createElement("span");
    sizeLabel.className = "ib-font-label";
    sizeLabel.textContent = "Size";
    sizeWrap.appendChild(sizeLabel);
    this.fontSizeInput = document.createElement("input");
    this.fontSizeInput.type = "number";
    this.fontSizeInput.min = "8";
    this.fontSizeInput.max = "120";
    this.fontSizeInput.value = "14";
    this.fontSizeInput.className = "ib-font-size-input";
    this.fontSizeInput.title = "Font size (px)";
    this.fontSizeInput.addEventListener("change", () => {
      const size = Math.min(120, Math.max(8, Number(this.fontSizeInput.value)));
      this.fontSizeInput.value = String(size);
      this.callbacks.onFontSizeChange(size);
    });
    sizeWrap.appendChild(this.fontSizeInput);
    const pxLabel = document.createElement("span");
    pxLabel.className = "ib-font-label";
    pxLabel.textContent = "px";
    sizeWrap.appendChild(pxLabel);
    this.fontControlsContainer.appendChild(sizeWrap);
    const familyWrap = document.createElement("div");
    familyWrap.className = "ib-font-family-wrap";
    const familyLabel = document.createElement("span");
    familyLabel.className = "ib-font-label";
    familyLabel.textContent = "Font";
    familyWrap.appendChild(familyLabel);
    this.fontFamilySelect = document.createElement("select");
    this.fontFamilySelect.className = "ib-font-family-select";
    this.fontFamilySelect.title = "Font family";
    for (const f of FONT_FAMILIES) {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = f.value;
      this.fontFamilySelect.appendChild(opt);
    }
    this.fontFamilySelect.addEventListener("change", () => {
      this.callbacks.onFontFamilyChange(this.fontFamilySelect.value);
    });
    familyWrap.appendChild(this.fontFamilySelect);
    this.fontControlsContainer.appendChild(familyWrap);
    this._buildTextColorPicker(this.fontControlsContainer);
    this.el.appendChild(this.fontControlsContainer);
  }
  _toggleFontControls(show) {
    if (this.fontControlsContainer) {
      this.fontControlsContainer.style.display = show ? "flex" : "none";
    }
  }
  _buildTextColorPicker(parent) {
    const wrap = document.createElement("div");
    wrap.className = "ib-text-color-wrap";
    const label = document.createElement("span");
    label.className = "ib-font-label";
    label.textContent = "Color";
    wrap.appendChild(label);
    this.textColorSwatchBtn = document.createElement("button");
    this.textColorSwatchBtn.className = "ib-text-color-swatch-btn";
    this.textColorSwatchBtn.title = "Text color";
    this.textColorSwatchBtn.innerHTML = `<span class="ib-text-color-swatch-letter">A</span>`;
    wrap.appendChild(this.textColorSwatchBtn);
    this.textColorPopup = document.createElement("div");
    this.textColorPopup.className = "ib-text-color-popup";
    this.textColorPopup.style.display = "none";
    const defaultBtn = document.createElement("button");
    defaultBtn.className = "ib-text-color-default-btn";
    defaultBtn.textContent = "Default";
    defaultBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.textColorUseDefault = true;
      this.selectedTextColor = "var(--text-normal)";
      this._updateTextColorSwatch();
      this.callbacks.onTextColorChange(this.selectedTextColor);
    });
    this.textColorPopup.appendChild(defaultBtn);
    const palette = document.createElement("div");
    palette.className = "ib-text-color-palette";
    const quickColors = [
      "#ffffff",
      "#cccccc",
      "#888888",
      "#333333",
      "#000000",
      "#ff4444",
      "#ff8844",
      "#ffcc00",
      "#44cc44",
      "#44aaff",
      "#8866ff",
      "#ff44cc",
      "#ff6688",
      "#00ccaa",
      "#aabb00"
    ];
    for (const c of quickColors) {
      const swatch = document.createElement("button");
      swatch.className = "ib-text-color-quick-swatch";
      swatch.style.backgroundColor = c;
      swatch.title = c;
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        this.textColorUseDefault = false;
        this.selectedTextColor = c;
        this._updateTextColorSwatch();
        this.callbacks.onTextColorChange(c);
      });
      palette.appendChild(swatch);
    }
    this.textColorPopup.appendChild(palette);
    this.textColorCanvas = document.createElement("canvas");
    this.textColorCanvas.width = 160;
    this.textColorCanvas.height = 160;
    this.textColorCanvas.className = "ib-text-color-canvas";
    this.textColorPopup.appendChild(this.textColorCanvas);
    const sliderWrap = document.createElement("div");
    sliderWrap.className = "ib-color-wheel-slider-wrap";
    const lLabel = document.createElement("span");
    lLabel.textContent = "L";
    lLabel.className = "ib-color-wheel-label";
    sliderWrap.appendChild(lLabel);
    this.textColorBrightnessSlider = document.createElement("input");
    this.textColorBrightnessSlider.type = "range";
    this.textColorBrightnessSlider.min = "5";
    this.textColorBrightnessSlider.max = "95";
    this.textColorBrightnessSlider.value = String(this.textColorLight);
    this.textColorBrightnessSlider.className = "ib-color-wheel-lightness";
    sliderWrap.appendChild(this.textColorBrightnessSlider);
    this.textColorPopup.appendChild(sliderWrap);
    this.textColorPreview = document.createElement("div");
    this.textColorPreview.className = "ib-text-color-preview";
    this.textColorPreview.textContent = "Sample Text";
    this.textColorPopup.appendChild(this.textColorPreview);
    wrap.appendChild(this.textColorPopup);
    parent.appendChild(wrap);
    this.textColorSwatchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = this.textColorPopup.style.display !== "none";
      this.textColorPopup.style.display = isOpen ? "none" : "flex";
      if (!isOpen)
        this._drawTextColorWheel();
    });
    document.addEventListener("mousedown", (e) => {
      if (this.textColorPopup && this.textColorPopup.style.display !== "none" && !wrap.contains(e.target)) {
        this.textColorPopup.style.display = "none";
      }
    });
    this.textColorCanvas.addEventListener("pointerdown", (e) => {
      this._pickTextColorFromWheel(e);
      const onMove = (me) => this._pickTextColorFromWheel(me);
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    this.textColorBrightnessSlider.addEventListener("input", () => {
      this.textColorLight = Number(this.textColorBrightnessSlider.value);
      this._applyTextColor();
      this._drawTextColorWheel();
    });
  }
  _drawTextColorWheel() {
    const canvas = this.textColorCanvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;
    ctx.clearRect(0, 0, w, h);
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
    const gradR = innerR - 4;
    for (let y = -gradR; y <= gradR; y += 2) {
      for (let x = -gradR; x <= gradR; x += 2) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist > gradR)
          continue;
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        const sat = dist / gradR * 100;
        ctx.fillStyle = `hsl(${angle}, ${sat}%, ${this.textColorLight}%)`;
        ctx.fillRect(cx + x, cy + y, 2, 2);
      }
    }
    if (!this.textColorUseDefault) {
      const indicatorAngle = this.textColorHue * Math.PI / 180;
      if (this.textColorSat > 70) {
        const indicatorR = innerR + (outerR - innerR) / 2;
        const ix = cx + Math.cos(indicatorAngle) * indicatorR;
        const iy = cy + Math.sin(indicatorAngle) * indicatorR;
        this._drawIndicator(ctx, ix, iy);
      } else {
        const satR = this.textColorSat / 100 * gradR;
        const ix = cx + Math.cos(indicatorAngle) * satR;
        const iy = cy + Math.sin(indicatorAngle) * satR;
        this._drawIndicator(ctx, ix, iy);
      }
    }
  }
  _pickTextColorFromWheel(e) {
    e.stopPropagation();
    const canvas = this.textColorCanvas;
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width) - cx;
    const y = (e.clientY - rect.top) * (canvas.height / rect.height) - cy;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR * 0.55;
    const dist = Math.sqrt(x * x + y * y);
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    this.textColorHue = Math.round(angle);
    this.textColorSat = dist <= innerR - 4 ? Math.round(Math.min(100, dist / (innerR - 4) * 100)) : 100;
    this.textColorUseDefault = false;
    this._applyTextColor();
    this._drawTextColorWheel();
  }
  _applyTextColor() {
    this.selectedTextColor = `hsl(${this.textColorHue}, ${this.textColorSat}%, ${this.textColorLight}%)`;
    this.textColorUseDefault = false;
    this._updateTextColorSwatch();
    this.callbacks.onTextColorChange(this.selectedTextColor);
  }
  _updateTextColorSwatch() {
    var _a;
    const letterEl = (_a = this.textColorSwatchBtn) == null ? void 0 : _a.querySelector(".ib-text-color-swatch-letter");
    if (letterEl) {
      letterEl.style.color = this.textColorUseDefault ? "" : this.selectedTextColor;
      letterEl.classList.toggle("ib-text-color--custom", !this.textColorUseDefault);
    }
    if (this.textColorPreview) {
      this.textColorPreview.style.color = this.textColorUseDefault ? "var(--text-normal)" : this.selectedTextColor;
    }
  }
};

// src/LayersPanel.ts
var ICONS = {
  rectangle: "\u25AD",
  ellipse: "\u25EF",
  text: "T",
  image: "\u{1F5BC}",
  group: "\u25A2",
  pencil: "\u270E",
  marker: "\u{1F58A}",
  connector: "\u2198"
};
var EYE_OPEN = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="9" cy="9" r="2.2"/></svg>`;
var EYE_CLOSED = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l14 10"/><path d="M6.5 5.2A8.6 8.6 0 0 1 9 5c5 0 8 6 8 6a14 14 0 0 1-2.4 2.8M4.2 6.6A14 14 0 0 0 1 11s3 6 8 6a8 8 0 0 0 2.4-.4"/></svg>`;
var LayersPanel = class {
  constructor(parent, host) {
    this.visible = false;
    this.dragId = null;
    this.host = host;
    this.el = document.createElement("div");
    this.el.className = "ib-layers-panel";
    this.el.style.display = "none";
    const header = document.createElement("div");
    header.className = "ib-layers-header";
    header.textContent = "\u0421\u043B\u043E\u0438";
    this.el.appendChild(header);
    this.listEl = document.createElement("div");
    this.listEl.className = "ib-layers-list";
    this.el.appendChild(this.listEl);
    parent.appendChild(this.el);
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.el.addEventListener("wheel", (e) => e.stopPropagation());
  }
  toggle() {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? "flex" : "none";
    if (this.visible)
      this.refresh();
  }
  isVisible() {
    return this.visible;
  }
  destroy() {
    this.el.remove();
  }
  refresh() {
    if (!this.visible)
      return;
    const selected = new Set(this.host.getSelectedIds());
    const objects = this.host.getLayerObjects();
    this.listEl.empty();
    if (objects.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ib-layers-empty";
      empty.textContent = "\u041F\u0443\u0441\u0442\u043E";
      this.listEl.appendChild(empty);
      return;
    }
    for (const obj of objects) {
      this.listEl.appendChild(this._buildRow(obj, selected.has(obj.id)));
    }
  }
  _buildRow(obj, isSelected) {
    var _a, _b;
    const row = document.createElement("div");
    row.className = "ib-layer-row";
    if (isSelected)
      row.classList.add("ib-layer-row--selected");
    if (obj.hidden)
      row.classList.add("ib-layer-row--hidden");
    row.dataset.layerId = obj.id;
    row.draggable = true;
    const eye = document.createElement("button");
    eye.className = "ib-layer-eye";
    eye.innerHTML = obj.hidden ? EYE_CLOSED : EYE_OPEN;
    eye.title = obj.hidden ? "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C" : "\u0421\u043A\u0440\u044B\u0442\u044C";
    eye.addEventListener("click", (e) => {
      e.stopPropagation();
      this.host.setObjectHidden(obj.id, !obj.hidden);
      this.refresh();
    });
    row.appendChild(eye);
    const icon = document.createElement("span");
    icon.className = "ib-layer-icon";
    icon.textContent = (_b = ICONS[(_a = obj.subtype) != null ? _a : ""]) != null ? _b : "\u25C6";
    row.appendChild(icon);
    const name = document.createElement("span");
    name.className = "ib-layer-name";
    name.textContent = obj.name;
    name.title = obj.name;
    row.appendChild(name);
    row.addEventListener("click", () => {
      this.host.selectObject(obj.id);
      this.refresh();
    });
    name.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this._startRename(name, obj);
    });
    row.addEventListener("dragstart", (e) => {
      var _a2;
      this.dragId = obj.id;
      row.classList.add("ib-layer-row--dragging");
      (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData("text/plain", obj.id);
    });
    row.addEventListener("dragend", () => {
      this.dragId = null;
      row.classList.remove("ib-layer-row--dragging");
      this.listEl.querySelectorAll(".ib-layer-row--dragover").forEach((r) => r.classList.remove("ib-layer-row--dragover"));
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("ib-layer-row--dragover");
    });
    row.addEventListener("dragleave", () => row.classList.remove("ib-layer-row--dragover"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("ib-layer-row--dragover");
      if (this.dragId && this.dragId !== obj.id) {
        this._reorder(this.dragId, obj.id);
      }
    });
    return row;
  }
  _startRename(nameEl, obj) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ib-layer-rename-input";
    input.value = obj.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const finish = (commit) => {
      const val = input.value.trim();
      if (commit && val)
        this.host.setObjectName(obj.id, val);
      input.removeEventListener("blur", onBlur);
      this.refresh();
    };
    const onBlur = () => finish(true);
    input.addEventListener("blur", onBlur);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
  }
  // перемещает dragId на позицию targetId в порядке сверху-вниз
  _reorder(dragId, targetId) {
    const order = this.host.getLayerObjects().map((o) => o.id);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0)
      return;
    order.splice(from, 1);
    order.splice(to, 0, dragId);
    this.host.reorderTo(order);
    this.refresh();
  }
};

// src/ExportModal.ts
var import_obsidian2 = require("obsidian");
var ExportModal = class extends import_obsidian2.Modal {
  constructor(app, boardData, boardRoot, defaultFilename) {
    super(app);
    this.format = "png";
    this.onConfirm = null;
    this.boardData = boardData;
    this.boardRoot = boardRoot;
    this.filename = defaultFilename;
  }
  openAndWait() {
    return new Promise((resolve) => {
      this.onConfirm = resolve;
      this.open();
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ib-export-modal");
    contentEl.createEl("h2", { text: "Export Board" });
    new import_obsidian2.Setting(contentEl).setName("Format").setDesc("Choose the export format").addDropdown((d) => {
      d.addOptions({ png: "PNG Image", svg: "SVG Vector", json: "JSON Data" });
      d.setValue(this.format);
      d.onChange((v) => {
        this.format = v;
        this._updateExtension();
      });
    });
    let filenameInput;
    new import_obsidian2.Setting(contentEl).setName("Filename").setDesc("Name of the exported file").addText((t) => {
      filenameInput = t.inputEl;
      t.setValue(this.filename);
      t.onChange((v) => {
        this.filename = v;
      });
    });
    const btnContainer = contentEl.createDiv({ cls: "ib-export-btn-container" });
    const cancelBtn = btnContainer.createEl("button", { text: "Cancel", cls: "ib-export-btn ib-export-btn--cancel" });
    cancelBtn.addEventListener("click", () => {
      var _a;
      this.close();
      (_a = this.onConfirm) == null ? void 0 : _a.call(this, null);
    });
    const exportBtn = btnContainer.createEl("button", { text: "Export", cls: "ib-export-btn ib-export-btn--confirm" });
    exportBtn.addEventListener("click", async () => {
      await this._doExport();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
  _updateExtension() {
    const base = this.filename.replace(/\.(png|svg|json)$/i, "");
    this.filename = `${base}.${this.format}`;
    const input = this.contentEl.querySelector(".setting-item:nth-child(3) input");
    if (input)
      input.value = this.filename;
  }
  async _doExport() {
    var _a;
    try {
      switch (this.format) {
        case "json":
          await this._exportJSON();
          break;
        case "png":
          await this._exportPNG();
          break;
        case "svg":
          await this._exportSVG();
          break;
      }
      this.close();
      (_a = this.onConfirm) == null ? void 0 : _a.call(this, { format: this.format, filename: this.filename });
    } catch (err) {
      new import_obsidian2.Notice(`Export failed: ${err.message}`);
    }
  }
  async _exportJSON() {
    const json = JSON.stringify(this.boardData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    this._downloadBlob(blob, this._ensureExtension(this.filename, ".json"));
    new import_obsidian2.Notice("Board exported as JSON");
  }
  async _exportPNG() {
    const canvas = await this._renderToCanvas();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob)
      throw new Error("Failed to create PNG");
    this._downloadBlob(blob, this._ensureExtension(this.filename, ".png"));
    new import_obsidian2.Notice("Board exported as PNG");
  }
  async _exportSVG() {
    const svgContent = this._renderToSVG();
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    this._downloadBlob(blob, this._ensureExtension(this.filename, ".svg"));
    new import_obsidian2.Notice("Board exported as SVG");
  }
  async _renderToCanvas() {
    const nodes = this.boardData.nodes;
    const strokes = this.boardData.strokes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    for (const s of strokes) {
      for (const [px, py] of s.points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }
    const padding = 40;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1e1e2e";
    ctx.fillRect(0, 0, width, height);
    ctx.translate(padding - minX, padding - minY);
    const drawStroke = (s) => {
      if (s.points.length < 2 || s.hidden)
        return;
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "marker") {
        ctx.globalAlpha = s.opacity * 0.45;
        ctx.lineWidth = s.width * 3;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++)
        ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
      ctx.restore();
    };
    const drawNode = (n) => {
      if (n.hidden)
        return;
      ctx.save();
      ctx.fillStyle = n.fillColor.startsWith("var(") ? "#2d2d3d" : n.fillColor;
      ctx.strokeStyle = n.borderColor.startsWith("var(") ? "#4a4a5a" : n.borderColor;
      ctx.lineWidth = n.borderWidth;
      if (n.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(n.x + n.width / 2, n.y + n.height / 2, n.width / 2, n.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const r = Math.min(n.borderRadius, n.width / 2, n.height / 2);
        this._roundRect(ctx, n.x, n.y, n.width, n.height, r);
        ctx.fill();
        ctx.stroke();
      }
      if (n.text) {
        ctx.fillStyle = "#cccccc";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.text, n.x + n.width / 2, n.y + n.height / 2, n.width - 16);
      }
      ctx.restore();
    };
    for (const it of this._orderedItems(nodes, strokes)) {
      if (it.kind === "stroke")
        drawStroke(it.item);
      else
        drawNode(it.item);
    }
    return canvas;
  }
  _renderToSVG() {
    const nodes = this.boardData.nodes;
    const strokes = this.boardData.strokes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    for (const s of strokes) {
      for (const [px, py] of s.points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }
    const padding = 40;
    const w = maxX - minX + padding * 2, h = maxY - minY + padding * 2;
    const ox = padding - minX, oy = padding - minY;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
    parts.push(`<rect width="${w}" height="${h}" fill="#1e1e2e"/>`);
    parts.push(`<g transform="translate(${ox},${oy})">`);
    const strokeSvg = (s) => {
      if (s.points.length < 2 || s.hidden)
        return;
      const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
      const opacity = s.tool === "marker" ? s.opacity * 0.45 : s.opacity;
      const width = s.tool === "marker" ? s.width * 3 : s.width;
      parts.push(`<path d="${d}" stroke="${s.color}" stroke-width="${width}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`);
    };
    const nodeSvg = (n) => {
      if (n.hidden)
        return;
      const fill = n.fillColor.startsWith("var(") ? "#2d2d3d" : n.fillColor;
      const stroke = n.borderColor.startsWith("var(") ? "#4a4a5a" : n.borderColor;
      if (n.type === "ellipse") {
        parts.push(`<ellipse cx="${n.x + n.width / 2}" cy="${n.y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${n.borderWidth}"/>`);
      } else {
        const r = Math.min(n.borderRadius, n.width / 2, n.height / 2);
        parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${n.borderWidth}"/>`);
      }
      if (n.text) {
        parts.push(`<text x="${n.x + n.width / 2}" y="${n.y + n.height / 2}" fill="#cccccc" font-size="14" text-anchor="middle" dominant-baseline="central">${this._escapeXml(n.text)}</text>`);
      }
    };
    for (const it of this._orderedItems(nodes, strokes)) {
      if (it.kind === "stroke")
        strokeSvg(it.item);
      else
        nodeSvg(it.item);
    }
    parts.push("</g>");
    parts.push("</svg>");
    return parts.join("\n");
  }
  // объединённый список объектов по возрастанию z (для корректного порядка слоёв)
  _orderedItems(nodes, strokes) {
    var _a, _b;
    const items = [];
    for (const s of strokes)
      items.push({ kind: "stroke", z: (_a = s.zIndex) != null ? _a : 0, item: s });
    for (const n of nodes)
      items.push({ kind: "node", z: (_b = n.zIndex) != null ? _b : 0, item: n });
    return items.sort((a, b) => a.z - b.z);
  }
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  _ensureExtension(filename, ext) {
    if (filename.toLowerCase().endsWith(ext))
      return filename;
    return filename.replace(/\.[^.]+$/, "") + ext;
  }
  _escapeXml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
};

// src/Storage.ts
var import_obsidian3 = require("obsidian");
function createEmptyBoard() {
  return {
    version: 1,
    nodes: [],
    connectors: [],
    strokes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    laserParams: { ...DEFAULT_SETTINGS.laserParams }
  };
}

// src/CanvasView.ts
var VIEW_TYPE_BOARD = "interactive-board-view";
var CanvasView = class extends import_obsidian4.TextFileView {
  constructor(leaf) {
    super(leaf);
    this.boardData = createEmptyBoard();
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.currentTool = "select";
    this.currentColor = "#e0e0e0";
    this.currentWidth = 2;
    this.settings = { ...DEFAULT_SETTINGS };
    // единый счётчик z-порядка (общий для нод/штрихов/коннекторов)
    this.zCounter = 1;
    this._suppressPanel = false;
    this.layersPanel = null;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragNodeId = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isResizing = false;
    this.resizeNodeId = null;
    this.resizeStart = { x: 0, y: 0, w: 0, h: 0, nodeX: 0, nodeY: 0 };
    this.resizeNodeType = null;
    this.resizeDirection = "se";
    this.isDrawing = false;
    this.isConnecting = false;
    this.connectStartId = null;
    this.spaceHeld = false;
    this.pointerOnToolbar = false;
    this.isCreatingShape = false;
    this.creationOrigin = { x: 0, y: 0 };
    this.creationPreview = null;
    this.creationTool = null;
    this.autosaveTimer = null;
    this.dirty = false;
    this.animFrameId = null;
    // ОБРАБОТКА НАЖАТИЯ МЫШИ — главный «роутер» действий.
    // В зависимости от активного инструмента: пан холста, рисование, создание фигуры,
    // соединитель, выделение/перетаскивание/ресайз. Решает, что начать делать.
    this._onPointerDown = (e) => {
      if (this.pointerOnToolbar)
        return;
      const boardPt = this._screenToBoard(e.clientX, e.clientY);
      if (e.button === 1) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewport.x, y: e.clientY - this.viewport.y };
        this.boardRoot.style.cursor = "grabbing";
        return;
      }
      if (this.spaceHeld) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewport.x, y: e.clientY - this.viewport.y };
        this.boardRoot.style.cursor = "grabbing";
        return;
      }
      if (["pencil", "marker", "eraser", "laser"].includes(this.currentTool)) {
        this.isDrawing = true;
        const tool = this.currentTool;
        const color = this.currentTool === "eraser" ? "#000" : this.currentTool === "laser" ? this.settings.laserParams.color : this.currentColor;
        this.drawMgr.startStroke(tool, color, this.currentWidth);
        this.drawMgr.addPoint(boardPt.x, boardPt.y);
        return;
      }
      const target = e.target.closest(".ib-node");
      if (this.currentTool === "connector") {
        if (target) {
          const nodeId = target.dataset.nodeId;
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
      if (this.currentTool === "select") {
        if (target) {
          const nodeId = target.dataset.nodeId;
          const handleEl = e.target.closest(".ib-resize-handle");
          if (handleEl) {
            this.isResizing = true;
            this.resizeNodeId = nodeId;
            const node2 = this.nodeMgr.getNode(nodeId);
            this.resizeDirection = handleEl.dataset.resizeDir || "se";
            this.resizeStart = {
              x: e.clientX,
              y: e.clientY,
              w: node2.width,
              h: node2.height,
              nodeX: node2.x,
              nodeY: node2.y
            };
            this.resizeNodeType = node2.type;
            const resizeEl = this.nodeMgr.getNodeElement(nodeId);
            if (resizeEl)
              resizeEl.style.transition = "none";
            return;
          }
          this.selectionMgr.select(nodeId, e.shiftKey);
          this.isDragging = true;
          this.dragNodeId = nodeId;
          const node = this.nodeMgr.getNode(nodeId);
          this.dragOffset = { x: boardPt.x - node.x, y: boardPt.y - node.y };
        } else {
          this.selectionMgr.deselectAll();
          this.selectionMgr.startRubberBand(boardPt.x, boardPt.y);
        }
        return;
      }
      if (this.currentTool === "image") {
        this.isCreatingShape = true;
        this.creationOrigin = { ...boardPt };
        this.creationTool = "image";
        this._showCreationPreview(boardPt.x, boardPt.y);
        return;
      }
      if (["rectangle", "ellipse", "text", "group"].includes(this.currentTool)) {
        this.isCreatingShape = true;
        this.creationOrigin = { ...boardPt };
        this.creationTool = this.currentTool;
        this._showCreationPreview(boardPt.x, boardPt.y);
        return;
      }
    };
    this._onPointerMove = (e) => {
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
        if (dir.includes("e")) {
          newW = Math.max(MIN_W, this.resizeStart.w + dx);
        } else if (dir.includes("w")) {
          const dw = Math.min(dx, this.resizeStart.w - MIN_W);
          newX = this.resizeStart.nodeX + dw;
          newW = this.resizeStart.w - dw;
        }
        if (dir.includes("s")) {
          newH = Math.max(MIN_H, this.resizeStart.h + dy);
        } else if (dir.includes("n")) {
          const dh = Math.min(dy, this.resizeStart.h - MIN_H);
          newY = this.resizeStart.nodeY + dh;
          newH = this.resizeStart.h - dh;
        }
        if (this.resizeNodeType === "ellipse") {
          const maxDim = Math.max(newW, newH);
          if (dir.length === 2) {
            newW = maxDim;
            newH = maxDim;
          }
        }
        this.nodeMgr.updateNode(this.resizeNodeId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH
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
    this._onPointerUp = (e) => {
      const boardPt = this._screenToBoard(e.clientX, e.clientY);
      if (this.isPanning) {
        this.isPanning = false;
        this.boardRoot.style.cursor = "";
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
          if (el)
            el.style.transition = "";
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
    this._onDblClick = (e) => {
      if (this.pointerOnToolbar)
        return;
      const target = e.target.closest(".ib-node");
      if (target) {
        const nodeId = target.dataset.nodeId;
        const node = this.nodeMgr.getNode(nodeId);
        if (node) {
          this.selectionMgr.startTextEdit(nodeId);
        }
      }
    };
    this._onWheel = (e) => {
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
    this._onKeyDown = (e) => {
      if (this._isEditingText())
        return;
      if (e.key === " ") {
        this.spaceHeld = true;
        e.preventDefault();
      }
      if (e.key === "Delete" || e.key === "Backspace")
        this.selectionMgr.deleteSelected();
      if (e.ctrlKey && e.key === "z")
        this.historyMgr.undo();
      if (e.ctrlKey && e.key === "y")
        this.historyMgr.redo();
      if (e.ctrlKey && e.key === "c")
        this.selectionMgr.copySelected();
      if (e.ctrlKey && e.key === "v")
        this.selectionMgr.paste();
      if (!e.ctrlKey && !e.altKey) {
        const map = {
          v: "select",
          r: "rectangle",
          e: "ellipse",
          t: "text",
          i: "image",
          c: "connector",
          p: "pencil",
          m: "marker",
          x: "eraser",
          l: "laser"
        };
        if (map[e.key]) {
          this.currentTool = map[e.key];
          this.toolbar.setActiveTool(this.currentTool);
          this._updateDrawActiveState();
        }
      }
      if (e.key === "]" || e.key === "[") {
        const ids = this.selectionMgr.getSelectedIds();
        if (ids.length) {
          e.preventDefault();
          if (e.key === "]") {
            e.shiftKey ? this.bringToFront(ids) : this._moveInOrder(ids, -1);
          } else {
            e.shiftKey ? this.sendToBack(ids) : this._moveInOrder(ids, 1);
          }
        }
      }
      if (e.key === "F11") {
        e.preventDefault();
        this.fullscreenMgr.toggle();
      }
    };
    this._onKeyUp = (e) => {
      if (this._isEditingText())
        return;
      if (e.key === " ")
        this.spaceHeld = false;
    };
    this._onResize = () => {
      this._resize();
    };
  }
  getViewType() {
    return VIEW_TYPE_BOARD;
  }
  getDisplayText() {
    var _a, _b;
    return (_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "Interactive Board";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async onOpen() {
    this._buildDOM();
    this._initManagers();
    this._initToolbar();
    this._bindEvents();
    this._startAutosave();
    this._startRenderLoop();
    this._resize();
    this._guardToolbar();
  }
  async onClose() {
    var _a;
    this._stopAutosave();
    this._stopRenderLoop();
    this.laserRenderer.stop();
    this.fullscreenMgr.exit();
    this.toolbar.destroy();
    (_a = this.layersPanel) == null ? void 0 : _a.destroy();
  }
  // СОХРАНЕНИЕ: Obsidian вызывает это, чтобы получить содержимое файла .board.json.
  // Собираем всё с менеджеров в один объект и сериализуем в JSON-текст.
  getViewData() {
    this._collectBoardData();
    return JSON.stringify(this.boardData, null, 2);
  }
  // ЗАГРУЗКА: Obsidian отдаёт сюда текст файла. Парсим JSON и восстанавливаем доску.
  setViewData(data, clear) {
    try {
      this.boardData = JSON.parse(data);
    } catch (e) {
      this.boardData = createEmptyBoard();
    }
    if (clear)
      this._clearAll();
    this._loadFromBoardData();
  }
  clear() {
    this.boardData = createEmptyBoard();
    this._clearAll();
  }
  _buildDOM() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ib-root");
    this.boardRoot = contentEl.createDiv({ cls: "ib-board-root" });
    this.gridCanvas = this.boardRoot.createEl("canvas", { cls: "ib-grid-canvas" });
    this.worldLayer = this.boardRoot.createDiv({ cls: "ib-world-layer" });
    this.defsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.defsSvg.classList.add("ib-defs-svg");
    this.boardRoot.appendChild(this.defsSvg);
    this.tempCanvas = this.boardRoot.createEl("canvas", { cls: "ib-temp-canvas" });
    this.laserCanvas = this.boardRoot.createEl("canvas", { cls: "ib-laser-canvas" });
  }
  _initManagers() {
    this.historyMgr = new HistoryManager();
    this.nodeMgr = new NodeManager(this.worldLayer, this.historyMgr, this.app);
    this.connectorMgr = new ConnectorManager(this.worldLayer, this.defsSvg, this.nodeMgr, this.historyMgr);
    this.drawMgr = new DrawManager(this.worldLayer, this.tempCanvas, this.historyMgr);
    this.laserRenderer = new LaserRenderer(this.laserCanvas, this.drawMgr, { ...this.settings.laserParams });
    this.selectionMgr = new SelectionManager(this.worldLayer, this.nodeMgr, this.connectorMgr, this.historyMgr);
    this.fullscreenMgr = new FullscreenManager(this.boardRoot);
    const allocZ = () => this.zCounter++;
    this.nodeMgr.zAlloc = allocZ;
    this.connectorMgr.zAlloc = allocZ;
    this.drawMgr.zAlloc = allocZ;
    const markDirty = () => {
      this.dirty = true;
      this._refreshLayersPanel();
    };
    this.nodeMgr.onChange = markDirty;
    this.connectorMgr.onChange = markDirty;
    this.drawMgr.onChange = markDirty;
    this.connectorMgr.onContextMenu = (x, y, items) => this._showContextMenu(x, y, items);
    this.laserRenderer.start();
  }
  _showContextMenu(sx, sy, items) {
    var _a;
    (_a = this.boardRoot.querySelector(".ib-context-menu")) == null ? void 0 : _a.remove();
    const menu = document.createElement("div");
    menu.className = "ib-context-menu";
    const rect = this.boardRoot.getBoundingClientRect();
    menu.style.left = `${sx - rect.left}px`;
    menu.style.top = `${sy - rect.top}px`;
    for (const item of items) {
      const btn = document.createElement("button");
      btn.className = "ib-context-menu-item";
      btn.textContent = item.label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        item.action();
        menu.remove();
      });
      menu.appendChild(btn);
    }
    this.boardRoot.appendChild(menu);
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", close, true);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  }
  _initToolbar() {
    this.toolbar = new Toolbar(this.boardRoot, {
      onToolChange: (tool) => {
        this.currentTool = tool;
        this._updateDrawActiveState();
      },
      onColorChange: (c) => {
        this.currentColor = c;
        this._applyColorToSelection(c);
      },
      onWidthChange: (w) => {
        this.currentWidth = w;
      },
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
      onToggleLayers: () => {
        var _a;
        return (_a = this.layersPanel) == null ? void 0 : _a.toggle();
      }
    });
    this.layersPanel = new LayersPanel(this.boardRoot, {
      getLayerObjects: () => this.getLayerObjects(),
      reorderTo: (ids) => this.reorderTo(ids),
      setObjectHidden: (id, hidden) => this.setObjectHidden(id, hidden),
      setObjectName: (id, name) => this.setObjectName(id, name),
      selectObject: (id) => this.selectObject(id),
      getSelectedIds: () => this.selectionMgr.getSelectedIds()
    });
    this.selectionMgr.onSelectionChange = (ids) => this._onSelectionChange(ids);
  }
  _onSelectionChange(ids) {
    var _a, _b;
    const node = ids.length === 1 ? (_a = this.nodeMgr.getNode(ids[0])) != null ? _a : null : null;
    this.toolbar.setSelectionContext(node);
    (_b = this.layersPanel) == null ? void 0 : _b.refresh();
  }
  _applyColorToSelection(color) {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node && node.type !== "image") {
        this.nodeMgr.updateNode(id, { fillColor: color });
      }
    }
  }
  _applyFontSizeToSelection(size) {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { fontSize: size });
      }
    }
  }
  _applyFontFamilyToSelection(family) {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { fontFamily: family });
      }
    }
  }
  _applyTextColorToSelection(color) {
    const ids = this.selectionMgr.getSelectedIds();
    for (const id of ids) {
      const node = this.nodeMgr.getNode(id);
      if (node) {
        this.nodeMgr.updateNode(id, { textColor: color });
      }
    }
  }
  _openExportModal() {
    var _a, _b;
    this._collectBoardData();
    const defaultName = ((_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "board") + ".png";
    const modal = new ExportModal(this.app, this.boardData, this.boardRoot, defaultName);
    modal.openAndWait();
  }
  _bindEvents() {
    const root = this.boardRoot;
    root.addEventListener("pointerdown", this._onPointerDown);
    root.addEventListener("pointermove", this._onPointerMove);
    root.addEventListener("pointerup", this._onPointerUp);
    root.addEventListener("wheel", this._onWheel, { passive: false });
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("resize", this._onResize);
    root.addEventListener("contextmenu", (e) => {
      if (e.button === 1)
        e.preventDefault();
      const nodeEl = e.target.closest(".ib-node");
      if (nodeEl) {
        e.preventDefault();
        const nodeId = nodeEl.dataset.nodeId;
        if (nodeId && !this.selectionMgr.isSelected(nodeId))
          this.selectionMgr.select(nodeId);
        const ids = this.selectionMgr.getSelectedIds();
        if (!ids.length)
          return;
        this._showContextMenu(e.clientX, e.clientY, [
          { label: "\u041D\u0430 \u043F\u0435\u0440\u0435\u0434\u043D\u0438\u0439 \u043F\u043B\u0430\u043D", action: () => this.bringToFront(ids) },
          { label: "\u041D\u0430 \u0437\u0430\u0434\u043D\u0438\u0439 \u043F\u043B\u0430\u043D", action: () => this.sendToBack(ids) },
          { label: "\u0412\u044B\u0448\u0435", action: () => this._moveInOrder(ids, -1) },
          { label: "\u041D\u0438\u0436\u0435", action: () => this._moveInOrder(ids, 1) }
        ]);
      }
    });
    root.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.classList.add("ib-drag-over");
    });
    root.addEventListener("dragleave", (e) => {
      e.preventDefault();
      root.classList.remove("ib-drag-over");
    });
    root.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.classList.remove("ib-drag-over");
      this._handleDrop(e);
    });
    root.addEventListener("paste", (e) => {
      this._handlePaste(e);
    });
  }
  _showCreationPreview(x, y) {
    this.creationPreview = document.createElement("div");
    this.creationPreview.className = "ib-creation-preview";
    if (this.creationTool === "ellipse") {
      this.creationPreview.classList.add("ib-creation-preview--ellipse");
    }
    if (this.creationTool === "text") {
      this.creationPreview.classList.add("ib-creation-preview--text");
    }
    this.creationPreview.style.left = `${x}px`;
    this.creationPreview.style.top = `${y}px`;
    this.creationPreview.style.width = "0px";
    this.creationPreview.style.height = "0px";
    this.worldLayer.appendChild(this.creationPreview);
  }
  _updateCreationPreview(currentX, currentY) {
    if (!this.creationPreview)
      return;
    const x = Math.min(this.creationOrigin.x, currentX);
    const y = Math.min(this.creationOrigin.y, currentY);
    const w = Math.abs(currentX - this.creationOrigin.x);
    const h = Math.abs(currentY - this.creationOrigin.y);
    this.creationPreview.style.left = `${x}px`;
    this.creationPreview.style.top = `${y}px`;
    this.creationPreview.style.width = `${w}px`;
    this.creationPreview.style.height = `${h}px`;
  }
  _finishCreation(endX, endY) {
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
    if (this.creationTool === "image") {
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
      h = this.creationTool === "text" ? 40 : 80;
    } else {
      w = Math.max(w, 40);
      h = Math.max(h, 30);
    }
    const type = this.creationTool;
    const extra = {};
    if (type !== "text") {
      extra.fillColor = this.currentColor;
    }
    const node = this.nodeMgr.createNode(type, x, y, w, h, extra);
    this.selectionMgr.select(node.id);
    this.creationTool = null;
    if (type === "text") {
      setTimeout(() => {
        this.selectionMgr.startTextEdit(node.id);
      }, 50);
    }
  }
  _openImagePicker(x, y, targetW = 0, targetH = 0) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      var _a;
      const file = (_a = input.files) == null ? void 0 : _a[0];
      if (file) {
        await this._importImageFile(file, x, y, targetW, targetH);
      }
      input.remove();
    });
    input.addEventListener("cancel", () => input.remove());
    input.click();
  }
  async _handleDrop(e) {
    var _a;
    const files = (_a = e.dataTransfer) == null ? void 0 : _a.files;
    if (!files || files.length === 0)
      return;
    const boardPt = this._screenToBoard(e.clientX, e.clientY);
    let offsetX = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        await this._importImageFile(file, boardPt.x + offsetX, boardPt.y, 0, 0, true);
        offsetX += 220;
      }
    }
  }
  async _handlePaste(e) {
    var _a;
    const items = (_a = e.clipboardData) == null ? void 0 : _a.items;
    if (!items)
      return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
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
  async _importImageFile(file, x, y, targetW = 0, targetH = 0, fullRes = false) {
    var _a, _b, _c;
    const vaultDir = (_c = (_b = (_a = this.file) == null ? void 0 : _a.parent) == null ? void 0 : _b.path) != null ? _c : "";
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destPath = vaultDir ? `${vaultDir}/img_${timestamp}_${safeName}` : `img_${timestamp}_${safeName}`;
    const buffer = await file.arrayBuffer();
    const created = await this.app.vault.createBinary(destPath, buffer);
    const resourcePath = this.app.vault.getResourcePath(created);
    const dims = await this._getImageDimensions(resourcePath);
    let w, h;
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
    const node = this.nodeMgr.createNode("image", x, y, w, h, {
      imagePath: resourcePath,
      vaultImagePath: destPath
    });
    this.selectionMgr.select(node.id);
  }
  _getImageDimensions(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 200, h: 150 });
      img.src = src;
    });
  }
  _isEditingText() {
    const el = document.activeElement;
    if (!el)
      return false;
    if (el.isContentEditable)
      return true;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }
  _applyViewport() {
    this.worldLayer.style.transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.zoom})`;
    this._drawGrid();
  }
  // Перевод координат экрана → координаты доски: вычитаем сдвиг камеры и делим на зум.
  // Нужно, чтобы клик попадал в правильную точку независимо от того, куда сдвинут/как
  // приближён холст.
  _screenToBoard(sx, sy) {
    const rect = this.boardRoot.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.viewport.x) / this.viewport.zoom,
      y: (sy - rect.top - this.viewport.y) / this.viewport.zoom
    };
  }
  _fitToScreen() {
    const nodes = this.nodeMgr.getAllNodes();
    if (nodes.length === 0) {
      this.viewport = { x: 0, y: 0, zoom: 1 };
      this._applyViewport();
      return;
    }
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
  _drawGrid() {
    const canvas = this.gridCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gs = this.settings.gridSize * this.viewport.zoom;
    if (gs < 6)
      return;
    const offX = this.viewport.x % gs;
    const offY = this.viewport.y % gs;
    ctx.strokeStyle = "var(--background-modifier-border)";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    for (let x = offX; x < canvas.width; x += gs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = offY; y < canvas.height; y += gs) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  _resize() {
    const rect = this.boardRoot.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    [this.gridCanvas, this.tempCanvas, this.laserCanvas].forEach((c) => {
      c.width = w;
      c.height = h;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    });
    this.drawMgr.resize(w, h);
    this.laserRenderer.resize(w, h);
    this._drawGrid();
  }
  _startRenderLoop() {
    const loop = () => {
      this.drawMgr.renderWithTransform(this.viewport.x, this.viewport.y, this.viewport.zoom);
      this.laserRenderer.renderWithTransform(this.viewport.x, this.viewport.y, this.viewport.zoom);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }
  _stopRenderLoop() {
    if (this.animFrameId !== null)
      cancelAnimationFrame(this.animFrameId);
  }
  _startAutosave() {
    this.autosaveTimer = setInterval(() => {
      if (this.dirty) {
        this.dirty = false;
        this.requestSave();
      }
    }, this.settings.autosaveIntervalMs);
    this.boardRoot.addEventListener("dblclick", this._onDblClick);
  }
  _stopAutosave() {
    if (this.autosaveTimer)
      clearInterval(this.autosaveTimer);
  }
  _collectBoardData() {
    this.boardData.nodes = this.nodeMgr.serialise();
    this.boardData.connectors = this.connectorMgr.serialise();
    this.boardData.strokes = this.drawMgr.serialise(this.settings.saveTempStrokes);
    this.boardData.viewport = { ...this.viewport };
    this.boardData.laserParams = { ...this.settings.laserParams };
  }
  _loadFromBoardData() {
    this.nodeMgr.deserialise(this.boardData.nodes);
    this.connectorMgr.deserialise(this.boardData.connectors);
    this.drawMgr.deserialise(this.boardData.strokes);
    this._syncZCounter();
    this.viewport = { ...this.boardData.viewport };
    if (this.boardData.laserParams) {
      this.laserRenderer.setParams(this.boardData.laserParams);
    }
    this._applyViewport();
    this._refreshLayersPanel();
  }
  // объединённый список всех объектов для панели слоёв (z по убыванию = сверху вниз)
  getLayerObjects() {
    return [
      ...this.nodeMgr.getLayerObjects(),
      ...this.drawMgr.getLayerObjects(),
      ...this.connectorMgr.getLayerObjects()
    ].sort((a, b) => b.zIndex - a.zIndex);
  }
  _syncZCounter() {
    let max = 0;
    for (const o of this.getLayerObjects())
      max = Math.max(max, o.zIndex);
    this.zCounter = max + 1;
  }
  // ─── Управление порядком (единый z) ─────────────────────────
  // маршрутизируем по всем менеджерам — сработает только владелец id
  _applyZ(id, z) {
    this.nodeMgr.setZIndex(id, z);
    this.connectorMgr.setZIndex(id, z);
    this.drawMgr.setZIndex(id, z);
  }
  setObjectHidden(id, hidden) {
    this.nodeMgr.setHidden(id, hidden);
    this.connectorMgr.setHidden(id, hidden);
    this.drawMgr.setHidden(id, hidden);
  }
  setObjectName(id, name) {
    this.nodeMgr.setName(id, name);
    this.connectorMgr.setName(id, name);
    this.drawMgr.setName(id, name);
  }
  selectObject(id) {
    if (this.nodeMgr.getNode(id)) {
      this.currentTool = "select";
      this.toolbar.setActiveTool("select");
      this._updateDrawActiveState();
      this.selectionMgr.select(id);
    }
  }
  _orderedIds() {
    return this.getLayerObjects().map((o) => o.id);
  }
  // упорядочивает все объекты: первый в массиве = верхний (макс z)
  reorderTo(orderedTopToBottom) {
    const n = orderedTopToBottom.length;
    this._suppressPanel = true;
    orderedTopToBottom.forEach((id, i) => this._applyZ(id, n - i));
    this.zCounter = n + 1;
    this._suppressPanel = false;
    this.dirty = true;
    this._refreshLayersPanel();
  }
  bringToFront(ids) {
    const sel = this._orderedIds().filter((id) => ids.includes(id));
    const rest = this._orderedIds().filter((id) => !ids.includes(id));
    this.reorderTo([...sel, ...rest]);
  }
  sendToBack(ids) {
    const sel = this._orderedIds().filter((id) => ids.includes(id));
    const rest = this._orderedIds().filter((id) => !ids.includes(id));
    this.reorderTo([...rest, ...sel]);
  }
  // dir = -1: выше (к началу), +1: ниже (к концу)
  _moveInOrder(ids, dir) {
    const order = this._orderedIds();
    const idset = new Set(ids);
    if (dir === -1) {
      for (let i = 1; i < order.length; i++) {
        if (idset.has(order[i]) && !idset.has(order[i - 1])) {
          [order[i - 1], order[i]] = [order[i], order[i - 1]];
        }
      }
    } else {
      for (let i = order.length - 2; i >= 0; i--) {
        if (idset.has(order[i]) && !idset.has(order[i + 1])) {
          [order[i + 1], order[i]] = [order[i], order[i + 1]];
        }
      }
    }
    this.reorderTo(order);
  }
  _refreshLayersPanel() {
    var _a;
    if (this._suppressPanel)
      return;
    (_a = this.layersPanel) == null ? void 0 : _a.refresh();
  }
  _clearAll() {
    this.nodeMgr.clear();
    this.connectorMgr.clear();
    this.drawMgr.clearTemp();
    this.historyMgr.clear();
  }
  _guardToolbar() {
    const toolbarEl = this.toolbar.getElement();
    toolbarEl.addEventListener("pointerenter", () => {
      this.pointerOnToolbar = true;
    });
    toolbarEl.addEventListener("pointerleave", () => {
      this.pointerOnToolbar = false;
    });
    toolbarEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
  }
  // при активном инструменте рисования объекты пропускают клики
  _updateDrawActiveState() {
    const isDrawTool = ["pencil", "marker", "eraser", "laser"].includes(this.currentTool);
    this.worldLayer.classList.toggle("ib-draw-active", isDrawTool);
  }
};

// src/SettingsTab.ts
var import_obsidian5 = require("obsidian");
var InteractiveBoardSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Interactive Board \u2014 Settings" });
    new import_obsidian5.Setting(containerEl).setName("Grid size").setDesc("Size of the grid in pixels.").addSlider((s) => s.setLimits(10, 80, 5).setValue(this.plugin.settings.gridSize).setDynamicTooltip().onChange(async (v) => {
      this.plugin.settings.gridSize = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Snap to grid").setDesc("Snap nodes to the grid when moving.").addToggle((t) => t.setValue(this.plugin.settings.snapToGrid).onChange(async (v) => {
      this.plugin.settings.snapToGrid = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Default colours" });
    new import_obsidian5.Setting(containerEl).setName("Node fill").addText((t) => t.setValue(this.plugin.settings.defaultNodeFill).onChange(async (v) => {
      this.plugin.settings.defaultNodeFill = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Node border").addText((t) => t.setValue(this.plugin.settings.defaultNodeBorder).onChange(async (v) => {
      this.plugin.settings.defaultNodeBorder = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Connector colour").addText((t) => t.setValue(this.plugin.settings.defaultConnectorColor).onChange(async (v) => {
      this.plugin.settings.defaultConnectorColor = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Autosave" });
    new import_obsidian5.Setting(containerEl).setName("Autosave interval (ms)").addText((t) => t.setValue(String(this.plugin.settings.autosaveIntervalMs)).onChange(async (v) => {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 1e3) {
        this.plugin.settings.autosaveIntervalMs = n;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian5.Setting(containerEl).setName("Save temporary strokes").setDesc("If enabled, temporary annotation strokes are persisted in the board file.").addToggle((t) => t.setValue(this.plugin.settings.saveTempStrokes).onChange(async (v) => {
      this.plugin.settings.saveTempStrokes = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Laser pointer" });
    new import_obsidian5.Setting(containerEl).setName("Laser colour").addText((t) => t.setValue(this.plugin.settings.laserParams.color).onChange(async (v) => {
      this.plugin.settings.laserParams.color = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Laser width").addSlider((s) => s.setLimits(1, 12, 1).setValue(this.plugin.settings.laserParams.width).setDynamicTooltip().onChange(async (v) => {
      this.plugin.settings.laserParams.width = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Fade duration (ms)").addText((t) => t.setValue(String(this.plugin.settings.laserParams.duration)).onChange(async (v) => {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 100) {
        this.plugin.settings.laserParams.duration = n;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian5.Setting(containerEl).setName("Fade curve").addDropdown((d) => d.addOptions({ linear: "Linear", exp: "Exponential" }).setValue(this.plugin.settings.laserParams.fadeCurve).onChange(async (v) => {
      this.plugin.settings.laserParams.fadeCurve = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("Glow radius").addSlider((s) => s.setLimits(0, 30, 1).setValue(this.plugin.settings.laserParams.glow).setDynamicTooltip().onChange(async (v) => {
      this.plugin.settings.laserParams.glow = v;
      await this.plugin.saveSettings();
    }));
  }
};

// src/main.ts
var InteractiveBoardPlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_BOARD, (leaf) => {
      const view = new CanvasView(leaf);
      view.settings = this.settings;
      return view;
    });
    this.registerExtensions(["board"], VIEW_TYPE_BOARD);
    this.addSettingTab(new InteractiveBoardSettingTab(this.app, this));
    this.addRibbonIcon("layout-dashboard", "New Interactive Board", async () => {
      await this.createNewBoard();
    });
    this.addCommand({
      id: "create-new-board",
      name: "Create new board",
      callback: async () => {
        await this.createNewBoard();
      }
    });
    this.addCommand({
      id: "open-board-fullscreen",
      name: "Toggle fullscreen",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(CanvasView);
        if (view) {
          if (!checking) {
          }
          return true;
        }
        return false;
      }
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BOARD);
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async createNewBoard() {
    const name = `Board ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    let path = `${name}.board`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${name} ${counter++}.board`;
    }
    const emptyData = JSON.stringify(
      {
        version: 1,
        nodes: [],
        connectors: [],
        strokes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        laserParams: this.settings.laserParams
      },
      null,
      2
    );
    const file = await this.app.vault.create(path, emptyData);
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
};
