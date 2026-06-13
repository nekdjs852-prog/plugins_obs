import esbuild from "esbuild";
import process from "process";

// production-режим включается аргументом командной строки
const production = process.argv[2] === "production";

const context = await esbuild.context({
	entryPoints: ["main.ts"],
	bundle: true,
	// obsidian и встроенные модули не включаем в сборку (external)
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	platform: "browser",
});

if (production) {
	// Однократная сборка
	await context.rebuild();
	await context.dispose();
} else {
	// Режим разработки: пересборка при изменениях
	await context.watch();
}
