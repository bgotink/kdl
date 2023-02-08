import assert from 'node:assert/strict';
import {test} from 'uvu';

import {
	clearFormat,
	Comment,
	Document,
	Entry,
	getLocation,
	Identifier,
	Node,
	parse,
	Value,
	Whitespace,
} from '../src/index.js';

test('parse document', () => {
	const parsed = clearFormat(
		parse(String.raw`
node "value" r"value too" 2 0b10_10 0xfF null \
     true false {
	child; "child too"; r##"child three"## {}
}
`),
	);

	assert.deepEqual(
		parsed,
		new Document([
			new Node(
				new Identifier('node'),
				[
					new Entry(new Value('value'), null),
					new Entry(new Value('value too'), null),
					new Entry(new Value(2), null),
					new Entry(new Value(10), null),
					new Entry(new Value(255), null),
					new Entry(new Value(null), null),
					new Entry(new Value(true), null),
					new Entry(new Value(false), null),
				],
				new Document([
					new Node(new Identifier('child')),
					new Node(new Identifier('child too')),
					new Node(new Identifier('child three')),
				]),
			),
		]),
	);
});

test('parse parts', () => {
	assert.deepEqual(
		clearFormat(parse('0b1_0_1_0', {as: 'value'})),
		new Value(10),
	);

	assert.deepEqual(
		clearFormat(parse('0b1_0_1_0', {as: 'entry'})),
		new Entry(new Value(10), null),
	);

	assert.deepEqual(
		clearFormat(parse('/-"lorem" asdf=false', {as: 'entry'})),
		new Entry(new Value(false), new Identifier('asdf')),
	);

	assert.deepEqual(
		clearFormat(parse('lorem asdf=false', {as: 'node'})),
		new Node(new Identifier('lorem'), [
			new Entry(new Value(false), new Identifier('asdf')),
		]),
	);
});

test('parse with locations', () => {
	const document = parse('node (string)"test"', {storeLocations: true});

	assert.deepEqual(getLocation(document), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 19,
		endLine: 1,
		endColumn: 19,
	});

	assert.deepEqual(getLocation(document.nodes[0]), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 19,
		endLine: 1,
		endColumn: 19,
	});

	assert.deepEqual(getLocation(document.nodes[0].name), {
		startOffset: 0,
		startLine: 1,
		startColumn: 1,

		endOffset: 4,
		endLine: 1,
		endColumn: 4,
	});

	assert.deepEqual(getLocation(document.nodes[0].entries[0]), {
		startOffset: 4,
		startLine: 1,
		startColumn: 5,

		endOffset: 19,
		endLine: 1,
		endColumn: 19,
	});
});

test('parse whitespace', () => {
	assert.deepEqual(
		parse(
			String.raw`/- lorem=(i64)0b10_10 \
/*
 * lorem ipsum dolor sit amet
 */\// lorem ipsum dolor sit amet
`,
			{as: 'whitespace in node'},
		),
		[
			new Comment('/- lorem=(i64)0b10_10'),
			new Whitespace('space', ' '),
			new Whitespace('line-escape', '\\\n'),
			new Comment(`/*\n * lorem ipsum dolor sit amet\n */`),
			new Whitespace('line-escape', '\\'),
			new Comment('// lorem ipsum dolor sit amet\n'),
		],
	);

	assert.deepEqual(
		parse(
			String.raw`/- node lorem=(i64)0b10_10
/*
 * lorem ipsum dolor sit amet
 */\// lorem ipsum dolor sit amet
`,
			{as: 'whitespace in document'},
		),
		[
			new Comment('/- node lorem=(i64)0b10_10\n'),
			new Comment(`/*\n * lorem ipsum dolor sit amet\n */`),
			new Whitespace('line-escape', '\\'),
			new Comment('// lorem ipsum dolor sit amet\n'),
		],
	);
});

test.run();
