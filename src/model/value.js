import {Tag} from "./tag.js";

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
	 * Tag attached to this value, if any
	 *
	 * @type {Tag | null}
	 * @hidden
	 */
	tag = null;

	/**
	 * Whitespace between the tag and the value
	 *
	 * @type {string=}
	 */
	betweenTagAndValue;

	/**
	 * @param {Primitive} value
	 */
	constructor(value) {
		/**
		 * The value itself
		 *
		 * @type {Primitive}
		 * @readonly
		 * @hidden
		 */
		this.value = value;
	}

	/**
	 * Create an identical copy of this value
	 *
	 * @returns {Value}
	 */
	clone() {
		const clone = new Value(this.value);
		clone.tag = this.tag?.clone() ?? null;
		clone.betweenTagAndValue = this.betweenTagAndValue;
		clone.representation = this.representation;
		return clone;
	}

	/**
	 * Return the value itself
	 *
	 * @returns {Primitive}
	 */
	getValue() {
		return this.value;
	}

	/**
	 * Change the value
	 *
	 * @param {Primitive} value
	 */
	setValue(value) {
		if (value !== this.value) {
			/** @type {{value: Primitive}} */ (this).value = value;
			this.representation = undefined;
		}
	}

	/**
	 * Return the tag of this entry, if any
	 *
	 * @returns {string | null}
	 */
	getTag() {
		return this.tag ? this.tag.name : null;
	}

	/**
	 * Set the tag of this entry to the given tag
	 *
	 * @param {string | null | undefined} tag
	 */
	setTag(tag) {
		if (tag == null) {
			this.tag = null;
		} else if (this.tag != null) {
			this.tag.setName(tag);
		} else {
			this.tag = new Tag(tag);
		}
	}
}
