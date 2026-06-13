import {
	App,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	debounce,
} from "obsidian";

// Настройки плагина и их значения по умолчанию
interface ReadingTimeSettings {
	wordsPerMinute: number; // скорость чтения, слов в минуту
	prefix: string; // подпись перед значением
	showWordCount: boolean; // показывать ли количество слов
}

const DEFAULT_SETTINGS: ReadingTimeSettings = {
	wordsPerMinute: 200,
	prefix: "Время чтения:",
	showWordCount: false,
};

// Допустимый диапазон скорости чтения
const MIN_WPM = 50;
const MAX_WPM = 600;

export default class ReadingTimePlugin extends Plugin {
	settings!: ReadingTimeSettings;
	private statusBarItem!: HTMLElement; // элемент в статус-баре (запасной вывод)

	async onload(): Promise<void> {
		await this.loadSettings();

		// Создаём элемент статус-бара (нижняя панель окна)
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass("reading-time-statusbar");

		// Вкладка настроек плагина
		this.addSettingTab(new ReadingTimeSettingTab(this.app, this));

		// Пересчёт при редактировании текста — с задержкой, чтобы не считать на каждый символ
		const debouncedUpdate = debounce(
			() => this.updateReadingTime(),
			300,
			true
		);

		// Обновление при переключении между заметками
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () =>
				this.updateReadingTime()
			)
		);

		// Обновление при изменении содержимого редактора
		this.registerEvent(
			this.app.workspace.on("editor-change", () => debouncedUpdate())
		);

		// Обновление при смене режима (чтение/редактирование) и прочих изменениях
		this.registerEvent(
			this.app.workspace.on("layout-change", () =>
				this.updateReadingTime()
			)
		);

		// Первичный расчёт после загрузки рабочей области
		this.app.workspace.onLayoutReady(() => this.updateReadingTime());
	}

	onunload(): void {
		// Убираем добавленный в режим чтения блок при выгрузке плагина
		this.removeReadingBlocks();
	}

	// Подсчёт слов: разбиваем по пробелам/переносам, отбрасываем пустые элементы
	private countWords(text: string): number {
		const trimmed = text.trim();
		if (trimmed.length === 0) {
			return 0;
		}
		return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
	}

	// Форматирование итоговой строки для вывода
	private formatLabel(words: number): string {
		const wpm = this.clampWpm(this.settings.wordsPerMinute);
		const minutes = Math.ceil(words / wpm); // округляем вверх до целых минут

		// Меньше минуты показываем особым образом
		const timeText =
			words === 0 || minutes < 1 ? "< 1 мин" : `${minutes} мин`;

		let label = `${this.settings.prefix} ${timeText}`.trim();
		if (this.settings.showWordCount) {
			label += ` (${words} ${this.pluralWords(words)})`;
		}
		return label;
	}

	// Согласование слова "слово" с числом
	private pluralWords(n: number): string {
		const mod10 = n % 10;
		const mod100 = n % 100;
		if (mod10 === 1 && mod100 !== 11) return "слово";
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
			return "слова";
		return "слов";
	}

	// Ограничиваем скорость допустимым диапазоном
	private clampWpm(value: number): number {
		if (Number.isNaN(value)) return DEFAULT_SETTINGS.wordsPerMinute;
		return Math.min(MAX_WPM, Math.max(MIN_WPM, value));
	}

	// Основной метод: считает время и обновляет отображение
	updateReadingTime(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		// Нет активной заметки — очищаем вывод
		if (!view) {
			this.statusBarItem.setText("");
			this.removeReadingBlocks();
			return;
		}

		const words = this.countWords(view.editor?.getValue() ?? view.data ?? "");
		const label = this.formatLabel(words);

		// Запасной вывод в статус-баре (виден всегда)
		this.statusBarItem.setText(label);

		// Основной вывод — блок вверху заметки в режиме чтения/предпросмотра
		this.renderReadingBlock(label);
	}

	// Вставляем/обновляем блок над содержимым в режиме чтения
	private renderReadingBlock(label: string): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		// Контейнер режима чтения (preview)
		const previewEl = view.previewMode?.containerEl;
		this.removeReadingBlocks();

		// Показываем блок только в режиме чтения
		if (!previewEl || view.getMode() !== "preview") {
			return;
		}

		// Целевой контейнер, перед содержимым которого добавим блок
		const target =
			previewEl.querySelector(".markdown-preview-sizer") ?? previewEl;

		const block = createDiv({ cls: "reading-time-block" });
		block.setText(label);
		target.prepend(block);
	}

	// Удаляем все ранее добавленные блоки
	private removeReadingBlocks(): void {
		document
			.querySelectorAll(".reading-time-block")
			.forEach((el) => el.remove());
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.updateReadingTime(); // сразу применяем новые настройки
	}
}

// Вкладка настроек плагина
class ReadingTimeSettingTab extends PluginSettingTab {
	plugin: ReadingTimePlugin;

	constructor(app: App, plugin: ReadingTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Настройки Reading Time" });

		// Скорость чтения (слов в минуту)
		new Setting(containerEl)
			.setName("Скорость чтения")
			.setDesc(
				`Количество слов в минуту (${MIN_WPM}–${MAX_WPM}). По умолчанию 200.`
			)
			.addText((text) =>
				text
					.setPlaceholder("200")
					.setValue(String(this.plugin.settings.wordsPerMinute))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (Number.isNaN(parsed)) return;
						// Ограничиваем диапазоном
						this.plugin.settings.wordsPerMinute = Math.min(
							MAX_WPM,
							Math.max(MIN_WPM, parsed)
						);
						await this.plugin.saveSettings();
					})
			);

		// Подпись/префикс
		new Setting(containerEl)
			.setName("Подпись")
			.setDesc('Текст перед значением. По умолчанию "Время чтения:".')
			.addText((text) =>
				text
					.setPlaceholder("Время чтения:")
					.setValue(this.plugin.settings.prefix)
					.onChange(async (value) => {
						this.plugin.settings.prefix = value;
						await this.plugin.saveSettings();
					})
			);

		// Показывать количество слов
		new Setting(containerEl)
			.setName("Показывать количество слов")
			.setDesc("Добавлять число слов рядом со временем чтения.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showWordCount)
					.onChange(async (value) => {
						this.plugin.settings.showWordCount = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
