import assert from "node:assert/strict";
import {test} from "uvu";

import {deserialize} from "../../src/dessert.js";
import {parse} from "../../src/index.js";

/** @import {DeserializeContext} from "../../src/dessert.js" */

const node = parse(
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
);

test("function", () => {
	/**
	 * @typedef {object} Tree
	 * @prop {number} value
	 * @prop {Tree=} left
	 * @prop {Tree=} right
	 */

	/**
	 * @param {DeserializeContext} ctx
	 * @returns {Tree}
	 */
	function treeDeserializer(ctx) {
		return {
			value: ctx.argument.required("number"),
			left: ctx.child.single("left", treeDeserializer),
			right: ctx.child.single("right", treeDeserializer),
		};
	}

	assert.deepEqual(deserialize(node, treeDeserializer), {
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
	});
});

test("class", () => {
	class Tree {
		/**
		 * @param {DeserializeContext} ctx
		 * @returns {Tree}
		 */
		static deserialize(ctx) {
			return new Tree(
				ctx.argument.required("number"),
				ctx.child.single("left", Tree),
				ctx.child.single("right", Tree),
			);
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

	assert.deepEqual(
		deserialize(node, Tree),
		new Tree(
			10,
			new Tree(5, new Tree(3), new Tree(2)),
			new Tree(
				5,
				new Tree(1),
				new Tree(4, new Tree(1), new Tree(3, new Tree(2), new Tree(1))),
			),
		),
	);
});

test.run();
