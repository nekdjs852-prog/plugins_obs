"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ReadingTimePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  wordsPerMinute: 200,
  prefix: "\u0412\u0440\u0435\u043C\u044F \u0447\u0442\u0435\u043D\u0438\u044F:",
  showWordCount: false
};
var MIN_WPM = 50;
var MAX_WPM = 600;
var ReadingTimePlugin = class extends import_obsidian.Plugin {
  // элемент в статус-баре (запасной вывод)
  async onload() {
    await this.loadSettings();
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass("reading-time-statusbar");
    this.addSettingTab(new ReadingTimeSettingTab(this.app, this));
    const debouncedUpdate = (0, import_obsidian.debounce)(
      () => this.updateReadingTime(),
      300,
      true
    );
    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        () => this.updateReadingTime()
      )
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", () => debouncedUpdate())
    );
    this.registerEvent(
      this.app.workspace.on(
        "layout-change",
        () => this.updateReadingTime()
      )
    );
    this.app.workspace.onLayoutReady(() => this.updateReadingTime());
  }
  onunload() {
    this.removeReadingBlocks();
  }
  // Подсчёт слов: разбиваем по пробелам/переносам, отбрасываем пустые элементы
  countWords(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
  }
  // Форматирование итоговой строки для вывода
  formatLabel(words) {
    const wpm = this.clampWpm(this.settings.wordsPerMinute);
    const minutes = Math.ceil(words / wpm);
    const timeText = words === 0 || minutes < 1 ? "< 1 \u043C\u0438\u043D" : `${minutes} \u043C\u0438\u043D`;
    let label = `${this.settings.prefix} ${timeText}`.trim();
    if (this.settings.showWordCount) {
      label += ` (${words} ${this.pluralWords(words)})`;
    }
    return label;
  }
  // Согласование слова "слово" с числом
  pluralWords(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11)
      return "\u0441\u043B\u043E\u0432\u043E";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
      return "\u0441\u043B\u043E\u0432\u0430";
    return "\u0441\u043B\u043E\u0432";
  }
  // Ограничиваем скорость допустимым диапазоном
  clampWpm(value) {
    if (Number.isNaN(value))
      return DEFAULT_SETTINGS.wordsPerMinute;
    return Math.min(MAX_WPM, Math.max(MIN_WPM, value));
  }
  // Основной метод: считает время и обновляет отображение
  updateReadingTime() {
    var _a, _b, _c;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view) {
      this.statusBarItem.setText("");
      this.removeReadingBlocks();
      return;
    }
    const words = this.countWords((_c = (_b = (_a = view.editor) == null ? void 0 : _a.getValue()) != null ? _b : view.data) != null ? _c : "");
    const label = this.formatLabel(words);
    this.statusBarItem.setText(label);
    this.renderReadingBlock(label);
  }
  // Вставляем/обновляем блок над содержимым в режиме чтения
  renderReadingBlock(label) {
    var _a, _b;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view)
      return;
    const previewEl = (_a = view.previewMode) == null ? void 0 : _a.containerEl;
    this.removeReadingBlocks();
    if (!previewEl || view.getMode() !== "preview") {
      return;
    }
    const target = (_b = previewEl.querySelector(".markdown-preview-sizer")) != null ? _b : previewEl;
    const block = createDiv({ cls: "reading-time-block" });
    block.setText(label);
    target.prepend(block);
  }
  // Удаляем все ранее добавленные блоки
  removeReadingBlocks() {
    document.querySelectorAll(".reading-time-block").forEach((el) => el.remove());
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.updateReadingTime();
  }
};
var ReadingTimeSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Reading Time" });
    new import_obsidian.Setting(containerEl).setName("\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0447\u0442\u0435\u043D\u0438\u044F").setDesc(
      `\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u043B\u043E\u0432 \u0432 \u043C\u0438\u043D\u0443\u0442\u0443 (${MIN_WPM}\u2013${MAX_WPM}). \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 200.`
    ).addText(
      (text) => text.setPlaceholder("200").setValue(String(this.plugin.settings.wordsPerMinute)).onChange(async (value) => {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed))
          return;
        this.plugin.settings.wordsPerMinute = Math.min(
          MAX_WPM,
          Math.max(MIN_WPM, parsed)
        );
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u041F\u043E\u0434\u043F\u0438\u0441\u044C").setDesc('\u0422\u0435\u043A\u0441\u0442 \u043F\u0435\u0440\u0435\u0434 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E "\u0412\u0440\u0435\u043C\u044F \u0447\u0442\u0435\u043D\u0438\u044F:".').addText(
      (text) => text.setPlaceholder("\u0412\u0440\u0435\u043C\u044F \u0447\u0442\u0435\u043D\u0438\u044F:").setValue(this.plugin.settings.prefix).onChange(async (value) => {
        this.plugin.settings.prefix = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u043B\u043E\u0432").setDesc("\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0447\u0438\u0441\u043B\u043E \u0441\u043B\u043E\u0432 \u0440\u044F\u0434\u043E\u043C \u0441\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C \u0447\u0442\u0435\u043D\u0438\u044F.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showWordCount).onChange(async (value) => {
        this.plugin.settings.showWordCount = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
