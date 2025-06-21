import assert from "node:assert/strict";
import {test} from "uvu";

import {deserialize, firstMatchingDeserializer} from "../../src/dessert.js";
import {parse} from "../../src/index.js";

/** @import {Deserializer, DeserializerFromContext, DeserializationContext} from "../../src/dessert.js" */

test("simple", () => {
	const node = parse("node 0 1 2", {as: "node"});

	assert.deepEqual(
		deserialize(node, (ctx) => [
			ctx.argument(),
			ctx.argument(),
			ctx.argument(),
		]),
		[0, 1, 2],
	);

	assert.deepEqual(
		deserialize(node, (ctx) => ctx.argument.rest()),
		[0, 1, 2],
	);
});

test("types", () => {
	const node = parse("node 0 1 2", {as: "node"});

	{
		/** @type {[number | undefined, number | undefined, number | undefined]} */
		const actual = deserialize(node, (ctx) => [
			ctx.argument("number"),
			ctx.argument("number"),
			ctx.argument("number"),
		]);

		assert.deepEqual(actual, [0, 1, 2]);
	}

	{
		/** @type {[number, number, number]} */
		const actual = deserialize(node, (ctx) => [
			ctx.argument.required("number"),
			ctx.argument.required("number"),
			ctx.argument.required("number"),
		]);

		assert.deepEqual(actual, [0, 1, 2]);
	}
});

test("class", () => {
	class Tree {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Tree}
		 */
		static deserialize(ctx) {
			const value = ctx.argument.required("number");

			const left = ctx.child("left", Tree);
			const right = ctx.child("right", Tree);

			return new Tree(value, left, right);
		}

		/**
		 * @param {number} value
		 * @param {Tree=} left
		 * @param {Tree=} right
		 */
		constructor(value, left, right) {
			this.value = value;
			this.left = left;
			this.right = right;
		}
	}

	const node = parse(
		String.raw`
			root 10 {
				left 4 {
					left 2
					right 6 {
						left 5
						right 9
					}
				}
				right 20
			}
		`,
		{as: "node"},
	);

	/** @type {Tree} */
	const root = deserialize(node, Tree);

	assert.deepEqual(
		root,
		new Tree(
			10,
			new Tree(4, new Tree(2), new Tree(6, new Tree(5), new Tree(9))),
			new Tree(20),
		),
	);
});

test("fallback", () => {
	/** @type {Deserializer<number>} */
	const leaf = (ctx) => ctx.argument.required("number");

	class Node {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Node}
		 */
		static deserialize(ctx) {
			return new Node(
				ctx.child.required("left", tree),
				ctx.child.required("right", tree),
			);
		}

		/**
		 * @param {number | Node} left
		 * @param {number | Node} right
		 */
		constructor(left, right) {
			this.left = left;
			this.right = right;
		}
	}

	// type annotation is there to verify the return type,
	// typescript is more than capable of inferring it without our help
	/** @type {DeserializerFromContext<number | Node>} */
	const tree = firstMatchingDeserializer(leaf, Node);

	const node = parse(
		String.raw`
			root {
				left {
					left 0
					right {
						left 1
						right {
							left 2
							right 3
						}
					}
				}
				right 5
			}
		`,
		{as: "node"},
	);

	assert.deepEqual(
		deserialize(node, tree),
		new Node(new Node(0, new Node(1, new Node(2, 3))), 5),
	);
});

test("json", () => {
	/** @param {DeserializationContext} ctx */
	function deserializer(ctx) {
		if (
			ctx.property("type", "string") ??
			ctx.child("type", (c) => c.argument.required("string")) === "json"
		) {
			return ctx.json.required();
		} else {
			throw new Error("Unsupported type");
		}
	}

	assert.deepEqual(
		deserialize(
			parse(
				`
					node {
						type json
						prop value
					}
					node type=json prop=value
					node prop=value type=json
					node 0 type=json
					node type=json 0 1 2
				`,
			),
			(ctx) => ctx.children("node", deserializer),
		),
		[{prop: "value"}, {prop: "value"}, {prop: "value"}, 0, [0, 1, 2]],
	);
});

test.run();
