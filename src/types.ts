// типы данных для доски

export type NodeType = 'rectangle' | 'ellipse' | 'text' | 'group' | 'image';

export interface BoardNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  text: string;
  icon: string;
  imagePath?: string;
  vaultImagePath?: string; // путь в vault (сохраняется)
  children?: string[];     // только для групп
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  zIndex: number;
  name?: string;           // имя для панели слоёв
  hidden?: boolean;        // скрыт ли объект
}

export type LineType = 'straight' | 'quadratic' | 'orthogonal';
export type ArrowHead = 'arrow' | 'circle' | 'none';

export interface Connector {
  id: string;
  startItemId: string;
  endItemId: string;
  lineType: LineType;
  color: string;
  width: number;
  arrowStart: ArrowHead;
  arrowEnd: ArrowHead;
  dashed: boolean;
  zIndex?: number;
  name?: string;
  hidden?: boolean;
}

export type StrokeTool = 'pencil' | 'marker' | 'eraser' | 'laser';
export type StrokeLayer = 'permanent' | 'temp' | 'laser';

export interface Stroke {
  id: string;
  type: 'stroke';
  tool: StrokeTool;
  layer: StrokeLayer;
  points: [number, number][];
  color: string;
  width: number;
  opacity: number;
  smoothing: number;
  createdAt?: number;
  pointTimestamps?: number[]; // для посегментного затухания лазера
  zIndex?: number;
  name?: string;
  hidden?: boolean;
}

// объект для панели слоёв (агрегат по всем менеджерам)
export type LayerKind = 'node' | 'stroke' | 'connector';

export interface LayerObject {
  id: string;
  kind: LayerKind;
  name: string;
  zIndex: number;
  hidden: boolean;
  subtype?: string; // тип ноды / инструмент штриха — для иконки
}

export type FadeCurve = 'linear' | 'exp';

export interface LaserParams {
  color: string;
  width: number;
  duration: number;
  fadeCurve: FadeCurve;
  trailLength: number;
  glow: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// формат файла .board.json
export interface BoardData {
  version: number;
  nodes: BoardNode[];
  connectors: Connector[];
  strokes: Stroke[];
  viewport: Viewport;
  laserParams: LaserParams;
}

export interface InteractiveBoardSettings {
  defaultNodeFill: string;
  defaultNodeBorder: string;
  defaultConnectorColor: string;
  gridSize: number;
  snapToGrid: boolean;
  autosaveIntervalMs: number;
  saveTempStrokes: boolean;
  laserParams: LaserParams;
}

export const DEFAULT_SETTINGS: InteractiveBoardSettings = {
  defaultNodeFill: 'var(--background-secondary)',
  defaultNodeBorder: 'var(--background-modifier-border)',
  defaultConnectorColor: 'var(--text-muted)',
  gridSize: 20,
  snapToGrid: true,
  autosaveIntervalMs: 5000,
  saveTempStrokes: false,
  laserParams: {
    color: '#ff3333',
    width: 4,
    duration: 1500,
    fadeCurve: 'exp',
    trailLength: 80,
    glow: 12,
  },
};

export interface HistoryAction {
  type: string;
  undo: () => void;
  redo: () => void;
}

export type ToolType =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'group'
  | 'image'
  | 'connector'
  | 'pencil'
  | 'marker'
  | 'eraser'
  | 'laser';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ExportFormat = 'png' | 'svg' | 'json';

export function generateId(): string {
  return 'ib-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
