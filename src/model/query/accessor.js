import {Value} from "../value.js";

/** @import { Node } from "../node.js"; */

/**
 * @abstract
 */
export class Accessor {
	/** @returns {Accessor} */
	static name() {
		return new NameAccessor();
	}

	/** @returns {Accessor} */
	static tag() {
		return new TagAccessor();
	}

	/** @returns {Accessor} */
	static argument(index = 0) {
		return new ArgumentAccessor(index);
	}

	/**
	 * @param {string} name
	 * @returns {Accessor}
	 */
	static property(name) {
		return new PropertyAccessor(name);
	}

	/**
	 * @param {Node} node
	 * @returns {Value=}
	 */
	getValue(node) {
		return undefined;
	}
}

class NameAccessor extends Accessor {
	/** @override @param {Node} node */
	getValue(node) {
		return new Value(node.getName());
	}
}

class TagAccessor extends Accessor {
	/** @override @param {Node} node */
	getValue(node) {
		return node.tag ? new Value(node.tag.name) : undefined;
	}
}

class ArgumentAccessor extends Accessor {
	/** @type {number} */
	#index;

	/** @param {number} index */
	constructor(index) {
		super();

		this.#index = index;
	}

	/** @override @param {Node} node */
	getValue(node) {
		return node.getArgumentEntry(this.#index)?.value;
	}
}

class PropertyAccessor extends Accessor {
	/** @type {string} */
	#name;

	/** @param {string} name */
	constructor(name) {
		super();

		this.#name = name;
	}

	/** @override @param {Node} node */
	getValue(node) {
		return node.getPropertyEntry(this.#name)?.value;
	}
}
