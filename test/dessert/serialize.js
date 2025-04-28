import assert from "node:assert/strict";
import {test} from "uvu";

import {concat, deserialize, serialize} from "../../src/dessert.js";
import {clearFormat, format, parse} from "../../src/index.js";

/** @import {DeserializationContext, SerializationContext} from "../../src/dessert.js"; */
/** @import {JsonValue} from "../../src/json.js"; */

test("simple", () => {
	const node = clearFormat(parse("node 0 1 2", {as: "node"}));

	assert.deepEqual(
		serialize("node", (ctx) => {
			ctx.argument(0);
			ctx.argument(1);
			ctx.argument(2);
		}),
		node,
	);

	assert.deepEqual(
		serialize(
			"node",
			(ctx, arr) => {
				for (const i of arr) {
					ctx.argument(i);
				}
			},
			[0, 1, 2],
		),
		node,
	);
});

test("json", () => {
	/**
	 * @param {SerializationContext} ctx
	 * @param {JsonValue} value
	 */
	function serializeJson(ctx, value) {
		ctx.property("type", "json");
		ctx.json(value);
	}

	assert.equal(
		format(
			concat(
				...[{prop: "value"}, 0, [0, 1, 2]].map((value) =>
					serialize("node", serializeJson, value),
				),
			),
		),
		`node type=json prop=value
node type=json 0
node type=json 0 1 2
`,
	);
});

test("order of properties", () => {
	class Test {
		/** @type {DeserializationContext} */
		#ctx;

		first;
		second;

		/**
		 * @param {string} first
		 * @param {string} second
		 */
		constructor(first, second) {
			this.first = first;
			this.second = second;
		}

		/** @param {DeserializationContext} ctx */
		static deserialize(ctx) {
			const value = new Test(
				ctx.property.required("first", "string"),
				ctx.property.required("second", "string"),
			);
			value.#ctx = ctx;
			return value;
		}

		/** @param {SerializationContext} ctx */
		serialize(ctx) {
			ctx.source(this.#ctx);

			ctx.property("first", this.first);
			ctx.property("second", this.second);
		}
	}

	let node = parse(`node first=first second=second;`, {as: "node"});
	let test = deserialize(node, Test);

	test.second = "first";
	test.first = "second";

	assert.equal(
		format(serialize("node", test)),
		"node first=second second=first;",
	);

	node = parse(`node second=second first=first;`, {as: "node"});
	test = deserialize(node, Test);

	test.second = "first";
	test.first = "second";

	assert.equal(
		format(serialize("node", test)),
		"node second=first first=second;",
	);
});

test.run();
