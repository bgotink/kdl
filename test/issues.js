import {expect} from 'expect';
import {test} from 'uvu';

import {clearFormat, Entry, Node, parse} from '../src/index.js';

test('issue #1: leading/trailing whitespace', () => {
	expect(
		clearFormat(
			parse(
				String.raw`
					node {}
				`,
				{as: 'node'},
			),
		),
	).toEqual(Node.create('node'));

	expect(
		clearFormat(
			parse(
				String.raw`    \
					prop="value" \
				`,
				{as: 'entry'},
			),
		),
	).toEqual(Entry.createProperty('prop', 'value'));

	expect(
		clearFormat(
			parse(
				String.raw` \
					"value"   \
				`,
				{as: 'entry'},
			),
		),
	).toEqual(Entry.createArgument('value'));
});

test('issue #3: slashdash children should count as children', () => {
	expect(() => parse(String.raw`node /- {children;} {children;}`)).toThrow();
	expect(() => parse(String.raw`node /- {children;} /- {children;}`)).toThrow();

	expect(() => parse(String.raw`node /- {children;} "arg"`)).toThrow();
	expect(() => parse(String.raw`node /- {children;} prop="value"`)).toThrow();

	expect(() => parse(String.raw`node {children;} /- "arg"`)).toThrow();
	expect(() => parse(String.raw`node {children;} /- prop="value"`)).toThrow();
});

test('issue #5: trailing comments', () => {
	expect(() => parse(`node "arg"\n\n// test\n`)).not.toThrow();
});

test.run();
