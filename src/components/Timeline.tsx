import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimelineEvent, ViewMode, ZoomLevel } from "../models/TimelineEvent";
import { buildTimeline, DAY_MS, LANE_HEIGHT } from "./timelineLayout";
import { TimelineEventCard } from "./TimelineEventCard";
import { CalendarView } from "./CalendarView";
import { Toolbar } from "./Toolbar";

interface Props {
  events: TimelineEvent[];
  onOpen: (filePath: string) => void;
  onContextMenu: (evt: MouseEvent, dateAtClick: string) => void;
}

const folderOf = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Convert a Date to YYYY-MM-DD */
const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function Timeline({ events, onOpen, onContextMenu }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [folder, setFolder] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(events.flatMap((e) => e.tags))).sort(),
    [events]
  );
  const folders = useMemo(
    () => Array.from(new Set(events.map((e) => folderOf(e.filePath)).filter(Boolean))).sort(),
    [events]
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (folder && !(e.filePath === folder || e.filePath.startsWith(folder + "/"))) return false;
        if (activeTags.length && !activeTags.every((t) => e.tags.includes(t))) return false;
        return true;
      }),
    [events, folder, activeTags]
  );

  const model = useMemo(() => buildTimeline(filtered, zoom), [filtered, zoom]);

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (el && model.todayX != null) {
      el.scrollTo({ left: model.todayX - el.clientWidth / 2, behavior: "smooth" });
    }
  };

  // Center on today (or the first event) whenever the visible scale changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (model.todayX != null) el.scrollLeft = model.todayX - el.clientWidth / 2;
    else el.scrollLeft = 0;
  }, [zoom, filtered.length]);

  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  /**
   * Right-click handler: calculate the date at the click x-position
   * on the timeline canvas, then delegate to the view's context menu.
   */
  const handleBodyContext = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Find the canvas element to calculate scroll-aware x offset
      const canvas = e.currentTarget.closest(".tlv-canvas") as HTMLElement | null;
      const scroll = scrollRef.current;
      if (!canvas || !scroll) return;

      const canvasRect = canvas.getBoundingClientRect();
      const xOnCanvas = e.clientX - canvasRect.left;
      const dayOffset = xOnCanvas / model.pxPerDay;
      const clickDate = new Date(model.start.getTime() + dayOffset * DAY_MS);
      const dateStr = toIso(clickDate);

      onContextMenu(e.nativeEvent, dateStr);
    },
    [model, onContextMenu]
  );

  const bodyHeight = model.laneCount * LANE_HEIGHT + 16;

  return (
    <div className="tlv-root">
      <Toolbar
        viewMode={viewMode}
        onViewMode={setViewMode}
        zoom={zoom}
        onZoom={setZoom}
        allTags={allTags}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        folders={folders}
        folder={folder}
        onFolder={setFolder}
        count={filtered.length}
        onToday={scrollToToday}
      />

      {viewMode === "calendar" ? (
        <CalendarView
          events={filtered}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ) : filtered.length === 0 ? (
        <div
          className="tlv-empty"
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(e.nativeEvent, toIso(new Date()));
          }}
        >
          <div className="tlv-empty-icon">📅</div>
          <div className="tlv-empty-text">
            Заметок с датами не найдено.<br />
            Добавьте поле <code>date:</code> в frontmatter заметки,<br />
            или <strong>нажмите правой кнопкой</strong> для создания.
          </div>
        </div>
      ) : (
        <div className="tlv-scroll" ref={scrollRef}>
          <div className="tlv-canvas" style={{ width: model.totalWidth }}>
            <div className="tlv-axis">
              {model.ticks.map((t, i) => {
                const x = ((t.date.getTime() - model.start.getTime()) / DAY_MS) * model.pxPerDay;
                return (
                  <div
                    key={i}
                    className={"tlv-tick" + (t.major ? " tlv-tick-major" : "")}
                    style={{ left: x }}
                  >
                    <span className="tlv-tick-label">{t.label}</span>
                  </div>
                );
              })}
            </div>

            <div
              className="tlv-body"
              style={{ height: bodyHeight }}
              onContextMenu={handleBodyContext}
            >
              {model.ticks
                .filter((t) => t.major)
                .map((t, i) => {
                  const x = ((t.date.getTime() - model.start.getTime()) / DAY_MS) * model.pxPerDay;
                  return <div key={i} className="tlv-gridline" style={{ left: x }} />;
                })}

              {model.todayX != null && (
                <div className="tlv-today" style={{ left: model.todayX }}>
                  <span className="tlv-today-label">сегодня</span>
                </div>
              )}

              {model.positioned.map((item) => (
                <TimelineEventCard key={item.event.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
