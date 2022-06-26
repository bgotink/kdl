#!/usr/bin/env node

import {execSync} from 'node:child_process';
import {
	readFileSync,
	writeFileSync,
	rmSync,
	mkdirSync,
	copyFileSync,
} from 'node:fs';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

rmSync('out', {recursive: true, force: true});
mkdirSync('out');

execSync('tsc -p tsconfig.compile.json');
copyFileSync('src/parse.d.ts', 'out/parse.d.ts');

execSync(
	'esbuild --bundle src/index.js --outfile=out/index.cjs --target=node14 --format=cjs',
);
writeFileSync(
	'out/index.mjs',
	`import kdl from './index.cjs';

export const Document = kdl.Document;
export const Entry = kdl.Entry;
export const Identifier = kdl.Identifier;
export const InvalidKdlError = kdl.InvalidKdlError;
export const Node = kdl.Node;
export const Value = kdl.Value;
export const parse = kdl.parse;
`,
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
delete packageJson.private;
delete packageJson.dependencies;
delete packageJson.devDependencies;
delete packageJson.resolutions;
delete packageJson.scripts;
delete packageJson.packageManager;
packageJson.main = './index.cjs';
packageJson.exports = {
	types: './index.d.ts',
	import: './index.mjs',
	default: './index.cjs',
};

writeFileSync('out/package.json', JSON.stringify(packageJson, null, 2));

copyFileSync('README.md', 'out/README.md');
copyFileSync('LICENSE.md', 'out/LICENSE.md');
