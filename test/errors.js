import {expect} from 'expect';
import {test} from 'uvu';

import {parse} from '../src/index.js';

test('unterminated node', () => {
	expect(() => parse(`node {child}`)).toThrowError(
		/missing ";" between child node and "}" at 1:12/,
	);
	expect(() => parse(`node sibling "lorem"`)).toThrowError(
		/missing ";" or newline between two sibling nodes, or missing "=" to define a property at 1:13/,
	);
	expect(() => parse(`node sibling`)).toThrowError(
		/missing ";" or newline between two sibling nodes, or missing "=" to define a property at end of input/,
	);
});

test('invalid identifiers', () => {
	expect(() => parse('lorem/ipsum')).toThrowError(
		/encountered unexpected "\/", did you forget to quote an identifier\? at 1:6/,
	);
	expect(() => parse('lorem[ipsum')).toThrowError(
		/encountered unexpected "\[", did you forget to quote an identifier\? at 1:6/,
	);
	expect(() => parse('lorem 2=3')).toThrowError(
		/encountered unexpected "=", did you forget to quote a property name that isn't a valid identifier\? at 1:8/,
	);
});

test.run();
