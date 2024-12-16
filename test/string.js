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
			node """
				foo \
				bar
				baz
				"""
		`),
		new Document([
			new Node(new Identifier("node"), [Entry.createArgument("foo bar\nbaz")]),
		]),
	);

	assert.deepEqual(
		parseAndClearFormat(String.raw`
			node """
				foo \
			bar
				baz
				"""
		`),
		new Document([
			new Node(new Identifier("node"), [Entry.createArgument("foo bar\nbaz")]),
		]),
	);

	assert.throws(
		() =>
			parseAndClearFormat(String.raw`
			node """
				foo
				bar\ ${""}
				"""
		`),
		/must end with a line containing only whitespace/,
	);

	assert.throws(() => {
		parse(String.raw`
			node """
				foo
				bar\
				"""
		`);
	}, /must end with a line containing only whitespace/);
});

test("whitespace escapes in multiline", () => {
	assert.deepEqual(
		parseAndClearFormat(String.raw`
			node """
			test\\ value
			"""
		`),
		new Document([
			new Node(new Identifier("node"), [Entry.createArgument("test\\ value")]),
		]),
	);
});

test.run();
