import assert from "node:assert/strict";
import {test} from "uvu";

import {Value} from "../src/model.js";
import {
	Accessor,
	Comparison,
	Filter,
	InvalidKdlQueryError,
	Matcher,
	Query,
	Selector,
	parse,
} from "../src/query.js";

test("valid queries", () => {
	assert.deepEqual(
		parse("[]"),
		new Query([new Selector([[">>", new Filter([Matcher.always()])]])]),
	);

	assert.deepEqual(
		parse("a[prop] > b[val(1) > 2] || c"),
		new Query([
			new Selector([
				[
					">>",
					new Filter([
						Matcher.nodeName("a"),
						Matcher.accessor(Accessor.property("prop"), null),
					]),
				],
				[
					">",
					new Filter([
						Matcher.nodeName("b"),
						Matcher.accessor(
							Accessor.argument(1),
							Comparison.create(">", new Value(2)),
						),
					]),
				],
			]),
			new Selector([[">>", new Filter([Matcher.nodeName("c")])]]),
		]),
	);
});

test("invalid queries", () => {
	assert.throws(
		() => parse("[not= valid]"),
		/InvalidKdlQueryError: Missing whitespace before comparison operator at 1:5/,
	);

	assert.throws(
		() => parse("[not =valid]"),
		/InvalidKdlQueryError: Missing whitespace after comparison operator at 1:7/,
	);
});

test.run();
