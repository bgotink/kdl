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
		parse(String.raw`"\u{10abcd}"`, {as: "value"}).value,
		String.fromCodePoint(0x10abcd),
	);
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
	});

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
	});
});

test.run();
