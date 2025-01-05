import assert from "node:assert/strict";
import {test} from "uvu";

import {concat, serialize} from "../../src/dessert.js";
import {clearFormat, format, parse} from "../../src/index.js";

/** @import {SerializationContext} from "../../src/dessert.js"; */
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

test.run();
