// ТОЧКА ВХОДА ПЛАГИНА.
// Здесь Obsidian «узнаёт» о плагине: регистрируем тип вида (TimelineView),
// добавляем команду и иконку на панель. activateView() открывает вкладку с таймлайном.
import { Plugin, WorkspaceLeaf } from "obsidian";
import { TimelineView, TIMELINE_VIEW_TYPE } from "./views/TimelineView";

export default class TimelinePlugin extends Plugin {
  async onload() {
    this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf));

    this.addCommand({
      id: "open-timeline-view",
      name: "Open Timeline View",
      callback: () => this.activateView(),
    });

    this.addRibbonIcon("calendar-clock", "Open Timeline View", () => this.activateView());
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
  }

  private async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}
