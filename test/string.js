import assert from "node:assert/strict";
import {test} from "uvu";

import {
	Document,
	Entry,
	Identifier,
	InvalidKdlError,
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
		/The final line in a multiline string may only contain whitespace/,
	);

	assert.throws(() => {
		parse(String.raw`
			node """
				foo
				bar\
				"""
		`);
	}, /The final line in a multiline string may only contain whitespace/);
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

test("multiple errors", () => {
	assert.throws(
		() =>
			parse(String.raw`
				node "test
				oh no"

				node #"test
				oh no"#

				node #""" not like this
				"""#

				node """
				not like
				this """
			`),
		(error) => {
			assert(error instanceof InvalidKdlError);
			assert.equal(error.errors?.length, 4);
			// Include line numbers so a failure shows which error is missing,
			// don't include columns so reformatting this file doesn't make this test fail.
			assert.match(
				error.errors[0].message,
				/use triple-quotes for multiline strings at 2/,
			);
			assert.match(
				error.errors[1].message,
				/use triple-quotes for multiline strings at 5/,
			);
			assert.match(
				error.errors[2].message,
				/Multi-line strings must start with a newline at 8/,
			);
			assert.match(
				error.errors[3].message,
				/The final line in a multiline string may only contain whitespace at 13/,
			);
			return true;
		},
	);
});

test("raw string edge cases", () => {
	assert.equal(parse(`#""#`, {as: "value"}).value, "");
	assert.equal(parse(`##""##`, {as: "value"}).value, "");
	assert.equal(parse(`##""#"##`, {as: "value"}).value, '"#');
});

test.run();
