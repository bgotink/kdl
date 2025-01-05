import assert from "node:assert/strict";
import {test} from "uvu";

import {parse, format} from "../../src/dessert.js";
/** @import {DeserializationContext, DocumentSerializationContext, SerializationContext} from "../../src/dessert.js"; */

class Trie {
	/**
	 * @param {DeserializationContext} ctx
	 * @returns {Trie}
	 */
	static deserialize(ctx) {
		const trie = new Trie(
			new Map(ctx.children.entries.filtered(/^[a-zA-Z]$/, Trie)),
		);

		trie.#ctx = ctx;

		return trie;
	}

	/** @type {DeserializationContext=} */
	#ctx;

	/**
	 * @param {Map<string, Trie>} children
	 */
	constructor(children = new Map()) {
		this.children = children;
	}

	/**
	 * @param {string} name
	 * @param {Trie} trie
	 */
	set(name, trie = new Trie()) {
		this.children.set(name, trie);
	}

	/** @param {string} name */
	delete(name) {
		this.children.delete(name);
	}

	/** @param {string} name */
	get(name) {
		return this.children.get(name);
	}

	/** @param {string} name */
	getOrInsert(name) {
		let trie = this.children.get(name);
		if (trie == null) {
			trie = new Trie();
			this.children.set(name, trie);
		}
		return trie;
	}

	/** @param {SerializationContext | DocumentSerializationContext} ctx */
	serialize(ctx) {
		ctx.source(this.#ctx);

		for (const [name, child] of this.children) {
			ctx.child(name, child);
		}
	}
}

/** @param {string} text */
function parseTrie(text) {
	return parse(text, Trie);
}

/** @param {Trie} trie */
function formatTrie(trie) {
	return format(trie);
}

test("replacement", () => {
	const trie = parseTrie(`
b {
	o {
		o {
			/* comment */ k { s }
		}
	}
}
	`);

	const o = trie.getOrInsert("b").getOrInsert("o").getOrInsert("o");
	o.set("t", o.getOrInsert("k"));
	o.delete("k");

	assert.equal(
		formatTrie(trie),
		`
b {
	o {
		o {
			/* comment */ t { s }
		}
	}
}
	`,
	);

	o.set("t", new Trie());

	assert.equal(
		formatTrie(trie),
		`
b {
	o {
		o {
			t
		}
	}
}
	`,
	);

	o.getOrInsert("t").set("s");

	assert.equal(
		formatTrie(trie),
		`
b {
	o {
		o {
			t {
				s
			}
		}
	}
}
	`,
	);
});

class WrappedJson {
	/** @param {DeserializationContext} ctx */
	static deserialize(ctx) {
		const value = new WrappedJson(ctx.json.required("object"));
		value.#ctx = ctx;
		return value;
	}

	/** @type {DeserializationContext=} */
	#ctx;

	/** @param {import("../../src/json.js").JsonObject} value */
	constructor(value) {
		this.value = value;
	}

	/** @param {SerializationContext | DocumentSerializationContext} ctx */
	serialize(ctx) {
		ctx.source(this.#ctx);
		ctx.json(this.value);
	}
}

test("json replacement", () => {
	const object = parse(
		`
prop /- "test" #false
otherProp /- -1 0 1 2
		`,
		WrappedJson,
	);

	assert.deepEqual(object.value, {
		prop: false,
		otherProp: /** @type {import("../../src/json.js").JsonValue[]} */ ([
			0, 1, 2,
		]),
	});

	object.value.prop = true;
	object.value.otherProp[1] = {};

	assert.deepEqual(
		format(object),
		`
prop /- "test" #true
otherProp /- -1 0 {
	(object)-
	- 2
}
		`,
	);

	assert.deepEqual(parse(format(object), WrappedJson), object);
});

test.run();
