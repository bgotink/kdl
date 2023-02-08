import assert from 'node:assert/strict';
import {test} from 'uvu';

import {clearFormat, Entry, Node, parse} from '../src/index.js';

test('issue #1: leading/trailing whitespace', () => {
	assert.deepEqual(
		clearFormat(
			parse(
				String.raw`
					node {}
				`,
				{as: 'node'},
			),
		),
		Node.create('node'),
	);

	assert.deepEqual(
		clearFormat(
			parse(
				String.raw`    \
					prop="value" \
				`,
				{as: 'entry'},
			),
		),
		Entry.createProperty('prop', 'value'),
	);

	assert.deepEqual(
		clearFormat(
			parse(
				String.raw` \
					"value"   \
				`,
				{as: 'entry'},
			),
		),
		Entry.createArgument('value'),
	);
});

test('issue #3: slashdash children should count as children', () => {
	assert.throws(() => parse(String.raw`node /- {children;} {children;}`));
	assert.throws(() => parse(String.raw`node /- {children;} /- {children;}`));

	assert.throws(() => parse(String.raw`node /- {children;} "arg"`));
	assert.throws(() => parse(String.raw`node /- {children;} prop="value"`));

	assert.throws(() => parse(String.raw`node {children;} /- "arg"`));
	assert.throws(() => parse(String.raw`node {children;} /- prop="value"`));
});

test('issue #5: trailing comments', () => {
	assert.doesNotThrow(() => parse(`node "arg"\n\n// test\n`));
});

test.run();
