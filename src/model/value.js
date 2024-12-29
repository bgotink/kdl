/**
 * @typedef {string | number | boolean | null} Primitive
 * A primitive is any type that can be represented as an argument or property
 */

/**
 * A value represents a primitive in KDL, i.e. a string, boolean, number, or null
 *
 * Values are always tied to an entry.
 */
export class Value {
	/**
	 * @readonly
	 * @hidden
	 */
	type = "value";

	/**
	 * @readonly
	 * @hidden
	 */
	static type = "value";

	/**
	 * String representation of the value
	 *
	 * @type {string=}
	 */
	representation;

	/**
	 * @param {Primitive} value
	 */
	constructor(value) {
		/**
		 * The value itself
		 *
		 * @type {Primitive}
		 * @readonly
		 */
		this.value;

		Object.defineProperty(this, "value", {
			enumerable: true,
			configurable: true,
			writable: false,
			value,
		});
	}

	/**
	 * Create an identical copy of this value
	 *
	 * @returns {Value}
	 */
	clone() {
		const clone = new Value(this.value);
		clone.representation = this.representation;
		return clone;
	}
}
