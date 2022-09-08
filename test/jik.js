import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {expect} from 'expect';
import {test} from 'uvu';

import {parse as parseKdl, clearFormat, format} from '../src/index.js';
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

	expect(format(fromJson(value))).toEqual(
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

	expect(format(fromJson(value, {allowEntries: false}))).toEqual(
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

	expect(format(fromJson(value, {allowEntriesInArrays: false}))).toEqual(
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

	expect(format(fromJson(value, {allowEntriesInObjects: false}))).toEqual(
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

	expect(format(fromJson(value, {allowEntriesInRoot: false}))).toEqual(
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

test.run();
