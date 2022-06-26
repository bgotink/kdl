import {expect} from 'expect';
import {test} from 'uvu';

import {
	clearFormat,
	Document,
	Entry,
	Identifier,
	Node,
	parse,
	Value,
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

	expect(parsed).toEqual(
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
	expect(clearFormat(parse('0b1_0_1_0', {as: 'value'}))).toEqual(new Value(10));

	expect(clearFormat(parse('0b1_0_1_0', {as: 'entry'}))).toEqual(
		new Entry(new Value(10), null),
	);

	expect(clearFormat(parse('/-"lorem" asdf=false', {as: 'entry'}))).toEqual(
		new Entry(new Value(false), new Identifier('asdf')),
	);

	expect(clearFormat(parse('lorem asdf=false', {as: 'node'}))).toEqual(
		new Node(new Identifier('lorem'), [
			new Entry(new Value(false), new Identifier('asdf')),
		]),
	);
});

test.run();
