#!/usr/bin/env node
// @ts-check

import {execSync} from "node:child_process";
import {
	readFileSync,
	writeFileSync,
	rmSync,
	mkdirSync,
	copyFileSync,
	cpSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

process.chdir(path.dirname(import.meta.dirname));

// Start fresh

rmSync("out", {recursive: true, force: true});
mkdirSync("out");

try {
	// Compile code
	execSync("tsc -p tsconfig.json");

	// Then copy over the .d.ts files, since tsc doesn't do that for us
	cpSync("src", "out", {
		recursive: true,
		force: true,
		filter: (name) =>
			name.endsWith(".d.ts") || !(name.endsWith(".ts") || name.endsWith(".js")),
	});

	// Reformat code, since tsc emits weird formatting
	execSync("prettier --write .", {cwd: "out"});
} catch (e) {
	console.error(String(e));
	if (e && typeof e === "object" && "stdout" in e) {
		console.error("output:");
		console.error(
			/** @type {import("node:child_process").ExecException} */ (
				e
			).stdout?.toString(),
		);
	}
	process.exit(1);
}

// Write metadata

const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
// Allow the package to be published
delete packageJson.private;
// Remove all dependencies, those are bundled into the package
delete packageJson.dependencies;
delete packageJson.devDependencies;
delete packageJson.resolutions;
// Remove all scripts and development info
delete packageJson.scripts;
delete packageJson.packageManager;
// Set exports
packageJson.main = "./index.js";
packageJson.types = "./index.d.ts";
packageJson.exports = {
	".": {
		types: "./index.d.ts",
		default: "./index.js",
	},
	"./json": {
		types: "./json.d.ts",
		default: "./json.js",
	},
	"./v1-compat": {
		types: "./v1-compat.d.ts",
		default: "./v1-compat.js",
	},
	"./dessert": {
		types: "./dessert.d.ts",
		default: "./dessert.js",
	},
	"./package.json": "./package.json",
};

writeFileSync("out/package.json", JSON.stringify(packageJson, null, 2));

copyFileSync("README.md", "out/README.md");
copyFileSync("LICENSE.md", "out/LICENSE.md");
