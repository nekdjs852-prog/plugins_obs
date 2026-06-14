// вид таймлайна = контейнер obsidian + корень react.
// render собирает события из заметок (parseVault) и кидает в <Timeline>.
// подписан на изменения заметок -> перерисовка с задержкой (debounce).
// плюс открытие заметки по клику и правое меню (создать/добавить)
import { ItemView, Menu, TFile } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { Timeline } from "../components/Timeline";
import { parseVault } from "../parser/eventParser";
import { CreateNoteModal, createNoteFile } from "../modals/CreateNoteModal";
import { AddExistingNoteModal } from "../modals/AddExistingNoteModal";

export const TIMELINE_VIEW_TYPE = "timeline-view";

export class TimelineView extends ItemView {
  private root: Root | null = null;
  private renderScheduled = false;

  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "Timeline";
  }
  getIcon() {
    return "calendar-clock";
  }

  async onOpen() {
    this.root = createRoot(this.contentEl);
    this.render();

    // Live refresh: debounce vault/metadata events so bulk edits render once.
    const schedule = () => this.scheduleRender();
    this.registerEvent(this.app.metadataCache.on("changed", schedule));
    this.registerEvent(this.app.metadataCache.on("resolved", schedule));
    this.registerEvent(this.app.vault.on("create", schedule));
    this.registerEvent(this.app.vault.on("delete", schedule));
    this.registerEvent(this.app.vault.on("rename", schedule));
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }

  // debounce: при пачке изменений не перерисовываю сто раз, жду 200мс и рисую один раз.
  // флаг не даёт запланировать несколько перерисовок сразу
  private scheduleRender() {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    window.setTimeout(() => {
      this.renderScheduled = false;
      this.render();
    }, 200);
  }

  private openFile = (filePath: string) => {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      this.app.workspace.getLeaf(false).openFile(file);
    }
  };

  /**
   * Show a native Obsidian context menu with timeline-specific actions.
   * `dateAtClick` is the date derived from the x-position on the canvas.
   */
  private handleContextMenu = (evt: MouseEvent, dateAtClick: string) => {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setIcon("plus")
        .setTitle("Create new note")
        .onClick(() => {
          new CreateNoteModal(this.app, dateAtClick, async (data) => {
            await createNoteFile(this.app, data);
          }).open();
        })
    );

    menu.addItem((item) =>
      item
        .setIcon("file-search")
        .setTitle("Add existing note")
        .onClick(() => {
          new AddExistingNoteModal(this.app, dateAtClick).open();
        })
    );

    menu.showAtMouseEvent(evt);
  };

  render() {
    if (!this.root) return;
    const events = parseVault(this.app);
    this.root.render(
      React.createElement(Timeline, {
        events,
        onOpen: this.openFile,
        onContextMenu: this.handleContextMenu,
      })
    );
  }
}
