import * as React from "react";
import { ZoomLevel, ViewMode } from "../models/TimelineEvent";

interface Props {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  zoom: ZoomLevel;
  onZoom: (z: ZoomLevel) => void;
  allTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  folders: string[];
  folder: string;
  onFolder: (f: string) => void;
  count: number;
  onToday: () => void;
}

const ZOOMS: ZoomLevel[] = ["week", "month", "year"];
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  week: "Неделя",
  month: "Месяц",
  year: "Год",
};

const VIEW_MODES: { key: ViewMode; label: string; icon: string }[] = [
  { key: "calendar", label: "Календарь", icon: "📅" },
  { key: "timeline", label: "Таймлайн", icon: "📊" },
];

export function Toolbar(props: Props) {
  const {
    viewMode, onViewMode,
    zoom, onZoom, allTags, activeTags, onToggleTag,
    folders, folder, onFolder, count, onToday,
  } = props;

  return (
    <div className="tlv-toolbar">
      {/* View mode switch */}
      <div className="tlv-toolbar-group tlv-view-switch">
        {VIEW_MODES.map((m) => (
          <button
            key={m.key}
            className={"tlv-mode-btn" + (m.key === viewMode ? " is-active" : "")}
            onClick={() => onViewMode(m.key)}
            title={m.label}
          >
            <span className="tlv-mode-icon">{m.icon}</span>
            <span className="tlv-mode-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Zoom only for timeline mode */}
      {viewMode === "timeline" && (
        <div className="tlv-toolbar-group tlv-zoom-group">
          {ZOOMS.map((z) => (
            <button
              key={z}
              className={"tlv-zoom-btn" + (z === zoom ? " is-active" : "")}
              onClick={() => onZoom(z)}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
          <button className="tlv-zoom-btn tlv-today-btn-toolbar" onClick={onToday}>
            Сегодня
          </button>
        </div>
      )}

      {/* Folder filter */}
      <select
        className="tlv-folder-select dropdown"
        value={folder}
        onChange={(e) => onFolder(e.target.value)}
      >
        <option value="">Все папки</option>
        {folders.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="tlv-toolbar-group tlv-tags">
          {allTags.map((t) => (
            <button
              key={t}
              className={"tlv-tag-chip" + (activeTags.includes(t) ? " is-active" : "")}
              onClick={() => onToggleTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <span className="tlv-count">
        {count} {count === 1 ? "событие" : count >= 2 && count <= 4 ? "события" : "событий"}
      </span>
    </div>
  );
}
