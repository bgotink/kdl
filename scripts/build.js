#!/usr/bin/env node

import {execSync} from "node:child_process";
import {
	readFileSync,
	writeFileSync,
	rmSync,
	mkdirSync,
	copyFileSync,
} from "node:fs";
import process from "node:process";
import {fileURLToPath} from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

// Start fresh

rmSync("out", {recursive: true, force: true});
mkdirSync("out");

// TypeScript

execSync("tsc -p tsconfig.compile.json");
// tsc doesn't copy .d.ts files out of the source folder
copyFileSync("src/parse.d.ts", "out/parse.d.ts");
copyFileSync("src/json.d.ts", "out/json.d.ts");

// JavaScript

// Build code for `require()`, move to ESM only once prettier supports ESM plugins...
// Bundle dependencies, because chevrotain is huge and we only use (small) parts
execSync(
	"esbuild --bundle --external:@bgotink/kdl --platform=node src/index.js src/json.js --outdir=out --out-extension:.js=.cjs --target=node14.8 --format=cjs",
);

// Write metadata

const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
// Allow the package to be published
delete packageJson.private;
// Unset the `"type": "module"` because it makes typescript think that .d.ts
// files are import-only. We name all files .mjs and .cjs explicitly anyway.
delete packageJson.type;
// Remove all dependencies, those are bundled into the package
delete packageJson.dependencies;
delete packageJson.devDependencies;
delete packageJson.resolutions;
// Remove all scripts and development info
delete packageJson.scripts;
delete packageJson.packageManager;
// Set exports
packageJson.main = "./index.cjs";
packageJson.types = "./index.d.ts";
packageJson.exports = {
	".": {
		types: "./index.d.ts",
		default: "./index.cjs",
	},
	"./json": {
		types: "./json.d.ts",
		default: "./json.cjs",
	},
	"./package.json": "./package.json",
};

writeFileSync("out/package.json", JSON.stringify(packageJson, null, 2));

copyFileSync("README.md", "out/README.md");
copyFileSync("LICENSE.md", "out/LICENSE.md");
