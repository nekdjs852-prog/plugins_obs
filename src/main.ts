import { Plugin, WorkspaceLeaf, TFile } from 'obsidian';
import { InteractiveBoardSettings, DEFAULT_SETTINGS } from './types';
import { CanvasView, VIEW_TYPE_BOARD } from './CanvasView';
import { InteractiveBoardSettingTab } from './SettingsTab';
import { BOARD_EXTENSION } from './Storage';

export default class InteractiveBoardPlugin extends Plugin {
  settings: InteractiveBoardSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_BOARD, (leaf) => {
      const view = new CanvasView(leaf);
      view.settings = this.settings;
      return view;
    });

    this.registerExtensions(['board'], VIEW_TYPE_BOARD);

    this.addSettingTab(new InteractiveBoardSettingTab(this.app, this));

    this.addRibbonIcon('layout-dashboard', 'New Interactive Board', async () => {
      await this.createNewBoard();
    });

    this.addCommand({
      id: 'create-new-board',
      name: 'Create new board',
      callback: async () => {
        await this.createNewBoard();
      },
    });

    this.addCommand({
      id: 'open-board-fullscreen',
      name: 'Toggle fullscreen',
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(CanvasView);
        if (view) {
          if (!checking) {
          }
          return true;
        }
        return false;
      },
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BOARD);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async createNewBoard(): Promise<void> {
    const name = `Board ${new Date().toISOString().slice(0, 10)}`;
    let path = `${name}.board`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${name} ${counter++}.board`;
    }

    const emptyData = JSON.stringify(
      {
        version: 1,
        nodes: [],
        connectors: [],
        strokes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        laserParams: this.settings.laserParams,
      },
      null,
      2,
    );

    const file = await this.app.vault.create(path, emptyData);

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
}
