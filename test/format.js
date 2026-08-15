import assert from "node:assert/strict";
import {suite, test} from "node:test";

import {
	Document,
	Entry,
	Identifier,
	Node,
	format,
	Value,
	clearFormat,
} from "../src/index.js";

suite("format", () => {
	test("format document", () => {
		assert.equal(
			format(
				new Document([
					new Node(
						new Identifier("node"),
						[
							new Entry(new Value("value"), null),
							new Entry(new Value(2), null),
							new Entry(new Value(null), null),
							new Entry(new Value(true), null),
							new Entry(new Value(false), null),
						],
						new Document([
							new Node(new Identifier("child")),
							new Node(new Identifier("child too")),
						]),
					),
				]),
			),
			`node value 2 #null #true #false {
	child
	"child too"
}
`,
		);
	});

	test("clearFormat fails on non-KDL values", () => {
		assert.throws(() => {
			// @ts-expect-error types don't allow invalid values
			clearFormat(/not a kdl object/);
		});
	});
});
