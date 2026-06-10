import { TimelineEvent, ZoomLevel } from "../models/TimelineEvent";

export const DAY_MS = 86_400_000;

/** Horizontal pixels allocated per day at each zoom level. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
  week: 36,
  month: 6,
  year: 0.9,
};

export const LANE_HEIGHT = 44;
export const EVENT_HEIGHT = 30;
export const PADDING_DAYS = 3;

export interface Tick {
  date: Date;
  label: string;
  major: boolean;
}

export interface PositionedEvent {
  event: TimelineEvent;
  left: number;
  width: number;
  lane: number;
  isRange: boolean;
}

export interface TimelineModel {
  start: Date;
  pxPerDay: number;
  totalWidth: number;
  laneCount: number;
  positioned: PositionedEvent[];
  ticks: Tick[];
  todayX: number | null;
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (a: Date, b: Date) =>
  (startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS;

/** Minimum on-screen width of an event so single-day items stay clickable. */
const MIN_EVENT_WIDTH = 90;

/** Greedily assign events to non-overlapping horizontal lanes. */
function assignLanes(items: PositionedEvent[]): number {
  const laneEnds: number[] = [];
  for (const it of items) {
    let lane = laneEnds.findIndex((end) => end <= it.left);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = it.left + it.width;
    it.lane = lane;
  }
  return Math.max(1, laneEnds.length);
}

function buildTicks(start: Date, end: Date, zoom: ZoomLevel): Tick[] {
  const ticks: Tick[] = [];
  const cur = startOfDay(start);
  if (zoom === "year") {
    cur.setMonth(0, 1);
    while (cur <= end) {
      ticks.push({ date: new Date(cur), label: String(cur.getFullYear()), major: true });
      cur.setFullYear(cur.getFullYear() + 1);
    }
  } else if (zoom === "month") {
    cur.setDate(1);
    while (cur <= end) {
      const major = cur.getMonth() === 0;
      ticks.push({
        date: new Date(cur),
        label: cur.toLocaleString(undefined, { month: "short", year: major ? "numeric" : undefined }),
        major,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    // week: a tick every day, major on Mondays.
    while (cur <= end) {
      const major = cur.getDay() === 1;
      ticks.push({
        date: new Date(cur),
        label: cur.toLocaleString(undefined, { day: "numeric", month: major ? "short" : undefined }),
        major,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }
  return ticks;
}

/** Compute all geometry needed to render the timeline for the given events. */
export function buildTimeline(events: TimelineEvent[], zoom: ZoomLevel): TimelineModel {
  const pxPerDay = PX_PER_DAY[zoom];

  if (events.length === 0) {
    return { start: new Date(), pxPerDay, totalWidth: 0, laneCount: 1, positioned: [], ticks: [], todayX: null };
  }

  let min = events[0].startDate;
  let max = events[0].startDate;
  for (const e of events) {
    if (e.startDate < min) min = e.startDate;
    const tail = e.endDate ?? e.startDate;
    if (tail > max) max = tail;
  }

  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate() - PADDING_DAYS);
  const end = new Date(max.getFullYear(), max.getMonth(), max.getDate() + PADDING_DAYS);

  const positioned: PositionedEvent[] = events.map((event) => {
    const left = daysBetween(start, event.startDate) * pxPerDay;
    const isRange = !!event.endDate;
    const rawWidth = isRange
      ? Math.max(daysBetween(event.startDate, event.endDate!), 1) * pxPerDay
      : MIN_EVENT_WIDTH;
    return { event, left, width: Math.max(rawWidth, MIN_EVENT_WIDTH), lane: 0, isRange };
  });

  const laneCount = assignLanes(positioned);
  const totalWidth = (daysBetween(start, end) + 1) * pxPerDay;
  const ticks = buildTicks(start, end, zoom);

  const today = startOfDay(new Date());
  const todayX =
    today >= start && today <= end ? daysBetween(start, today) * pxPerDay : null;

  return { start, pxPerDay, totalWidth, laneCount, positioned, ticks, todayX };
}
