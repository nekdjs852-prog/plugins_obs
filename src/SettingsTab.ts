import { App, PluginSettingTab, Setting } from 'obsidian';
import type InteractiveBoardPlugin from './main';

export class InteractiveBoardSettingTab extends PluginSettingTab {
  plugin: InteractiveBoardPlugin;

  constructor(app: App, plugin: InteractiveBoardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Interactive Board — Settings' });

    new Setting(containerEl)
      .setName('Grid size')
      .setDesc('Size of the grid in pixels.')
      .addSlider(s => s
        .setLimits(10, 80, 5)
        .setValue(this.plugin.settings.gridSize)
        .setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.gridSize = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Snap to grid')
      .setDesc('Snap nodes to the grid when moving.')
      .addToggle(t => t
        .setValue(this.plugin.settings.snapToGrid)
        .onChange(async v => { this.plugin.settings.snapToGrid = v; await this.plugin.saveSettings(); }));

    containerEl.createEl('h3', { text: 'Default colours' });

    new Setting(containerEl)
      .setName('Node fill')
      .addText(t => t
        .setValue(this.plugin.settings.defaultNodeFill)
        .onChange(async v => { this.plugin.settings.defaultNodeFill = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Node border')
      .addText(t => t
        .setValue(this.plugin.settings.defaultNodeBorder)
        .onChange(async v => { this.plugin.settings.defaultNodeBorder = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Connector colour')
      .addText(t => t
        .setValue(this.plugin.settings.defaultConnectorColor)
        .onChange(async v => { this.plugin.settings.defaultConnectorColor = v; await this.plugin.saveSettings(); }));

    containerEl.createEl('h3', { text: 'Autosave' });

    new Setting(containerEl)
      .setName('Autosave interval (ms)')
      .addText(t => t
        .setValue(String(this.plugin.settings.autosaveIntervalMs))
        .onChange(async v => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 1000) { this.plugin.settings.autosaveIntervalMs = n; await this.plugin.saveSettings(); }
        }));

    new Setting(containerEl)
      .setName('Save temporary strokes')
      .setDesc('If enabled, temporary annotation strokes are persisted in the board file.')
      .addToggle(t => t
        .setValue(this.plugin.settings.saveTempStrokes)
        .onChange(async v => { this.plugin.settings.saveTempStrokes = v; await this.plugin.saveSettings(); }));

    containerEl.createEl('h3', { text: 'Laser pointer' });

    new Setting(containerEl)
      .setName('Laser colour')
      .addText(t => t
        .setValue(this.plugin.settings.laserParams.color)
        .onChange(async v => { this.plugin.settings.laserParams.color = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Laser width')
      .addSlider(s => s
        .setLimits(1, 12, 1)
        .setValue(this.plugin.settings.laserParams.width)
        .setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.laserParams.width = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Fade duration (ms)')
      .addText(t => t
        .setValue(String(this.plugin.settings.laserParams.duration))
        .onChange(async v => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 100) { this.plugin.settings.laserParams.duration = n; await this.plugin.saveSettings(); }
        }));

    new Setting(containerEl)
      .setName('Fade curve')
      .addDropdown(d => d
        .addOptions({ linear: 'Linear', exp: 'Exponential' })
        .setValue(this.plugin.settings.laserParams.fadeCurve)
        .onChange(async v => {
          this.plugin.settings.laserParams.fadeCurve = v as 'linear' | 'exp';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Glow radius')
      .addSlider(s => s
        .setLimits(0, 30, 1)
        .setValue(this.plugin.settings.laserParams.glow)
        .setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.laserParams.glow = v; await this.plugin.saveSettings(); }));
  }
}
