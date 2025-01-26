import assert from "node:assert/strict";
import {test} from "uvu";

import {clearFormat, parse} from "../src/index.js";
import {parseAndTransform} from "../src/v1-compat.js";

/** @type {{name: string; v1: string; v2: string}[]} */
const tests = [
	{
		name: "old keywords",
		v1: String.raw`
			node true /- false null
		`,
		v2: String.raw`
			node #true /- #false #null
		`,
	},
	{
		name: "new keywords",
		v1: String.raw`
			inf
			nan
			node inf=0 nan=0
		`,
		v2: String.raw`
			"inf"
			"nan"
			node "inf"=0 "nan"=0
		`,
	},
	{
		name: "single-line strings",
		v1: String.raw`
			node "test" r"test" r#"test"#
		`,
		v2: String.raw`
			node "test" #"test"# #"test"#
		`,
	},
	{
		name: "multiline-line strings",
		v1: String.raw`
node "test
lines" r"test
lines" r#"test
	lines"#
		`,
		v2: String.raw`
node """
test
lines
""" #"""
test
lines
"""# #"""
test
	lines
"""#
		`,
	},
];

for (const {name, v1, v2} of tests) {
	test(name, () => {
		assert.deepEqual(parseAndTransform(v1), parse(v2));
	});
}

test.run();
