#!/usr/bin/env node

import {execSync} from "node:child_process";
import {
	readFileSync,
	writeFileSync,
	rmSync,
	mkdirSync,
	copyFileSync,
	cpSync,
} from "node:fs";
import process from "node:process";
import {fileURLToPath} from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

// Start fresh

rmSync("out", {recursive: true, force: true});
mkdirSync("out");

// TypeScript

execSync("tsc -p tsconfig.json");

// JavaScript

cpSync("src", "out", {recursive: true});

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
