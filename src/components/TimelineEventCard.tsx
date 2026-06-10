import * as React from "react";
import { PositionedEvent, EVENT_HEIGHT, LANE_HEIGHT } from "./timelineLayout";

interface Props {
  item: PositionedEvent;
  onOpen: (filePath: string) => void;
}

const fmt = (d: Date) =>
  d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** A single event rendered as a card (point) or a horizontal range block. */
export function TimelineEventCard({ item, onOpen }: Props) {
  const { event, left, width, lane, isRange } = item;

  const tooltip =
    `${event.title}\n${fmt(event.startDate)}` +
    (event.endDate ? ` → ${fmt(event.endDate)}` : "") +
    (event.tags.length ? `\n#${event.tags.join(" #")}` : "");

  const style: React.CSSProperties = {
    left,
    width,
    top: lane * LANE_HEIGHT + 8,
    height: EVENT_HEIGHT,
  };
  if (event.color) {
    style.background = event.color;
    style.borderColor = event.color;
  }

  return (
    <div
      className={"tlv-event" + (isRange ? " tlv-event-range" : " tlv-event-point")}
      style={style}
      title={tooltip}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event.filePath)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(event.filePath)}
    >
      {!isRange && <span className="tlv-event-dot" />}
      <span className="tlv-event-title">{event.title}</span>
    </div>
  );
}
