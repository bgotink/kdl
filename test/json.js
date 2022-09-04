import {expect} from 'expect';
import {test} from 'uvu';

import {Node, parse} from '../src/index.js';
import {toJson} from '../src/json.js';

test('parse null', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- null
				`,
				{as: 'node'},
			),
		),
	).toEqual(null);

	expect(
		toJson(
			parse(
				String.raw`
					- null
				`,
			),
		),
	).toEqual(null);
});

test('parse number', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- 0xdead_beef
				`,
				{as: 'node'},
			),
		),
	).toEqual(0xdeadbeef);

	expect(
		toJson(
			parse(
				String.raw`
					- 0xdead_beef
				`,
			),
		),
	).toEqual(0xdeadbeef);
});

test('parse boolean', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- false
				`,
				{as: 'node'},
			),
		),
	).toEqual(false);

	expect(
		toJson(
			parse(
				String.raw`
					- false
				`,
			),
		),
	).toEqual(false);
});

test('parse object', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- prop=false
				`,
				{as: 'node'},
			),
		),
	).toEqual({prop: false});

	expect(
		toJson(
			parse(
				String.raw`
					- prop=false
				`,
			),
		),
	).toEqual({prop: false});
});

test('parse array', () => {
	expect(
		toJson(
			parse(
				String.raw`
					- 0 false
				`,
				{as: 'node'},
			),
		),
	).toEqual([0, false]);

	expect(
		toJson(
			parse(
				String.raw`
					- 0 false
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
					- {
						- 0
						- prop=false
						(object)- {
							prop false
						}
						- 1 2 3 {
							- 4
							(array)- 5 6
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
					}
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

test('support any root node name', () => {
	expect(
		toJson(
			parse(
				String.raw`
					any_name_works 0
				`,
			),
		),
	).toEqual(0);
});

test('empty values', () => {
	const node = Node.create('-');

	expect(() => toJson(node)).toThrow();

	node.setTag('object');
	expect(toJson(node)).toEqual({});

	node.setTag('array');
	expect(toJson(node)).toEqual([]);
});

test.run();
