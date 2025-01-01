import assert from "node:assert/strict";
import {test} from "uvu";

import {deserialize, serialize} from "../../src/dessert.js";
import {clearFormat, format, parse} from "../../src/index.js";

/** @import {DeserializationContext, SerializationContext} from "../../src/dessert.js" */

const node = clearFormat(
	parse(
		String.raw`
		root 10 {
			left 5 {
				left 3
				right 2
			}
			right 5 {
				left 1
				right 4 {
					left 1
					right 3 {
						left 2
						right 1
					}
				}
			}
		}
	`,
		{as: "node"},
	),
);

test("function", () => {
	/**
	 * @typedef {object} Tree
	 * @prop {number} value
	 * @prop {Tree=} left
	 * @prop {Tree=} right
	 */

	/**
	 * @param {DeserializationContext} ctx
	 * @returns {Tree}
	 */
	function treeDeserializer(ctx) {
		return {
			value: ctx.argument.required("number"),
			left: ctx.child.single("left", treeDeserializer),
			right: ctx.child.single("right", treeDeserializer),
		};
	}

	/**
	 * @param {SerializationContext} ctx
	 * @param {Tree} tree
	 */
	function treeSerializer(ctx, tree) {
		ctx.argument(tree.value);

		if (tree.left) {
			ctx.child("left", treeSerializer, tree.left);
		}
		if (tree.right) {
			ctx.child("right", treeSerializer, tree.right);
		}
	}

	const value = {
		value: 10,
		left: {
			value: 5,
			left: {value: 3, left: undefined, right: undefined},
			right: {value: 2, left: undefined, right: undefined},
		},
		right: {
			value: 5,
			left: {value: 1, left: undefined, right: undefined},
			right: {
				value: 4,
				left: {value: 1, left: undefined, right: undefined},
				right: {
					value: 3,
					left: {value: 2, left: undefined, right: undefined},
					right: {value: 1, left: undefined, right: undefined},
				},
			},
		},
	};

	assert.deepEqual(deserialize(node, treeDeserializer), value);
	assert.deepEqual(serialize("root", treeSerializer, value), node);
});

test("class", () => {
	class Tree {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Tree}
		 */
		static deserialize(ctx) {
			const tree = new Tree(
				ctx.argument.required("number"),
				ctx.child.single("left", Tree),
				ctx.child.single("right", Tree),
			);
			tree.#deserializationCtx = ctx;
			return tree;
		}

		/** @type {DeserializationContext=} */
		#deserializationCtx;

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

		increment() {
			this.value++;
		}

		/** @param {SerializationContext} ctx */
		serialize(ctx) {
			ctx.source(this.#deserializationCtx);
			ctx.argument(this.value);

			if (this.left) {
				ctx.child("left", this.left);
			}
			if (this.right) {
				ctx.child("right", this.right);
			}
		}
	}

	const value = new Tree(
		10,
		new Tree(5, new Tree(3), new Tree(2)),
		new Tree(
			5,
			new Tree(1),
			new Tree(4, new Tree(1), new Tree(3, new Tree(2), new Tree(1))),
		),
	);

	assert.deepEqual(deserialize(node, Tree), value);
	assert.deepEqual(serialize("root", value), node);

	const nodeBeforeModification = parse(
		`
			root 10 {
				left 5 { /- left 0; right 5 }
				right 5 { left 1; right 4 }
			}
		`,
		{as: "node"},
	);

	const treeToModify = deserialize(nodeBeforeModification, Tree);

	// Should be ! but ! is so much harder to write in JSDoc mode than ? ...
	treeToModify.right?.left?.increment();
	treeToModify.right?.increment();
	treeToModify.increment();

	const nodeAfterModification = serialize("root", treeToModify);

	assert.equal(
		format(nodeAfterModification),
		`
			root 11 {
				left 5 { /- left 0; right 5 }
				right 6 { left 2; right 4 }
			}
		`,
	);
});

test.run();
