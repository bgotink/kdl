import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {expect} from 'expect';
import {test} from 'uvu';

import {
	parse as parseKdl,
	clearFormat,
	Entry,
	format,
	Node,
} from '../src/index.js';
import {fromJson, parse, stringify, toJson} from '../src/json.js';

const testCasesFolder = new URL('jik/', import.meta.url);

for (const testCase of readdirSync(new URL('kdl', testCasesFolder))) {
	test(testCase, () => {
		const text = readFileSync(
			new URL(`kdl/${testCase}`, testCasesFolder),
			'utf8',
		);
		const input = parseKdl(text);

		const expectedOutputFile = new URL(
			`json/${testCase.replace(/\.kdl$/, '.json')}`,
			testCasesFolder,
		);

		if (!existsSync(expectedOutputFile)) {
			expect(() => toJson(input)).toThrow();
			expect(() => parse(text)).toThrow();

			return;
		}

		const expectedOutput = readFileSync(expectedOutputFile, 'utf8').trim();
		const outputJson = JSON.parse(expectedOutput);

		expect(JSON.stringify(toJson(input), null, 2)).toBe(expectedOutput);
		expect(JSON.stringify(parse(text), null, 2)).toBe(expectedOutput);

		expect(toJson(fromJson(outputJson))).toEqual(outputJson);
		expect(parse(stringify(outputJson))).toEqual(outputJson);
	});
}

test('toJson options', () => {
	expect(toJson(parseKdl('- 0'))).toBe(0);
	expect(toJson(parseKdl('- 0'), {type: 'array'})).toEqual([0]);

	expect(toJson(parseKdl('- { - 0; }'))).toEqual([0]);
	expect(toJson(parseKdl('- { - 0; }'), {type: 'object'})).toEqual({'-': 0});

	expect(() => toJson(parseKdl('-'))).toThrow();
	expect(toJson(parseKdl('-'), {type: 'array'})).toEqual([]);
	expect(toJson(parseKdl('-'), {type: 'object'})).toEqual({});

	const document = parseKdl(String.raw`
		book "The Fellowship of the Ring" {
			author "J.R.R. Tolkien"
			publicationYear 1954
		}

		book "Dune" publicationYear=1965 {
			author "Frank Herbert"
		}
	`);
	expect(
		Object.fromEntries(
			document
				.findNodesByName('book')
				.map(node => [node.getArgument(0), toJson(node, {ignoreValues: true})]),
		),
	).toEqual({
		'The Fellowship of the Ring': {
			author: 'J.R.R. Tolkien',
			publicationYear: 1954,
		},
		Dune: {
			publicationYear: 1965,
			author: 'Frank Herbert',
		},
	});
});

test('fromJson options', () => {
	const value = {
		prop1: false,
		objectProp: {prop: true},
		prop2: false,
		arrayProp: [0, 1, [2, 3], 4, 5],
	};

	expect(format(clearFormat(fromJson(value)))).toEqual(
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- prop1=false prop2=false {
							objectProp prop=true
							arrayProp 0 1 {
								- 2 3
								- 4
								- 5
							}
						}
					`,
				),
			),
		),
	);

	expect(format(fromJson(value))).toEqual(
		format(
			parseKdl(
				`- prop1=false prop2=false {objectProp prop=true;arrayProp 0 1 {- 2 3;- 4;- 5;};}`,
			),
		),
	);

	expect(format(fromJson(value, {indentation: 1}))).toEqual(
		format(
			parseKdl(
				`- prop1=false prop2=false {\n objectProp prop=true\n arrayProp 0 1 {\n  - 2 3\n  - 4\n  - 5\n }\n}`,
			),
		),
	);

	expect(format(fromJson(value, {indentation: '\t'}))).toEqual(
		format(
			parseKdl(
				`- prop1=false prop2=false {\n\tobjectProp prop=true\n\tarrayProp 0 1 {\n\t\t- 2 3\n\t\t- 4\n\t\t- 5\n\t}\n}`,
			),
		),
	);

	expect(format(clearFormat(fromJson(value, {allowEntries: false})))).toEqual(
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 false
							objectProp {
								prop true
							}
							prop2 false
							arrayProp {
								- 0
								- 1
								- {
									- 2
									- 3
								}
								- 4
								- 5
							}
						}
					`,
				),
			),
		),
	);

	expect(
		format(clearFormat(fromJson(value, {allowEntriesInArrays: false}))),
	).toEqual(
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- prop1=false prop2=false {
							objectProp prop=true
							arrayProp {
								- 0
								- 1
								- {
									- 2
									- 3
								}
								- 4
								- 5
							}
						}
					`,
				),
			),
		),
	);

	expect(
		format(clearFormat(fromJson(value, {allowEntriesInObjects: false}))),
	).toEqual(
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 false
							objectProp {
								prop true
							}
							prop2 false
							arrayProp 0 1 {
								- 2 3
								- 4
								- 5
							}
						}
					`,
				),
			),
		),
	);

	expect(
		format(clearFormat(fromJson(value, {allowEntriesInRoot: false}))),
	).toEqual(
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 false
							objectProp prop=true
							prop2 false
							arrayProp 0 1 {
								- 2 3
								- 4
								- 5
							}
						}
					`,
				),
			),
		),
	);
});

test('parse reviver', () => {
	const text = String.raw`
		- 0 "string" (date)"2022-09-09T10:23:23.445Z"
	`;

	expect(parse(text, value => value)).toEqual([
		0,
		'string',
		'2022-09-09T10:23:23.445Z',
	]);

	/** @type {[unknown, string | number][]}*/
	const reviverCalls = [];

	expect(
		parse(text, (value, key, {location}) => {
			reviverCalls.push([value, key]);
			return location.getTag() === 'date' ? new Date(String(value)) : value;
		}),
	).toEqual([0, 'string', new Date('2022-09-09T10:23:23.445Z')]);

	expect(reviverCalls).toEqual([
		[0, 0],
		['string', 1],
		['2022-09-09T10:23:23.445Z', 2],
		[[0, 'string', new Date('2022-09-09T10:23:23.445Z')], ''],
	]);
});

test('stringify supports toJSON methods', () => {
	expect(stringify(new Date('2022-09-09T10:23:23.445Z'))).toBe(
		'- "2022-09-09T10:23:23.445Z"',
	);

	expect(
		stringify({
			toJSON: () => ['an', 'array'],
		}),
	).toBe('- "an" "array"');
});

test('stringify supports replacers', () => {
	expect(
		stringify(
			new Date('2022-09-09T10:23:23.445Z'),
			(_key, _value, originalValue) =>
				/** @type {Date} */ (originalValue).valueOf(),
		),
	).toBe('- 1662719003445');

	expect(
		stringify(new Date('2022-09-09T10:23:23.445Z'), {
			replaceJsonValue: (_key, _value, originalValue) =>
				/** @type {Date} */ (originalValue).valueOf(),
		}),
	).toBe('- 1662719003445');

	expect(
		stringify(new Date('2022-09-09T10:23:23.445Z'), {
			replaceJsonValue: (_key, _jsonValue, originalJsonValue) =>
				/** @type {Date} */ (originalJsonValue).valueOf(),
			replaceKdlValue: (_key, value, _jsonValue, originalJsonValue) => {
				if (originalJsonValue instanceof Date) {
					value.setTag('date');
				}

				return value;
			},
		}),
	).toBe('(date)- 1662719003445');

	// turn entries into nodes, because why not?
	expect(
		stringify([true, 0, false, null, {prop: 0, other: 2}], {
			replaceKdlValue: (_key, value) => {
				if (value.type !== 'entry') {
					return value;
				}

				const node = value.name ? new Node(value.name) : Node.create('-');
				node.entries.push(new Entry(value.value, null));
				return node;
			},
		}),
	).toBe('- {- true;- 0;- false;- null;- {prop 0;other 2;};}');

	// Add indentation
	expect(
		stringify([true, 0, false, null, {prop: 0, other: 2}], {
			indentation: 2,
			replaceKdlValue: (_key, value) => {
				if (value.type !== 'entry') {
					return value;
				}

				const node = value.name ? new Node(value.name) : Node.create('-');
				node.entries.push(new Entry(value.value, null));
				return node;
			},
		}),
	).toBe(
		'- {\n  - true\n  - 0\n  - false\n  - null\n  - {\n    prop 0\n    other 2\n  }\n}',
	);
});

test.run();
