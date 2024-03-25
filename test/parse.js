import assert from "node:assert/strict";
import {test} from "uvu";

import {
	clearFormat,
	Document,
	Entry,
	getLocation,
	Identifier,
	Node,
	parse,
	Value,
} from "../src/index.js";

test("parse document", () => {
	const parsed = clearFormat(
		parse(String.raw`
node "value" #"value too"# 2 0b10_10 0xfF #null \
     #true #false {
	child; "child too"; ##"child three"## {}
}
`),
	);

	assert.deepEqual(
		parsed,
		new Document([
			new Node(
				new Identifier("node"),
				[
					new Entry(new Value("value"), null),
					new Entry(new Value("value too"), null),
					new Entry(new Value(2), null),
					new Entry(new Value(10), null),
					new Entry(new Value(255), null),
					new Entry(new Value(null), null),
					new Entry(new Value(true), null),
					new Entry(new Value(false), null),
				],
				new Document([
					new Node(new Identifier("child")),
					new Node(new Identifier("child too")),
					new Node(new Identifier("child three")),
				]),
			),
		]),
	);
});

test("parse parts", () => {
	assert.deepEqual(
		clearFormat(parse("0b1_0_1_0", {as: "value"})),
		new Value(10),
	);

	assert.deepEqual(
		clearFormat(parse("0b1_0_1_0", {as: "entry"})),
		new Entry(new Value(10), null),
	);

	assert.deepEqual(
		clearFormat(parse('/-"lorem" asdf=#false', {as: "entry"})),
		new Entry(new Value(false), new Identifier("asdf")),
	);

	assert.deepEqual(
		clearFormat(parse("lorem asdf=#false", {as: "node"})),
		new Node(new Identifier("lorem"), [
			new Entry(new Value(false), new Identifier("asdf")),
		]),
	);
});

test("parse with locations", () => {
	const document = parse('node (string)"test"', {storeLocations: true});

	assert.deepEqual(getLocation(document), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 19,
		endLine: 1,
		endColumn: 20,
	});

	assert.deepEqual(getLocation(document.nodes[0]), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 19,
		endLine: 1,
		endColumn: 20,
	});

	assert.deepEqual(getLocation(document.nodes[0].name), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 4,
		endLine: 1,
		endColumn: 5,
	});

	assert.deepEqual(getLocation(document.nodes[0].entries[0]), {
		startOffset: 5,
		startLine: 1,
		startColumn: 6,

		endOffset: 19,
		endLine: 1,
		endColumn: 20,
	});
});

test("parse equals", () => {
	assert.deepEqual(
		clearFormat(parse("node p1﹦val1 p2＝val2 p3🟰val3")),
		new Document([
			new Node(
				new Identifier("node"),
				[
					Entry.createProperty("p1", "val1"),
					Entry.createProperty("p2", "val2"),
					Entry.createProperty("p3", "val3"),
				],
				null,
			),
		]),
	);
});

test("escaped whitespace", () => {
	assert.deepEqual(
		clearFormat(
			parse(String.raw`
      node "one" "o\   n\
              e"
      node "\\ " "\\\     \s" "\      \\ "
      `),
		),
		new Document([
			new Node(new Identifier("node"), [
				Entry.createArgument("one"),
				Entry.createArgument("one"),
			]),
			new Node(new Identifier("node"), [
				Entry.createArgument("\\ "),
				Entry.createArgument("\\ "),
				Entry.createArgument("\\ "),
			]),
		]),
	);
});

test.run();
