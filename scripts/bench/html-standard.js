#!/usr/bin/env node
// @ts-check

import {readFileSync} from "node:fs";

import {
	clearFormat,
	Node,
	Entry,
	Value,
	format,
	parse,
} from "../../src/index.js";
import {parse as parseQuery} from "../../src/query.js";

const file = readFileSync(
	new URL(
		"../../test/upstream/tests/benchmarks/html-standard.kdl",
		import.meta.url,
	),
	"utf8",
);

let start = performance.now();
const document = parse(file);
console.log("parse:", performance.now() - start);

start = performance.now();
clearFormat(document);
console.log("clearFormat:", performance.now() - start);

const reIsEntirelyWhitespace =
	/^[\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;
const reMultipleWhitespace =
	/[\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;

/**
 * @param {Node} node
 * @returns {node is Node & {entries: [Entry & {name: null; value: Value & {value: string;}}]}}
 */
function isTextNode(node) {
	return (
		node.name.name === "-" &&
		node.entries.length === 1 &&
		node.entries[0].name == null &&
		typeof node.entries[0].value.value === "string"
	);
}

start = performance.now();
(function walk(doc) {
	for (const node of doc.nodes.slice()) {
		if (node.children) {
			walk(node.children);
		}

		if (isTextNode(node)) {
			if (reIsEntirelyWhitespace.test(node.entries[0].value.value)) {
				doc.removeNode(node);
			} else {
				node.entries[0].value.value = node.entries[0].value.value.replaceAll(
					reMultipleWhitespace,
					" ",
				);
			}
		} else if (
			node.children?.nodes.length === 1 &&
			isTextNode(node.children.nodes[0])
		) {
			node.entries.push(node.children.nodes[0].entries[0]);
			node.children = null;
		}
	}
})(document);
console.log("walk:", performance.now() - start);

start = performance.now();
const formatted = format(document);
console.log("format:", performance.now() - start);

console.log(
	`cleaned up size: ${formatted.length} bytes instead of the original ${file.length} bytes`,
);

const query = parseQuery("span[class=secno]");

start = performance.now();
let count = 0;
for (const _ of query.find(document)) {
	count++;
}
console.log("query:", performance.now() - start);

console.log("number of span[class=secno]:", count);
