import assert from "node:assert/strict";
import {suite, test} from "node:test";

import {
	deserialize,
	firstMatchingDeserializer,
	repeat,
} from "../../src/dessert.js";
import {Entry, Node, parse} from "../../src/index.js";

/** @import {Deserializer, DeserializerFromContext, DeserializationContext} from "../../src/dessert.js" */
/** @import {JsonValue} from "../../src/json.js" */

suite("dessert/deserialize", () => {
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

		{
			/** @type {number[]} */
			const actual = deserialize(node, (ctx) => ctx.argument.rest("number"));

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
						node type=json {
							prop value=1
							other 1 2 3
						}
					`,
				),
				(ctx) =>
					ctx.children("node", function deserializer(ctx) {
						if (
							ctx.property("type", "string") ??
							ctx.child("type", (c) => c.argument.required("string")) === "json"
						) {
							return ctx.json.required();
						} else {
							throw new Error("Unsupported type");
						}
					}),
			),
			[
				{prop: "value"},
				{prop: "value"},
				{prop: "value"},
				0,
				[0, 1, 2],
				{prop: {value: 1}, other: [1, 2, 3]},
			],
		);

		/** @param {DeserializationContext} ctx */
		function asNumberOrString(ctx) {
			return ctx.children.required("node", (c) => c.json("number", "string"));
		}

		/** @param {DeserializationContext} ctx */
		function asObject(ctx) {
			return ctx.children.required("node", (c) => c.json("object"));
		}

		/** @param {DeserializationContext} ctx */
		function asArray(ctx) {
			return ctx.children.required("node", (c) => c.json("array"));
		}

		assert.deepEqual(deserialize(parse('node 2; node "2"'), asNumberOrString), [
			2,
			"2",
		]);

		assert.throws(
			() => deserialize(parse("(object)node 2"), asNumberOrString),
			/Cannot deserialize a node tagged with object into a number or string/,
		);

		assert.throws(
			() => deserialize(parse("(array)node 2"), asNumberOrString),
			/Cannot deserialize a node tagged with array into a number or string/,
		);

		assert.throws(
			() => deserialize(parse("node prop=2"), asNumberOrString),
			/Encountered a JSON object but expected a number or string/,
		);

		assert.throws(
			() => deserialize(parse("node 2 3"), asNumberOrString),
			/Encountered a JSON array but expected a number or string/,
		);

		assert.throws(
			() => deserialize(parse("node prop=2 3"), asObject),
			/A JSON object cannot have arguments/,
		);

		assert.throws(
			() => deserialize(parse("node prop=2 3"), asArray),
			/A JSON array cannot have properties/,
		);

		assert.throws(
			() => deserialize(parse("node prop=2 { prop 3 }"), asObject),
			/Duplicate key "prop" in JSON object/,
		);

		assert.throws(
			() => deserialize(parse("node { node }"), asObject),
			/No value found in node/,
		);
	});

	test("tagged", () => {
		const node = parse(
			`node (u8)0 (u16)1 2 lorem=(bool)#true ipsum=(date)"2025-11-28" dolor=#false`,
			{as: "node"},
		);

		{
			const [args, props] = deserialize(node, (ctx) => [
				ctx.argument.rest(),
				ctx.property.rest(),
			]);

			assert.deepEqual(args, [0, 1, 2]);
			assert.deepEqual(
				props,
				new Map(
					/** @type {[string, JsonValue][]} */ ([
						["lorem", true],
						["ipsum", "2025-11-28"],
						["dolor", false],
					]),
				),
			);
		}

		{
			const [args, props] = deserialize(node, (ctx) => [
				ctx.tagged.argument.rest("number"),
				ctx.tagged.property.rest(),
			]);

			assert.deepEqual(args, [
				[0, "u8"],
				[1, "u16"],
				[2, null],
			]);
			assert.deepEqual(
				props,
				new Map(
					/** @type {[string, [JsonValue, string | null]][]} */ ([
						["lorem", [true, "bool"]],
						["ipsum", ["2025-11-28", "date"]],
						["dolor", [false, null]],
					]),
				),
			);
		}
	});

	test("pattern", () => {
		const node = parse(`node "2026-08-10T22:40:03Z"`, {as: "node"});

		assert.equal(
			deserialize(node, (c) =>
				c.argument.required.pattern(/^\d{4}-\d{2}-\d{2}T/),
			),
			"2026-08-10T22:40:03Z",
		);

		assert.equal(
			deserialize(node, (c) =>
				c.argument.required.pattern(/lorem/, /ipsum/, /^\d{4}-\d{2}-\d{2}T/),
			),
			"2026-08-10T22:40:03Z",
		);

		assert.throws(
			() => deserialize(node, (c) => c.argument.required.pattern(/lorem/)),
			/Expected a string matching \/lorem\//,
		);

		assert.throws(
			() =>
				deserialize(node, (c) => c.argument.required.pattern(/lorem/, /ipsum/)),
			/Expected a string matching \/lorem\/ or \/ipsum\//,
		);

		assert.throws(
			() =>
				deserialize(node, (c) =>
					c.argument.required.pattern(/lorem/, /ipsum/, /dolor/),
				),
			/Expected a string matching \/lorem\/, \/ipsum\/, or \/dolor\//,
		);
	});

	test("errors", () => {
		assert.throws(
			() => deserialize(parse("node a b", {as: "node"}), (c) => c.argument()),
			/Found 1 superfluous argument/,
		);
		assert.throws(
			() =>
				deserialize(parse("node a b=#true", {as: "node"}), (c) => c.argument()),
			/Found superfluous properties "b"/,
		);
		assert.throws(
			() =>
				deserialize(parse("node a b=#true c=0", {as: "node"}), (c) =>
					c.argument(),
				),
			/Found superfluous properties "b" and "c"/,
		);
		assert.throws(
			() =>
				deserialize(parse("node 0 { a 1; b #true; c 0; }", {as: "node"}), (c) =>
					c.argument(),
				),
			/Found 3 superfluous children \("a", "b", and "c"\)/,
		);
	});

	test("repeat", () => {
		assert.equal(
			repeat(() => undefined),
			undefined,
		);

		const value = [1, 2, 3];
		let i = 0;
		assert.deepEqual(
			repeat(() => value[i++]),
			[1, 2, 3],
		);

		i = 3;
		assert.deepEqual(
			repeat(() => value[--i]),
			[3, 2, 1],
		);

		/** @param {number} arg */
		let returnArg = (arg) => arg;
		assert.deepEqual(repeat.times(3, returnArg), [0, 1, 2]);
		assert.deepEqual(repeat.times(2, returnArg), [0, 1]);
	});

	test("firstMatchingDeserializer using context", () => {
		const deserializer = firstMatchingDeserializer(
			/** @param {DeserializationContext} c */ (c) =>
				c.argument.required.enum(0, 1, 2),
			/** @param {DeserializationContext} c */ (c) =>
				c.argument.required.enum("lorem", "ipsum", "dolor"),
		);

		const node = Node.create("test");
		const argument = Entry.createArgument(1);
		node.entries.push(argument);

		assert.equal(deserialize(node, deserializer), 1);

		argument.setValue("dolor");
		assert.equal(deserialize(node, deserializer), "dolor");

		argument.setValue("sit");
		assert.throws(
			() => deserialize(node, deserializer),
			/Failed to deserialize using any of the provided deserialiers/,
		);
	});

	test("firstMatchingDeserializer using node", () => {
		const deserializer = firstMatchingDeserializer(
			/** @type {Deserializer<number>} */ ({
				deserializeFromNode(node) {
					if (node.getArgument(0) === true) {
						throw new Error("first failed");
					}

					return 1;
				},
			}),
			/** @type {Deserializer<number>} */ ({
				deserializeFromNode(node) {
					if (node.getArgument(1) === true) {
						throw new Error("second failed");
					}

					return 2;
				},
			}),
		);

		const node = Node.create("test");
		const one = Entry.createArgument(false);
		const two = Entry.createArgument(false);
		node.entries.push(one, two);

		assert.equal(deserialize(node, deserializer), 1);

		one.setValue(true);
		assert.equal(deserialize(node, deserializer), 2);

		two.setValue(true);
		assert.throws(
			() => deserialize(node, deserializer),
			/Failed to deserialize using any of the provided deserialiers/,
		);
	});
});
