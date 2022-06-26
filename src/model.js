export const kKind = Symbol.for('@bgotink/kdl:kind');

export class Value {
	/**
	 * @readonly
	 */
	[kKind] = 'Value';

	/**
	 * @readonly
	 */
	static [kKind] = 'Value';

	/**
	 * String representation of the value
	 *
	 * @type {string=}
	 */
	representation;

	/**
	 * @param {string | number | boolean | null} value
	 */
	constructor(value) {
		/**
		 * The value itself
		 *
		 * @type {string | number | boolean | null}
		 * @readonly
		 */
		this.value;

		Object.defineProperty(this, 'value', {
			enumerable: true,
			configurable: true,
			get: () => value,
		});
	}
}

export class Identifier {
	/**
	 * @readonly
	 */
	[kKind] = 'Identifier';

	/**
	 * @readonly
	 */
	static [kKind] = 'Identifier';

	/**
	 * @type {string}
	 */
	name;

	/**
	 * @type {string=}
	 */
	representation;

	/**
	 * @param {string} name
	 */
	constructor(name) {
		this.name = name;
	}
}

export class Entry {
	/**
	 * @readonly
	 */
	[kKind] = 'Entry';

	/**
	 * @readonly
	 */
	static [kKind] = 'Entry';

	/**
	 * The name of this entry if it's a property, or null if it's an argument
	 *
	 * @type {Identifier | null}
	 */
	name;

	/**
	 * The value of this entry
	 *
	 * @type {Value}
	 */
	value;

	/**
	 * Tag attached to this value, if any
	 *
	 * @type {Identifier | null}
	 */
	tag = null;

	/**
	 * Leading whitespace
	 *
	 * @type {string=}
	 */
	leading;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 */
	trailing;

	/**
	 * @param {Value} value
	 * @param {Identifier | null} name
	 */
	constructor(value, name) {
		this.value = value;
		this.name = name;
	}
}

export class Node {
	/**
	 * @readonly
	 */
	[kKind] = 'Node';

	/**
	 * @readonly
	 */
	static [kKind] = 'Node';

	/**
	 * The name (also known as "tag name") of this node
	 *
	 * @type {Identifier}
	 */
	name;

	/**
	 * Tag attached to this value, if any
	 *
	 * @type {Identifier | null}
	 */
	tag = null;

	/**
	 * Entries of the node
	 *
	 * @type {Entry[]}
	 */
	entries;

	/**
	 * Children of the node
	 *
	 * An empty array means the children block is present but empty,
	 * if the value is `null` then there is no children block.
	 *
	 * @type {Document | null}
	 */
	children;

	/**
	 * Leading whitespace
	 *
	 * @type {string=}
	 */
	leading;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 */
	trailing;

	/**
	 * Whitespace between the last entry and the children
	 *
	 * @type {string=}
	 */
	beforeChildren;

	/**
	 * @param {Identifier} name
	 * @param {Entry[]} [entries]
	 * @param {Document | null} [children]
	 */
	constructor(name, entries = [], children = null) {
		this.name = name;
		this.entries = entries;
		this.children = children;
	}
}

export class Document {
	/**
	 * @readonly
	 */
	[kKind] = 'Document';

	/**
	 * @readonly
	 */
	static [kKind] = 'Document';

	/**
	 * @type {Node[]}
	 */
	nodes;

	/**
	 * Leading whitespace
	 *
	 * @type {string=}
	 */
	leading;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 */
	trailing;

	/**
	 * @param {Node[]} nodes
	 */
	constructor(nodes) {
		this.nodes = nodes;
	}
}
