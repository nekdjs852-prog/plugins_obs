import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	requestUrl,
} from "obsidian";

// ---------------------------------------------------------------------------
// Типы и настройки
// ---------------------------------------------------------------------------

/** Категория погоды, к которой привязана анимация баннера. */
type WeatherMood = "sun" | "clouds" | "rain" | "snow" | "thunder" | "fog";

interface WeatherMoodSettings {
	/** Название города для определения погоды. */
	city: string;
	/** Как часто обновлять погоду, в минутах. */
	refreshMinutes: number;
	/** Включены ли CSS-анимации (выключение оставляет статичный баннер). */
	animationsEnabled: boolean;
}

const DEFAULT_SETTINGS: WeatherMoodSettings = {
	city: "Москва",
	refreshMinutes: 30,
	animationsEnabled: true,
};

/** Результат запроса погоды, кэшируемый между перерисовками баннеров. */
interface WeatherState {
	mood: WeatherMood;
	temperature: number;
	description: string;
	locationLabel: string;
	isDay: boolean;
	fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Класс координат
// ---------------------------------------------------------------------------

interface Coordinates {
	latitude: number;
	longitude: number;
	label: string;
}

// ---------------------------------------------------------------------------
// Основной класс плагина
// ---------------------------------------------------------------------------

export default class WeatherMoodPlugin extends Plugin {
	settings!: WeatherMoodSettings;
	private weather: WeatherState | null = null;
	private refreshTimer: number | null = null;
	private isFetching = false;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new WeatherMoodSettingTab(this.app, this));

		// Команда ручного обновления погоды.
		this.addCommand({
			id: "refresh-weather",
			name: "Обновить погоду",
			callback: () => this.refreshWeather(true),
		});

		// Перерисовываем баннер при смене активной заметки и раскладки.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () =>
				this.renderAllBanners()
			)
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () =>
				this.renderAllBanners()
			)
		);

		// Первый запрос и запуск таймера обновления выполняем после загрузки UI.
		this.app.workspace.onLayoutReady(() => {
			this.refreshWeather(false);
			this.scheduleRefresh();
		});
	}

	onunload() {
		this.clearRefreshTimer();
		this.removeAllBanners();
	}

	// -- Настройки --------------------------------------------------------

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// -- Планировщик обновлений ------------------------------------------

	scheduleRefresh() {
		this.clearRefreshTimer();
		const minutes = Math.max(1, this.settings.refreshMinutes);
		this.refreshTimer = window.setInterval(
			() => this.refreshWeather(false),
			minutes * 60 * 1000
		);
		this.registerInterval(this.refreshTimer);
	}

	private clearRefreshTimer() {
		if (this.refreshTimer !== null) {
			window.clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	// -- Получение погоды -------------------------------------------------

	/**
	 * Запрашивает координаты, затем текущую погоду через Open-Meteo и
	 * перерисовывает баннеры. При notify === true показывает уведомления.
	 */
	async refreshWeather(notify: boolean) {
		if (this.isFetching) return;
		this.isFetching = true;
		try {
			const coords = await this.geocodeCity(this.settings.city);
			const state = await this.fetchWeather(coords);
			this.weather = state;
			this.renderAllBanners();
			if (notify) {
				new Notice(
					`Weather Mood: ${state.locationLabel}, ${state.description}, ${Math.round(state.temperature)}°C`
				);
			}
		} catch (error) {
			console.error("Weather Mood:", error);
			if (notify) {
				new Notice(
					"Weather Mood: не удалось получить погоду. " +
						(error instanceof Error ? error.message : "")
				);
			}
		} finally {
			this.isFetching = false;
		}
	}

	/** Преобразует название города в координаты через Open-Meteo Geocoding API. */
	private async geocodeCity(city: string): Promise<Coordinates> {
		const name = city.trim();
		if (!name) {
			throw new Error("Не указан город в настройках.");
		}
		const url =
			"https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&format=json&name=" +
			encodeURIComponent(name);
		const res = await requestUrl({ url });
		const results = res.json?.results;
		if (!Array.isArray(results) || results.length === 0) {
			throw new Error(`Город «${name}» не найден.`);
		}
		const r = results[0];
		const parts = [r.name, r.admin1, r.country].filter(Boolean);
		return {
			latitude: r.latitude,
			longitude: r.longitude,
			label: parts.join(", "),
		};
	}

	/** Запрашивает текущую погоду по координатам. */
	private async fetchWeather(coords: Coordinates): Promise<WeatherState> {
		const url =
			"https://api.open-meteo.com/v1/forecast" +
			`?latitude=${coords.latitude}&longitude=${coords.longitude}` +
			"&current=temperature_2m,weather_code,is_day";
		const res = await requestUrl({ url });
		const current = res.json?.current;
		if (!current) {
			throw new Error("Пустой ответ Open-Meteo.");
		}
		const code: number = current.weather_code;
		return {
			mood: codeToMood(code),
			temperature: current.temperature_2m,
			description: codeToDescription(code),
			locationLabel: coords.label,
			isDay: current.is_day === 1,
			fetchedAt: Date.now(),
		};
	}

	// -- Рендеринг баннеров ----------------------------------------------

	/** Перерисовывает баннер во всех открытых markdown-заметках. */
	renderAllBanners() {
		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				this.renderBanner(view);
			}
		});
	}

	/** Удаляет все вставленные баннеры (при выгрузке плагина). */
	private removeAllBanners() {
		document
			.querySelectorAll(".weather-mood-banner")
			.forEach((el) => el.remove());
	}

	/** Вставляет/обновляет баннер в шапке конкретной заметки. */
	private renderBanner(view: MarkdownView) {
		const container = view.contentEl;
		// Убираем предыдущий баннер этой заметки.
		container
			.querySelectorAll(":scope > .weather-mood-banner")
			.forEach((el) => el.remove());

		if (!this.weather) return;

		const w = this.weather;
		const banner = createDiv({
			cls: [
				"weather-mood-banner",
				`weather-mood-${w.mood}`,
				w.isDay ? "weather-mood-day" : "weather-mood-night",
				this.settings.animationsEnabled
					? "weather-mood-animated"
					: "weather-mood-static",
			],
		});

		// Слой анимации (частицы/градиенты генерируются через CSS).
		const fx = banner.createDiv({ cls: "weather-mood-fx" });
		this.buildEffectLayer(fx, w.mood);

		// Текстовая подложка с описанием погоды.
		const info = banner.createDiv({ cls: "weather-mood-info" });
		info.createSpan({
			cls: "weather-mood-emoji",
			text: moodEmoji(w.mood, w.isDay),
		});
		info.createSpan({
			cls: "weather-mood-temp",
			text: `${Math.round(w.temperature)}°C`,
		});
		info.createSpan({
			cls: "weather-mood-desc",
			text: w.description,
		});
		info.createSpan({
			cls: "weather-mood-loc",
			text: w.locationLabel,
		});

		// Вставляем баннер первым элементом контейнера заметки.
		container.prepend(banner);
	}

	/** Создаёт DOM-частицы для выбранной погоды (анимируются через CSS). */
	private buildEffectLayer(fx: HTMLElement, mood: WeatherMood) {
		switch (mood) {
			case "rain":
				for (let i = 0; i < 24; i++) {
					const drop = fx.createDiv({ cls: "wm-raindrop" });
					drop.style.left = `${(i / 24) * 100}%`;
					drop.style.animationDelay = `${(i % 8) * 0.12}s`;
					drop.style.animationDuration = `${0.6 + (i % 5) * 0.1}s`;
				}
				break;
			case "snow":
				for (let i = 0; i < 20; i++) {
					const flake = fx.createDiv({ cls: "wm-snowflake" });
					flake.setText("❄");
					flake.style.left = `${(i / 20) * 100}%`;
					flake.style.animationDelay = `${(i % 10) * 0.4}s`;
					flake.style.animationDuration = `${3 + (i % 4)}s`;
					flake.style.fontSize = `${10 + (i % 4) * 3}px`;
				}
				break;
			case "sun":
				// Лучи расходятся из центра; вращение задаётся в CSS.
				fx.createDiv({ cls: "wm-sun-core" });
				const rays = fx.createDiv({ cls: "wm-sun-rays" });
				for (let i = 0; i < 12; i++) {
					const ray = rays.createDiv({ cls: "wm-sun-ray" });
					ray.style.transform = `rotate(${i * 30}deg)`;
				}
				break;
			case "clouds":
			case "fog":
				for (let i = 0; i < 4; i++) {
					const cloud = fx.createDiv({ cls: "wm-cloud" });
					cloud.style.top = `${10 + i * 20}%`;
					cloud.style.animationDelay = `${i * 4}s`;
					cloud.style.animationDuration = `${18 + i * 6}s`;
					cloud.style.transform = `scale(${0.7 + (i % 3) * 0.25})`;
				}
				break;
			case "thunder":
				// База — дождь, поверх него вспышки молний.
				for (let i = 0; i < 18; i++) {
					const drop = fx.createDiv({ cls: "wm-raindrop" });
					drop.style.left = `${(i / 18) * 100}%`;
					drop.style.animationDelay = `${(i % 6) * 0.1}s`;
					drop.style.animationDuration = `${0.5 + (i % 4) * 0.1}s`;
				}
				fx.createDiv({ cls: "wm-flash" });
				fx.createDiv({ cls: "wm-bolt" }).setText("⚡");
				break;
		}
	}
}

// ---------------------------------------------------------------------------
// Сопоставление WMO-кодов Open-Meteo с настроением и описанием
// ---------------------------------------------------------------------------

/** Переводит WMO weather code в категорию анимации. */
function codeToMood(code: number): WeatherMood {
	if (code === 0) return "sun";
	if (code === 1 || code === 2 || code === 3) return "clouds";
	if (code === 45 || code === 48) return "fog";
	if (code >= 51 && code <= 67) return "rain";
	if (code >= 71 && code <= 77) return "snow";
	if (code >= 80 && code <= 82) return "rain";
	if (code === 85 || code === 86) return "snow";
	if (code >= 95 && code <= 99) return "thunder";
	return "clouds";
}

/** Человекочитаемое описание погоды по WMO-коду (на русском). */
function codeToDescription(code: number): string {
	const map: Record<number, string> = {
		0: "Ясно",
		1: "Преимущественно ясно",
		2: "Переменная облачность",
		3: "Пасмурно",
		45: "Туман",
		48: "Изморозь",
		51: "Слабая морось",
		53: "Морось",
		55: "Сильная морось",
		56: "Ледяная морось",
		57: "Сильная ледяная морось",
		61: "Небольшой дождь",
		63: "Дождь",
		65: "Сильный дождь",
		66: "Ледяной дождь",
		67: "Сильный ледяной дождь",
		71: "Небольшой снег",
		73: "Снег",
		75: "Сильный снег",
		77: "Снежная крупа",
		80: "Слабый ливень",
		81: "Ливень",
		82: "Сильный ливень",
		85: "Снежный ливень",
		86: "Сильный снежный ливень",
		95: "Гроза",
		96: "Гроза с градом",
		99: "Сильная гроза с градом",
	};
	return map[code] ?? "Неизвестно";
}

/** Эмодзи для текстовой подложки баннера. */
function moodEmoji(mood: WeatherMood, isDay: boolean): string {
	switch (mood) {
		case "sun":
			return isDay ? "☀️" : "🌙";
		case "clouds":
			return "☁️";
		case "fog":
			return "🌫️";
		case "rain":
			return "🌧️";
		case "snow":
			return "❄️";
		case "thunder":
			return "⛈️";
	}
}

// ---------------------------------------------------------------------------
// Вкладка настроек
// ---------------------------------------------------------------------------

class WeatherMoodSettingTab extends PluginSettingTab {
	plugin: WeatherMoodPlugin;

	constructor(app: App, plugin: WeatherMoodPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Weather Mood" });

		new Setting(containerEl)
			.setName("Город")
			.setDesc("Название населённого пункта (например, «Санкт-Петербург»).")
			.addText((text) =>
				text
					.setPlaceholder("Москва")
					.setValue(this.plugin.settings.city)
					.onChange(async (value) => {
						this.plugin.settings.city = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Применить")
					.setCta()
					.onClick(() => this.plugin.refreshWeather(true))
			);

		new Setting(containerEl)
			.setName("Частота обновления")
			.setDesc("Как часто опрашивать Open-Meteo, в минутах (минимум 1).")
			.addText((text) =>
				text
					.setPlaceholder("30")
					.setValue(String(this.plugin.settings.refreshMinutes))
					.onChange(async (value) => {
						const n = Number(value);
						if (Number.isFinite(n) && n >= 1) {
							this.plugin.settings.refreshMinutes = Math.floor(n);
							await this.plugin.saveSettings();
							this.plugin.scheduleRefresh();
						}
					})
			);

		new Setting(containerEl)
			.setName("Анимации")
			.setDesc("Включить движущиеся эффекты (капли, снежинки, лучи, облака, молнии).")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.animationsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.animationsEnabled = value;
						await this.plugin.saveSettings();
						this.plugin.renderAllBanners();
					})
			);

		new Setting(containerEl)
			.setName("Обновить сейчас")
			.setDesc("Принудительно запросить текущую погоду.")
			.addButton((btn) =>
				btn
					.setButtonText("Обновить погоду")
					.onClick(() => this.plugin.refreshWeather(true))
			);
	}
}
