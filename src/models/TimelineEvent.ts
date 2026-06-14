// тут только типы, без логики.
// TimelineEvent — форма события, ZoomLevel/ViewMode — допустимые значения (юнионы),
// TimelineFilters — форма фильтров
export interface TimelineEvent {
  id: string;
  filePath: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  tags: string[];
  color?: string;
}

export type ZoomLevel = "week" | "month" | "year";
export type ViewMode = "timeline" | "calendar";

export interface TimelineFilters {
  tags: string[];
  folder: string;
}
