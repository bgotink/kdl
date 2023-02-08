import assert from 'node:assert/strict';
import {test} from 'uvu';

import {parse} from '../src/index.js';

test('unterminated node', () => {
	assert.throws(
		() => parse(`node {child}`),
		/missing ";" between child node and "}" at 1:12/,
	);
	assert.throws(
		() => parse(`node sibling "lorem"`),
		/missing ";" or newline between two sibling nodes, or missing "=" to define a property at 1:13/,
	);
	assert.throws(
		() => parse(`node sibling`),
		/missing ";" or newline between two sibling nodes, or missing "=" to define a property at end of input/,
	);
});

test('invalid identifiers', () => {
	assert.throws(
		() => parse('lorem/ipsum'),
		/encountered unexpected "\/", did you forget to quote an identifier\? at 1:6/,
	);
	assert.throws(
		() => parse('lorem[ipsum'),
		/encountered unexpected "\[", did you forget to quote an identifier\? at 1:6/,
	);
	assert.throws(
		() => parse('lorem 2=3'),
		/encountered unexpected "=", did you forget to quote a property name that isn't a valid identifier\? at 1:8/,
	);
});

test.run();
