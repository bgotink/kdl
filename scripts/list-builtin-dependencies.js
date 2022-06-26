#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

let content;
try {
	content = readFileSync('out/index.cjs', 'utf-8');
} catch {
	process.stderr.write(
		'Please run `yarn build` before trying to find all dependencies\n',
	);
	process.exit(1);
}

const matches = new Set(
	content.match(/(?<=\/\/ node_modules\/)(?:@[^/]+\/)?[^/]+/g),
);

console.log(Array.from(matches, match => `- ${match}`).join('\n'));
