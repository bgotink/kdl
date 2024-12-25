#!/usr/bin/env node

import {execSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {stdin, argv, exit} from "node:process";

if (argv[2] === "supports") {
	exit(0);
}

/** @type {Buffer[]} */
const inputChunks = [];
for await (const chunk of stdin) {
	inputChunks.push(chunk);
}

const input = JSON.parse(Buffer.concat(inputChunks).toString("utf-8"));

let version;
try {
	version = `Version ${execSync("git describe --exact").toString("utf-8").trim().replace(/^v/, "")}`;
} catch {
	version = `Commit ${execSync("git describe").toString("utf-8").trim()}`;
}

process.stdout.write(
	JSON.stringify(input[1]).replaceAll(/\{\{\s*VERSION\s*\}\}/g, version),
);
