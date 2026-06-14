// ПАРСЕР: заметка → событие.
// Читает frontmatter заметки через кэш Obsidian (date/start, end, title, tags, color)
// и собирает объект TimelineEvent. Нет валидной даты → заметка не событие (null).
// parseVault() прогоняет так ВСЕ заметки и отдаёт отсортированный список событий.
import { App, TFile, parseFrontMatterTags } from "obsidian";
import { TimelineEvent } from "../models/TimelineEvent";

/** Parse a loosely-typed frontmatter value into a Date, or null if invalid. */
function toDate(value: unknown): Date | null {
  if (value == null) return null;
  // Obsidian may already give us a Date instance for date-typed fields.
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  // Accept YYYY-MM-DD and full ISO strings. Parse date-only as local midnight.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeTags(raw: unknown): string[] {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((t) => String(t).replace(/^#/, "").trim())
    .filter((t) => t.length > 0);
}

/** Build a TimelineEvent from a single file, or null if it has no valid date. */
export function parseFile(app: App, file: TFile): TimelineEvent | null {
  const cache = app.metadataCache.getFileCache(file);
  const fm = cache?.frontmatter;
  if (!fm) return null;

  const startDate = toDate(fm.date ?? fm.start);
  if (!startDate) return null;

  const endDate = toDate(fm.end) ?? undefined;

  // Merge inline tags from the body with frontmatter tags.
  const fmTags = parseFrontMatterTags(fm) ?? [];
  const tags = Array.from(
    new Set([...normalizeTags(fm.tags), ...fmTags.map((t) => t.replace(/^#/, ""))])
  );

  return {
    id: file.path,
    filePath: file.path,
    title: String(fm.title ?? file.basename),
    startDate,
    endDate: endDate && endDate >= startDate ? endDate : undefined,
    tags,
    color: fm.color ? String(fm.color) : undefined,
  };
}

/** Scan the whole vault and return every note that defines a timeline date. */
export function parseVault(app: App): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const ev = parseFile(app, file);
    if (ev) events.push(ev);
  }
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return events;
}
