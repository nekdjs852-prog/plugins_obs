import * as React from "react";
import { useMemo, useState } from "react";
import { TimelineEvent } from "../models/TimelineEvent";

interface Props {
  events: TimelineEvent[];
  onOpen: (filePath: string) => void;
  onContextMenu: (evt: MouseEvent, dateAtClick: string) => void;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

interface CalendarDay {
  date: Date;
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: TimelineEvent[];
}

function buildCalendar(year: number, month: number, events: TimelineEvent[]): CalendarDay[] {
  const today = new Date();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-based: getDay() returns 0=Sun, so Mon=0, Sun=6
  let startWeekday = firstOfMonth.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const days: CalendarDay[] = [];

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startWeekday;
    const date = new Date(year, month, dayOffset + 1);
    const iso = toIso(date);
    const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year;
    const isToday = isSameDay(date, today);
    const wd = date.getDay();
    const isWeekend = wd === 0 || wd === 6;

    // Find events for this day (single or within range)
    const dayEvents = events.filter((ev) => {
      const start = new Date(ev.startDate.getFullYear(), ev.startDate.getMonth(), ev.startDate.getDate());
      const end = ev.endDate
        ? new Date(ev.endDate.getFullYear(), ev.endDate.getMonth(), ev.endDate.getDate())
        : start;
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return d >= start && d <= end;
    });

    days.push({ date, iso, isCurrentMonth, isToday, isWeekend, events: dayEvents });
  }

  return days;
}

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function CalendarView({ events, onOpen, onContextMenu }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMemo(() => buildCalendar(year, month, events), [year, month, events]);

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const handleCellContext = (e: React.MouseEvent, iso: string) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.nativeEvent, iso);
  };

  return (
    <div className="tlv-cal">
      <div className="tlv-cal-header">
        <button className="tlv-cal-nav" onClick={prevMonth} title="Предыдущий месяц">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="tlv-cal-title-group">
          <span className="tlv-cal-title">{MONTH_NAMES[month]}</span>
          <span className="tlv-cal-year">{year}</span>
        </div>
        <button className="tlv-cal-nav" onClick={nextMonth} title="Следующий месяц">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button className="tlv-cal-today-btn" onClick={goToday}>Сегодня</button>
      </div>

      <div className="tlv-cal-grid">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={"tlv-cal-weekday" + (i >= 5 ? " tlv-cal-weekday-weekend" : "")}>
            {wd}
          </div>
        ))}

        {days.map((day) => {
          const cls = [
            "tlv-cal-cell",
            day.isCurrentMonth ? "" : "tlv-cal-cell-outside",
            day.isToday ? "tlv-cal-cell-today" : "",
            day.isWeekend ? "tlv-cal-cell-weekend" : "",
          ].filter(Boolean).join(" ");

          return (
            <div
              key={day.iso}
              className={cls}
              onContextMenu={(e) => handleCellContext(e, day.iso)}
            >
              <span className="tlv-cal-day-num">{day.date.getDate()}</span>
              <div className="tlv-cal-events">
                {day.events.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id + day.iso}
                    className="tlv-cal-event"
                    style={ev.color ? { "--ev-color": ev.color } as React.CSSProperties : undefined}
                    title={`${ev.title}\n${toIso(ev.startDate)}${ev.endDate ? ` → ${toIso(ev.endDate)}` : ""}${ev.tags.length ? `\n#${ev.tags.join(" #")}` : ""}`}
                    onClick={(e) => { e.stopPropagation(); onOpen(ev.filePath); }}
                  >
                    <span className="tlv-cal-event-dot" />
                    <span className="tlv-cal-event-text">{ev.title}</span>
                  </div>
                ))}
                {day.events.length > 3 && (
                  <div className="tlv-cal-more">+{day.events.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
