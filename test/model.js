import assert from "node:assert/strict";
import {suite, test} from "node:test";

import {
	parse,
	clearFormat,
	Entry,
	Node,
	Document,
	Tag,
	Value,
} from "../src/index.js";

/** @param {string} text */
function parseNode(text) {
	return clearFormat(parse(text, {as: "node"}));
}

suite("model", () => {
	suite("tag", () => {
		test("name", () => {
			const tag = new Tag("lorem");
			assert.equal(tag.getName(), "lorem");
			tag.setName("ipsum");
			assert.equal(tag.getName(), "ipsum");
		});
	});

	suite("value", () => {
		test("value", () => {
			const value = new Value(0);
			assert.equal(value.getValue(), 0);
			value.setValue("lorem");
			assert.equal(value.getValue(), "lorem");
		});

		test("tag", () => {
			const value = new Value(0);
			assert.equal(value.getTag(), null);
			value.setTag("lorem");
			assert.equal(value.getTag(), "lorem");
			value.setTag("ipsum");
			assert.equal(value.getTag(), "ipsum");
		});
	});

	suite("entry", () => {
		test("setName", () => {
			const entry = Entry.createArgument("lorem");

			assert.equal(entry.getName(), null);
			assert.ok(entry.isArgument());
			assert.ok(!entry.isProperty());

			entry.setName("ipsum");
			assert.equal(entry.getName(), "ipsum");
			assert.equal(entry.name?.getName(), "ipsum");
			assert.notEqual(entry.name, null);
			assert.ok(!entry.isArgument());
			assert.ok(entry.isProperty());
		});
	});

	suite("node", () => {
		test("clone", () => {
			const node = Node.create("lorem");

			assert.deepEqual(node.clone(), node);
			assert.deepEqual(node.clone(), parseNode("lorem"));

			node.setName("ipsum");
			assert.deepEqual(node.clone(), node);
			assert.deepEqual(node.clone(), parseNode("ipsum"));

			node.setTag("lorem");
			assert.deepEqual(node.clone(), node);
			assert.deepEqual(node.clone(), parseNode("(lorem)ipsum"));
		});

		test("arguments", () => {
			const node = Node.create("lorem");
			assert.ok(!node.hasArguments());
			assert.ok(!node.hasArgument(0));
			assert.equal(node.getArgument(0), undefined);
			assert.equal(node.getArgumentEntry(0), undefined);
			assert.ok(!node.hasArgument(1));
			assert.equal(node.getArgument(1), undefined);
			assert.equal(node.getArgumentEntry(1), undefined);
			assert.deepEqual(node.getArguments(), []);

			node.setProperty("ipsum", "dolor");
			assert.ok(!node.hasArguments());
			assert.ok(!node.hasArgument(0));
			assert.equal(node.getArgument(0), undefined);
			assert.equal(node.getArgumentEntry(0), undefined);
			assert.ok(!node.hasArgument(1));
			assert.equal(node.getArgument(1), undefined);
			assert.equal(node.getArgumentEntry(1), undefined);
			assert.deepEqual(node.getArguments(), []);

			node.addArgument("sit");
			assert.ok(node.hasArguments());
			assert.ok(node.hasArgument(0));
			assert.equal(node.getArgument(0), "sit");
			assert.deepEqual(node.getArgumentEntry(0), Entry.createArgument("sit"));
			assert.ok(!node.hasArgument(1));
			assert.equal(node.getArgument(1), undefined);
			assert.equal(node.getArgumentEntry(1), undefined);
			assert.deepEqual(node.getArguments(), ["sit"]);

			node.addArgument("amet", null, 0);
			assert.ok(node.hasArguments());
			assert.ok(node.hasArgument(0));
			assert.equal(node.getArgument(0), "amet");
			assert.deepEqual(node.getArgumentEntry(0), Entry.createArgument("amet"));
			assert.ok(node.hasArgument(1));
			assert.equal(node.getArgument(1), "sit");
			assert.deepEqual(node.getArgumentEntry(1), Entry.createArgument("sit"));
			assert.ok(!node.hasArgument(2));
			assert.deepEqual(node.getArguments(), ["amet", "sit"]);

			node.removeArgument(1);
			assert.ok(node.hasArguments());
			assert.ok(node.hasArgument(0));
			assert.equal(node.getArgument(0), "amet");
			assert.deepEqual(node.getArgumentEntry(0), Entry.createArgument("amet"));
			assert.ok(!node.hasArgument(1));
			assert.equal(node.getArgument(1), undefined);
			assert.equal(node.getArgumentEntry(1), undefined);
			assert.deepEqual(node.getArguments(), ["amet"]);
		});

		test("properties", () => {
			const node = Node.create("lorem");
			assert.ok(!node.hasProperties());
			assert.ok(!node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), undefined);
			assert.equal(node.getPropertyEntry("lorem"), undefined);
			assert.ok(!node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), undefined);
			assert.equal(node.getPropertyEntry("ipsum"), undefined);
			assert.deepEqual(node.getProperties(), new Map());
			assert.deepEqual(node.getPropertyEntryMap(), new Map());

			node.addArgument("sit");
			assert.ok(!node.hasProperties());
			assert.ok(!node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), undefined);
			assert.equal(node.getPropertyEntry("lorem"), undefined);
			assert.ok(!node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), undefined);
			assert.equal(node.getPropertyEntry("ipsum"), undefined);
			assert.deepEqual(node.getProperties(), new Map());
			assert.deepEqual(node.getPropertyEntryMap(), new Map());

			node.setProperty("lorem", "dolor");
			assert.ok(node.hasProperties());
			assert.ok(node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), "dolor");
			assert.deepEqual(
				node.getPropertyEntry("lorem"),
				Entry.createProperty("lorem", "dolor"),
			);
			assert.ok(!node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), undefined);
			assert.equal(node.getPropertyEntry("ipsum"), undefined);
			assert.deepEqual(node.getProperties(), new Map([["lorem", "dolor"]]));
			assert.deepEqual(
				node.getPropertyEntryMap(),
				new Map([["lorem", Entry.createProperty("lorem", "dolor")]]),
			);

			node.setProperty("ipsum", "sit");
			assert.equal(node.entries.length, 3);
			assert.ok(node.hasProperties());
			assert.ok(node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), "dolor");
			assert.deepEqual(
				node.getPropertyEntry("lorem"),
				Entry.createProperty("lorem", "dolor"),
			);
			assert.ok(node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), "sit");
			assert.deepEqual(
				node.getPropertyEntry("ipsum"),
				Entry.createProperty("ipsum", "sit"),
			);
			assert.deepEqual(
				node.getProperties(),
				new Map([
					["lorem", "dolor"],
					["ipsum", "sit"],
				]),
			);
			assert.deepEqual(
				node.getPropertyEntryMap(),
				new Map([
					["lorem", Entry.createProperty("lorem", "dolor")],
					["ipsum", Entry.createProperty("ipsum", "sit")],
				]),
			);

			node.setProperty("ipsum", "amet");
			assert.equal(node.entries.length, 3);
			assert.ok(node.hasProperties());
			assert.ok(node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), "dolor");
			assert.deepEqual(
				node.getPropertyEntry("lorem"),
				Entry.createProperty("lorem", "dolor"),
			);
			assert.ok(node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), "amet");
			assert.deepEqual(
				node.getPropertyEntry("ipsum"),
				Entry.createProperty("ipsum", "amet"),
			);
			assert.deepEqual(
				node.getProperties(),
				new Map([
					["lorem", "dolor"],
					["ipsum", "amet"],
				]),
			);
			assert.deepEqual(
				node.getPropertyEntryMap(),
				new Map([
					["lorem", Entry.createProperty("lorem", "dolor")],
					["ipsum", Entry.createProperty("ipsum", "amet")],
				]),
			);

			node.deleteProperty("ipsum");
			assert.equal(node.entries.length, 2);
			assert.ok(node.hasProperties());
			assert.ok(node.hasProperty("lorem"));
			assert.equal(node.getProperty("lorem"), "dolor");
			assert.deepEqual(
				node.getPropertyEntry("lorem"),
				Entry.createProperty("lorem", "dolor"),
			);
			assert.ok(!node.hasProperty("ipsum"));
			assert.equal(node.getProperty("ipsum"), undefined);
			assert.equal(node.getPropertyEntry("ipsum"), undefined);
			assert.deepEqual(node.getProperties(), new Map([["lorem", "dolor"]]));
			assert.deepEqual(
				node.getPropertyEntryMap(),
				new Map([["lorem", Entry.createProperty("lorem", "dolor")]]),
			);
		});
	});

	suite("node manipulation", () => {
		for (const {name, makeParent} of [
			{name: "in a document", makeParent: () => new Document()},
			{name: "in a node", makeParent: () => Node.create("-")},
		]) {
			suite(name, () => {
				test("insertNodeBefore", () => {
					const parent = makeParent();

					const one = Node.create("test");
					one.addArgument(1);
					const two = Node.create("test");
					two.addArgument(2);
					const three = Node.create("test");
					three.addArgument(3);

					assert.deepEqual(parent.findNodesByName("test"), []);

					parent.insertNodeBefore(one, null);
					assert.deepEqual(parent.findNodesByName("test"), [one]);

					assert.throws(
						() => parent.insertNodeBefore(three, two),
						/Reference node is not in document/,
					);

					parent.insertNodeBefore(two, null);
					assert.deepEqual(parent.findNodesByName("test"), [one, two]);

					parent.insertNodeBefore(three, two);
					assert.deepEqual(parent.findNodesByName("test"), [one, three, two]);

					parent.removeNodesByName("test");
					assert.deepEqual(parent.findNodesByName("test"), []);

					parent.insertNodeBefore(one, null);
					parent.insertNodeBefore(new Document([two, three]), one);
					assert.deepEqual(parent.findNodesByName("test"), [two, three, one]);
				});

				test("insertNodeAfter", () => {
					const parent = makeParent();

					const one = Node.create("test");
					one.addArgument(1);
					const two = Node.create("test");
					two.addArgument(2);
					const three = Node.create("test");
					three.addArgument(3);

					assert.deepEqual(parent.findNodesByName("test"), []);

					parent.insertNodeAfter(one, null);
					assert.deepEqual(parent.findNodesByName("test"), [one]);

					assert.throws(
						() => parent.insertNodeAfter(three, two),
						/Reference node is not in document/,
					);

					parent.insertNodeAfter(two, null);
					assert.deepEqual(parent.findNodesByName("test"), [two, one]);

					parent.insertNodeAfter(three, two);
					assert.deepEqual(parent.findNodesByName("test"), [two, three, one]);

					parent.removeNodesByName("test");
					assert.deepEqual(parent.findNodesByName("test"), []);

					parent.insertNodeAfter(one, null);
					parent.insertNodeAfter(new Document([two, three]), one);
					assert.deepEqual(parent.findNodesByName("test"), [one, two, three]);
				});

				test("removeNode", () => {
					const parent = makeParent();
					const node = Node.create("test");
					node.addArgument("node");
					const other = Node.create("test");
					other.addArgument("other");

					assert.throws(
						() => parent.removeNode(node),
						/Node to remove is not in document/,
					);

					parent.appendNode(node);

					assert.throws(
						() => parent.removeNode(other),
						/Node to remove is not in document/,
					);
					assert.deepEqual(parent.findNodesByName("test"), [node]);
					parent.removeNode(node);
					assert.deepEqual(parent.findNodesByName("test"), []);
					assert.throws(
						() => parent.removeNode(node),
						/Node to remove is not in document/,
					);
				});

				test("replaceNode", () => {
					const parent = makeParent();
					const node = Node.create("test");
					node.addArgument("node");
					const other = Node.create("test");
					other.addArgument("other");

					assert.throws(
						() => parent.replaceNode(node, other),
						/Node to replace is not in document/,
					);

					parent.appendNode(node);

					assert.throws(
						() => parent.replaceNode(other, node),
						/Node to replace is not in document/,
					);
					assert.deepEqual(parent.findNodesByName("test"), [node]);
					parent.replaceNode(node, other);
					assert.deepEqual(parent.findNodesByName("test"), [other]);
					assert.throws(
						() => parent.replaceNode(node, other),
						/Node to replace is not in document/,
					);
				});

				test("findNodeByName", () => {
					const parent = makeParent();
					const node = Node.create("test");
					node.addArgument("node");
					const other = Node.create("test");
					other.addArgument("other");

					parent.appendNode(new Document([node, other]));

					assert.equal(parent.findNodeByName("test"), other);
					parent.removeNode(other);
					assert.equal(parent.findNodeByName("test"), node);
					parent.removeNode(node);
					assert.equal(parent.findNodeByName("test"), undefined);
				});

				test("findParameterizedNode", () => {
					const parent = makeParent();
					const node = Node.create("test");
					node.addArgument("node");
					const other = Node.create("test");
					other.addArgument("other");

					parent.appendNode(
						new Document([node, other, Node.create("not-test")]),
					);

					assert.equal(parent.findParameterizedNode("test"), other);
					assert.equal(parent.findParameterizedNode("test", "other"), other);
					assert.equal(parent.findParameterizedNode("test", "node"), node);
					parent.removeNode(other);
					assert.equal(parent.findParameterizedNode("test"), node);
					assert.equal(
						parent.findParameterizedNode("test", "other"),
						undefined,
					);
					assert.equal(parent.findParameterizedNode("test", "node"), node);
					parent.removeNode(node);
					assert.equal(parent.findParameterizedNode("test"), undefined);
				});
			});
		}
	});
});
