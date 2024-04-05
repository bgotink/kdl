import assert from "node:assert/strict";
import {test} from "uvu";

import {
	Document,
	Entry,
	Identifier,
	Node,
	clearFormat,
	parse,
} from "../src/index.js";

/** @param {string} text */
function parseAndClearFormat(text) {
	return clearFormat(parse(text));
}

test("\\u escapes", () => {
	assert.equal(
		parse(String.raw`"\u{FEFF}"`, {as: "value"}).value,
		String.fromCodePoint(0xfeff),
	);

	assert.equal(
		parse(String.raw`"\u{10abcd}"`, {as: "value"}).value,
		String.fromCodePoint(0x10abcd),
	);

	assert.throws(
		() => parse(String.raw`"\u{xoxo}"`, {as: "value"}),
		/Invalid unicode escape "\\u\{xoxo\}"/,
	);
	assert.throws(
		() => parse(String.raw`"\uFEFF"`, {as: "value"}),
		/Invalid unicode escape "\\uFEFF"/,
	);
	assert.throws(
		() => parse(String.raw`"\u{FEFFEF}"`, {as: "value"}),
		/Invalid unicode escape "\\u{FEFFEF}"/,
	);
});

test("invalid \\escapes", () => {
	assert.throws(() => parse(String.raw`"\u"`), /Invalid escape "\\u"/);
	assert.throws(() => parse(String.raw`"\x"`), /Invalid escape "\\x"/);
});

test("invalid multiline escaped whitespace", () => {
	assert.deepEqual(
		parseAndClearFormat(String.raw`
			node "
				foo \
				bar
				baz
				"
		`),
		new Document([
			new Node(new Identifier("node"), [Entry.createArgument("foo bar\nbaz")]),
		]),
	);

	assert.throws(() => {
		parse(String.raw`
			node "
				foo \
			bar
				baz
				"
		`);
	}, /doesn't start with the offset defined by the last line of the string/);

	assert.deepEqual(
		parseAndClearFormat(String.raw`
			node "
				foo
				bar\ ${""}
				"
		`),
		new Document([
			new Node(new Identifier("node"), [Entry.createArgument("foo\nbar")]),
		]),
	);

	assert.throws(() => {
		parse(String.raw`
			node "
				foo
				bar\
				"
		`);
	}, /Invalid whitespace escape at the end of a string/);
});

test.run();
