import { App, Modal, Setting, SuggestModal, TFile } from "obsidian";
import { buildNoteContent, NewNoteData } from "./CreateNoteModal";

const COLORS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Red", value: "#e25563" },
  { label: "Orange", value: "#d4872a" },
  { label: "Yellow", value: "#c4a932" },
  { label: "Green", value: "#4daa57" },
  { label: "Cyan", value: "#2db8a3" },
  { label: "Blue", value: "#5b8def" },
  { label: "Purple", value: "#9b59b6" },
  { label: "Pink", value: "#e06b9f" },
];

/**
 * Step 1: Fuzzy-search for an existing note that has no timeline date yet.
 */
export class AddExistingNoteModal extends SuggestModal<TFile> {
  private files: TFile[];
  private defaultDate: string;

  constructor(app: App, defaultDate: string) {
    super(app);
    this.defaultDate = defaultDate;
    this.setPlaceholder("Search for a note…");

    // Collect files that don't have a `date` in frontmatter
    this.files = app.vault.getMarkdownFiles().filter((f) => {
      const cache = app.metadataCache.getFileCache(f);
      const fm = cache?.frontmatter;
      return !fm?.date && !fm?.start;
    });
  }

  getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase();
    return this.files.filter((f) => f.path.toLowerCase().includes(lower));
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl("div", { text: file.basename, cls: "tlv-suggest-title" });
    el.createEl("small", { text: file.path, cls: "tlv-suggest-path" });
  }

  onChooseSuggestion(file: TFile) {
    new SetDateModal(this.app, file, this.defaultDate).open();
  }
}

/**
 * Step 2: After choosing a file, let the user set the date and other params.
 */
class SetDateModal extends Modal {
  private file: TFile;
  private date: string;
  private endDate = "";
  private tags = "";
  private color = "";

  constructor(app: App, file: TFile, defaultDate: string) {
    super(app);
    this.file = file;
    this.date = defaultDate;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("tlv-modal");
    contentEl.createEl("h2", { text: `Add to timeline: ${this.file.basename}` });

    new Setting(contentEl)
      .setName("Date")
      .setDesc("Start date (YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("2026-01-15")
          .setValue(this.date)
          .onChange((v) => (this.date = v.trim()))
      );

    new Setting(contentEl)
      .setName("End date")
      .setDesc("Optional end date for a range event")
      .addText((text) =>
        text
          .setPlaceholder("2026-01-20")
          .onChange((v) => (this.endDate = v.trim()))
      );

    new Setting(contentEl)
      .setName("Tags")
      .setDesc("Comma-separated tags")
      .addText((text) =>
        text.setPlaceholder("study, project").onChange((v) => (this.tags = v))
      );

    new Setting(contentEl)
      .setName("Color")
      .addDropdown((dd) => {
        for (const c of COLORS) dd.addOption(c.value, c.label);
        dd.onChange((v) => (this.color = v));
      });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Add to Timeline")
        .setCta()
        .onClick(() => {
          this.close();
          this.applyFrontmatter();
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }

  private async applyFrontmatter() {
    const content = await this.app.vault.read(this.file);

    // Build frontmatter lines
    const fmLines: string[] = [];
    fmLines.push(`date: ${this.date}`);
    if (this.endDate) fmLines.push(`end: ${this.endDate}`);
    if (this.tags) {
      const tags = this.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) fmLines.push(`tags: [${tags.join(", ")}]`);
    }
    if (this.color) fmLines.push(`color: "${this.color}"`);

    let newContent: string;
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      // Existing frontmatter — append our fields
      const existingFm = fmMatch[1].trimEnd();
      const merged = existingFm + "\n" + fmLines.join("\n");
      newContent = content.replace(fmMatch[0], `---\n${merged}\n---`);
    } else {
      // No frontmatter — create one
      newContent = `---\n${fmLines.join("\n")}\n---\n\n${content}`;
    }

    await this.app.vault.modify(this.file, newContent);
  }
}
