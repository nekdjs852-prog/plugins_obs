import { App, Modal, Setting, TFolder, normalizePath } from "obsidian";

export interface NewNoteData {
  title: string;
  date: string;
  endDate: string;
  tags: string;
  color: string;
  folder: string;
}

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

export class CreateNoteModal extends Modal {
  private data: NewNoteData;
  private onSubmit: (data: NewNoteData) => void;

  constructor(app: App, defaultDate: string, onSubmit: (data: NewNoteData) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.data = {
      title: "",
      date: defaultDate,
      endDate: "",
      tags: "",
      color: "",
      folder: "",
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("tlv-modal");
    contentEl.createEl("h2", { text: "New Timeline Note" });

    new Setting(contentEl)
      .setName("Title")
      .setDesc("Name of the note")
      .addText((text) =>
        text
          .setPlaceholder("My Event")
          .setValue(this.data.title)
          .onChange((v) => (this.data.title = v.trim()))
      );

    new Setting(contentEl)
      .setName("Date")
      .setDesc("Start date (YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("2026-01-15")
          .setValue(this.data.date)
          .onChange((v) => (this.data.date = v.trim()))
      );

    new Setting(contentEl)
      .setName("End date")
      .setDesc("Optional end date for a range event")
      .addText((text) =>
        text
          .setPlaceholder("2026-01-20")
          .setValue(this.data.endDate)
          .onChange((v) => (this.data.endDate = v.trim()))
      );

    new Setting(contentEl)
      .setName("Tags")
      .setDesc("Comma-separated tags")
      .addText((text) =>
        text
          .setPlaceholder("study, project")
          .setValue(this.data.tags)
          .onChange((v) => (this.data.tags = v))
      );

    new Setting(contentEl)
      .setName("Color")
      .addDropdown((dd) => {
        for (const c of COLORS) dd.addOption(c.value, c.label);
        dd.setValue(this.data.color);
        dd.onChange((v) => (this.data.color = v));
      });

    // Folder picker — list all existing folders
    const folders = this.getFolders();
    new Setting(contentEl)
      .setName("Folder")
      .setDesc("Where to save the note")
      .addDropdown((dd) => {
        dd.addOption("", "/ (root)");
        for (const f of folders) dd.addOption(f, f);
        dd.setValue(this.data.folder);
        dd.onChange((v) => (this.data.folder = v));
      });

    // Submit button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Create")
        .setCta()
        .onClick(() => {
          if (!this.data.title) {
            this.data.title = "Untitled";
          }
          this.close();
          this.onSubmit(this.data);
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }

  private getFolders(): string[] {
    const result: string[] = [];
    const recurse = (folder: TFolder) => {
      if (folder.path) result.push(folder.path);
      for (const child of folder.children) {
        if (child instanceof TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    return result.sort();
  }
}

/** Build the frontmatter YAML string and file content from modal data. */
export function buildNoteContent(data: NewNoteData): string {
  const lines: string[] = ["---"];
  lines.push(`title: "${data.title}"`);
  lines.push(`date: ${data.date}`);
  if (data.endDate) lines.push(`end: ${data.endDate}`);
  if (data.tags) {
    const tags = data.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) lines.push(`tags: [${tags.join(", ")}]`);
  }
  if (data.color) lines.push(`color: "${data.color}"`);
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

/** Create the actual file in the vault. */
export async function createNoteFile(
  app: App,
  data: NewNoteData
): Promise<void> {
  const content = buildNoteContent(data);
  const safeName = data.title.replace(/[\\/:*?"<>|]/g, "_");
  const folder = data.folder ? data.folder + "/" : "";
  const path = normalizePath(`${folder}${safeName}.md`);

  // Ensure folder exists
  if (data.folder) {
    const existing = app.vault.getAbstractFileByPath(data.folder);
    if (!existing) {
      await app.vault.createFolder(data.folder);
    }
  }

  await app.vault.create(path, content);
}
