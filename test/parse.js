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

test("parse with precise locations", () => {
	const document = parse('🏳️‍🌈😅 (string)"test"', {
		storeLocations: true,
		graphemeLocations: true,
	});

	assert.deepEqual(getLocation(document), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 23,
		endLine: 1,
		endColumn: 18,
	});

	assert.deepEqual(getLocation(document.nodes[0]), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 23,
		endLine: 1,
		endColumn: 18,
	});

	assert.deepEqual(getLocation(document.nodes[0].name), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 8,
		endLine: 1,
		endColumn: 3,
	});

	assert.deepEqual(getLocation(document.nodes[0].entries[0]), {
		startOffset: 9,
		startLine: 1,
		startColumn: 4,

		endOffset: 23,
		endLine: 1,
		endColumn: 18,
	});
});

test("parse with locations", () => {
	const document = parse('🏳️‍🌈😅 (string)"test"', {
		storeLocations: true,
	});

	assert.deepEqual(getLocation(document), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 23,
		endLine: 1,
		endColumn: 21,
	});

	assert.deepEqual(getLocation(document.nodes[0]), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 23,
		endLine: 1,
		endColumn: 21,
	});

	assert.deepEqual(getLocation(document.nodes[0].name), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 8,
		endLine: 1,
		endColumn: 6,
	});

	assert.deepEqual(getLocation(document.nodes[0].entries[0]), {
		startOffset: 9,
		startLine: 1,
		startColumn: 7,

		endOffset: 23,
		endLine: 1,
		endColumn: 21,
	});
});

test("parse equals", () => {
	assert.deepEqual(
		clearFormat(parse("node p1﹦val1 p2＝val2 p3🟰val3")),
		new Document([
			new Node(
				new Identifier("node"),
				[
					Entry.createArgument("p1﹦val1"),
					Entry.createArgument("p2＝val2"),
					Entry.createArgument("p3🟰val3"),
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

test("parse whitespace", () => {
	assert.deepEqual(
		parse(`\uFEFF  // test\n  /* test /* test */*/ /- some node\n`, {
			as: "whitespace in document",
		}),
		[
			{
				type: "bom",
				text: "\uFEFF",
			},
			{
				type: "space",
				text: "  ",
			},
			{
				type: "singleline",
				text: "// test\n",
			},
			{
				type: "space",
				text: "  ",
			},
			{
				type: "multiline",
				text: "/* test /* test */*/",
			},
			{
				type: "space",
				text: " ",
			},
			{
				type: "slashdash",
				preface: [
					{
						type: "space",
						text: " ",
					},
				],
				value: (() => {
					const node = new Node(new Identifier("some"), [
						Entry.createArgument("node"),
					]);

					node.name.representation = "some";
					node.entries[0].leading = " ";
					node.entries[0].value.representation = "node";
					node.trailing = "\n";

					return node;
				})(),
			},
		],
	);

	assert.deepEqual(
		parse(`  \\// test\n  /* test /* test */*/ /- some=prop`, {
			as: "whitespace in node",
		}),
		[
			{
				type: "space",
				text: "  ",
			},
			{
				type: "line-escape",
				text: "\\// test\n",
			},
			{
				type: "space",
				text: "  ",
			},
			{
				type: "multiline",
				text: "/* test /* test */*/",
			},
			{
				type: "space",
				text: " ",
			},
			{
				type: "slashdash",
				preface: [
					{
						type: "space",
						text: " ",
					},
				],
				value: (() => {
					const entry = Entry.createProperty("some", "prop");
					entry.equals = "=";
					/** @type {Identifier} */ (entry.name).representation = "some";
					entry.value.representation = "prop";

					return entry;
				})(),
			},
		],
	);
});

test("escline", () => {
	assert.deepEqual(
		clearFormat(
			parse(String.raw`
			node\
				arg\
				arg\
				arg
		`),
		),
		new Document([
			new Node(new Identifier("node"), [
				Entry.createArgument("arg"),
				Entry.createArgument("arg"),
				Entry.createArgument("arg"),
			]),
		]),
	);
});

test.run();
