import {expect} from 'expect';
import {test} from 'uvu';

import {parse} from '../src/index.js';
import {toJson} from '../src/json.js';

test('parse null', () => {
	expect(
		toJson(
			parse(
				String.raw`
					node null
				`,
				{as: 'node'},
			),
		),
	).toEqual(null);
});

test('parse number', () => {
	expect(
		toJson(
			parse(
				String.raw`
					node 0xdead_beef
				`,
				{as: 'node'},
			),
		),
	).toEqual(0xdeadbeef);
});

test('parse boolean', () => {
	expect(
		toJson(
			parse(
				String.raw`
					node false
				`,
				{as: 'node'},
			),
		),
	).toEqual(false);
});

test('parse node object', () => {
	expect(
		toJson(
			parse(
				String.raw`
					node prop=false
				`,
				{as: 'node'},
			),
		),
	).toEqual({prop: false});
});

test('parse node array', () => {
	expect(
		toJson(
			parse(
				String.raw`
					node 0 false
				`,
				{as: 'node'},
			),
		),
	).toEqual([0, false]);
});

test('parse document object', () => {
	expect(
		toJson(
			parse(
				String.raw`
					prop false
				`,
			),
		),
	).toEqual({prop: false});
});

test('parse document array', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- 0
					- false
				`,
			),
		),
	).toEqual([0, false]);
});

test('extensive', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- 0
					- prop=false
					- {
						prop false
					}
					- 1 2 3 {
						- 4
						- 5 6
					}
					- prop=false {
						other true
					}
					- prop=false {
						- true
					}

					// check (object) handling
					- {
						- 0
					}
					(object)- {
						- 0
					}

					// check (array) handling
					- 0
					(array)- 0
				`,
			),
		),
	).toEqual([
		0,
		{prop: false},
		{prop: false},
		[1, 2, 3, 4, [5, 6]],
		{prop: false, other: true},
		{prop: false, '-': true},
		[0],
		{'-': 0},
		0,
		[0],
	]);
});

test.run();
