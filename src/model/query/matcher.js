/** @import { Node } from "../node.js"; */

/** @import { Accessor } from "./accessor.js"; */
/** @import { Comparison } from "./comparison.js"; */

/** @abstract */
export class Matcher {
	/**
	 * @returns {Matcher}
	 */
	static always() {
		return new AlwaysMatcher();
	}

	/**
	 * @param {Accessor} accessor
	 * @param {Comparison?} comparison
	 * @returns {Matcher}
	 */
	static accessor(accessor, comparison) {
		return new AccessorMatcher(accessor, comparison);
	}

	/**
	 * @param {string?} type
	 * @returns {Matcher}
	 */
	static type(type) {
		return new TypeMatcher(type);
	}

	/**
	 * @param {string} name
	 * @returns {Matcher}
	 */
	static nodeName(name) {
		return new NodeNameMatcher(name);
	}

	/**
	 * @abstract
	 * @param {Node} node
	 * @returns {boolean}
	 */
	matches(node) {
		throw new Error("implemented in subclass");
	}
}

class AlwaysMatcher extends Matcher {
	/** @override @param {Node} node */
	matches(node) {
		return true;
	}
}

class AccessorMatcher extends Matcher {
	/**
	 * @param {Accessor} accessor
	 * @param {Comparison?} comparison
	 */
	constructor(accessor, comparison) {
		super();

		/**
		 * @type {Accessor}
		 */
		this.accessor = accessor;
		/**
		 * @type {Comparison?}
		 */
		this.comparison = comparison;
	}

	/** @param {Node} node */
	matches(node) {
		const value = this.accessor.getValue(node);

		return (
			value != null &&
			(this.comparison == null || this.comparison.matches(value))
		);
	}
}

class TypeMatcher {
	/**
	 * @param {string?} tag
	 */
	constructor(tag) {
		/**
		 * @type {string?}
		 */
		this.tag = tag;
	}

	/** @param {Node} node */
	matches(node) {
		return node.tag != null && (this.tag == null || node.tag.name === this.tag);
	}
}

class NodeNameMatcher {
	/**
	 * @param {string} name
	 */
	constructor(name) {
		/**
		 * @type {string}
		 */
		this.name = name;
	}

	/** @param {Node} node */
	matches(node) {
		return node.name.name === this.name;
	}
}
