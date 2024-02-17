import assert from "node:assert/strict";
import {readFileSync, readdirSync, existsSync} from "node:fs";
import {test} from "uvu";

import {
	parse as parseKdl,
	clearFormat,
	Entry,
	format,
	Node,
} from "../src/index.js";
import {fromJson, parse, stringify, toJson} from "../src/json.js";

const testCasesFolder = new URL("jik/", import.meta.url);

for (const testCase of readdirSync(new URL("kdl", testCasesFolder))) {
	test(testCase, () => {
		const text = readFileSync(
			new URL(`kdl/${testCase}`, testCasesFolder),
			"utf8",
		);
		const input = parseKdl(text);

		const expectedOutputFile = new URL(
			`json/${testCase.replace(/\.kdl$/, ".json")}`,
			testCasesFolder,
		);

		if (!existsSync(expectedOutputFile)) {
			assert.throws(() => toJson(input));
			assert.throws(() => parse(text));

			return;
		}

		const expectedOutput = readFileSync(expectedOutputFile, "utf8").trim();
		const outputJson = JSON.parse(expectedOutput);

		assert.equal(JSON.stringify(toJson(input), null, "\t"), expectedOutput);
		assert.equal(JSON.stringify(parse(text), null, "\t"), expectedOutput);

		assert.deepEqual(toJson(fromJson(outputJson)), outputJson);
		assert.deepEqual(parse(stringify(outputJson)), outputJson);
	});
}

test("toJson options", () => {
	assert.equal(toJson(parseKdl("- 0")), 0);
	assert.deepEqual(toJson(parseKdl("- 0"), {type: "array"}), [0]);

	assert.deepEqual(toJson(parseKdl("- { - 0; }")), [0]);
	assert.deepEqual(toJson(parseKdl("- { - 0; }"), {type: "object"}), {"-": 0});

	assert.throws(() => toJson(parseKdl("-")));
	assert.deepEqual(toJson(parseKdl("-"), {type: "array"}), []);
	assert.deepEqual(toJson(parseKdl("-"), {type: "object"}), {});

	const document = parseKdl(String.raw`
		book "The Fellowship of the Ring" {
			author "J.R.R. Tolkien"
			publicationYear 1954
		}

		book "Dune" publicationYear=1965 {
			author "Frank Herbert"
		}
	`);
	assert.deepEqual(
		Object.fromEntries(
			document
				.findNodesByName("book")
				.map((node) => [
					node.getArgument(0),
					toJson(node, {ignoreValues: true}),
				]),
		),
		{
			"The Fellowship of the Ring": {
				author: "J.R.R. Tolkien",
				publicationYear: 1954,
			},
			Dune: {
				publicationYear: 1965,
				author: "Frank Herbert",
			},
		},
	);
});

test("fromJson options", () => {
	const value = {
		prop1: false,
		objectProp: {prop: true},
		prop2: false,
		arrayProp: [0, 1, [2, 3], 4, 5],
	};

	assert.equal(
		format(clearFormat(fromJson(value))),
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- prop1=#false prop2=#false {
							objectProp prop=#true
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

	assert.equal(
		format(fromJson(value)),
		format(
			parseKdl(
				`- prop1=#false prop2=#false {objectProp prop=#true;arrayProp 0 1 {- 2 3;- 4;- 5;};}`,
			),
		),
	);

	assert.equal(
		format(fromJson(value, {indentation: 1})),
		format(
			parseKdl(
				`- prop1=#false prop2=#false {\n objectProp prop=#true\n arrayProp 0 1 {\n  - 2 3\n  - 4\n  - 5\n }\n}`,
			),
		),
	);

	assert.equal(
		format(fromJson(value, {indentation: "\t"})),
		format(
			parseKdl(
				`- prop1=#false prop2=#false {\n\tobjectProp prop=#true\n\tarrayProp 0 1 {\n\t\t- 2 3\n\t\t- 4\n\t\t- 5\n\t}\n}`,
			),
		),
	);

	assert.equal(
		format(clearFormat(fromJson(value, {allowEntries: false}))),
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 #false
							objectProp {
								prop #true
							}
							prop2 #false
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

	assert.equal(
		format(clearFormat(fromJson(value, {allowEntriesInArrays: false}))),
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- prop1=#false prop2=#false {
							objectProp prop=#true
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

	assert.equal(
		format(clearFormat(fromJson(value, {allowEntriesInObjects: false}))),
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 #false
							objectProp {
								prop #true
							}
							prop2 #false
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

	assert.equal(
		format(clearFormat(fromJson(value, {allowEntriesInRoot: false}))),
		format(
			clearFormat(
				parseKdl(
					String.raw`
						- {
							prop1 #false
							objectProp prop=#true
							prop2 #false
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

test("parse reviver", () => {
	const text = String.raw`
		- 0 "string" (date)"2022-09-09T10:23:23.445Z"
	`;

	assert.deepEqual(
		parse(text, (value) => value),
		[0, "string", "2022-09-09T10:23:23.445Z"],
	);

	/** @type {[unknown, string | number][]}*/
	const reviverCalls = [];

	assert.deepEqual(
		parse(text, (value, key, {location}) => {
			reviverCalls.push([value, key]);
			return location.getTag() === "date" ? new Date(String(value)) : value;
		}),
		[0, "string", new Date("2022-09-09T10:23:23.445Z")],
	);

	assert.deepEqual(reviverCalls, [
		[0, 0],
		["string", 1],
		["2022-09-09T10:23:23.445Z", 2],
		[[0, "string", new Date("2022-09-09T10:23:23.445Z")], ""],
	]);
});

test("stringify supports toJSON methods", () => {
	assert.equal(
		stringify(new Date("2022-09-09T10:23:23.445Z")),
		'- "2022-09-09T10:23:23.445Z"',
	);

	assert.equal(
		stringify({
			toJSON: () => ["an", "array"],
		}),
		"- an array",
	);
});

test("stringify supports replacers", () => {
	assert.equal(
		stringify(
			new Date("2022-09-09T10:23:23.445Z"),
			(_key, _value, originalValue) =>
				/** @type {Date} */ (originalValue).valueOf(),
		),
		"- 1662719003445",
	);

	assert.equal(
		stringify(new Date("2022-09-09T10:23:23.445Z"), {
			replaceJsonValue: (_key, _value, originalValue) =>
				/** @type {Date} */ (originalValue).valueOf(),
		}),
		"- 1662719003445",
	);

	assert.equal(
		stringify(new Date("2022-09-09T10:23:23.445Z"), {
			replaceJsonValue: (_key, _jsonValue, originalJsonValue) =>
				/** @type {Date} */ (originalJsonValue).valueOf(),
			replaceKdlValue: (_key, value, _jsonValue, originalJsonValue) => {
				if (originalJsonValue instanceof Date) {
					value.setTag("date");
				}

				return value;
			},
		}),
		"(date)- 1662719003445",
	);

	// turn entries into nodes, because why not?
	assert.equal(
		stringify([true, 0, false, null, {prop: 0, other: 2}], {
			replaceKdlValue: (_key, value) => {
				if (value.type !== "entry") {
					return value;
				}

				const node = value.name ? new Node(value.name) : Node.create("-");
				node.entries.push(new Entry(value.value, null));
				return node;
			},
		}),
		"- {- #true;- 0;- #false;- #null;- {prop 0;other 2;};}",
	);

	// Add indentation
	assert.equal(
		stringify([true, 0, false, null, {prop: 0, other: 2}], {
			indentation: 2,
			replaceKdlValue: (_key, value) => {
				if (value.type !== "entry") {
					return value;
				}

				const node = value.name ? new Node(value.name) : Node.create("-");
				node.entries.push(new Entry(value.value, null));
				return node;
			},
		}),
		"- {\n  - #true\n  - 0\n  - #false\n  - #null\n  - {\n    prop 0\n    other 2\n  }\n}",
	);
});

test.run();
