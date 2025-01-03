import {Identifier} from "./identifier.js";
import {Value} from "./value.js";

/**
 * An entry represents either an argument or a property to a node
 */
export class Entry {
	/**
	 * Create a new argument entry with the given value
	 *
	 * @param {Value['value']} value
	 * @returns {Entry}
	 */
	static createArgument(value) {
		return new Entry(new Value(value), null);
	}

	/**
	 * Create a new property entry for the given key and value
	 *
	 * @param {string} name
	 * @param {Value['value']} value
	 * @returns {Entry}
	 */
	static createProperty(name, value) {
		return new Entry(new Value(value), new Identifier(name));
	}

	/**
	 * @readonly
	 * @hidden
	 */
	type = "entry";

	/**
	 * @readonly
	 * @hidden
	 */
	static type = "entry";

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
	 * Equals sign
	 *
	 * @type {string=}
	 */
	equals;

	/**
	 * @param {Value} value
	 * @param {Identifier | null} name
	 */
	constructor(value, name) {
		this.value = value;
		this.name = name;
	}

	/**
	 * Create an identical copy of this entry
	 *
	 * @returns {Entry}
	 */
	clone() {
		const clone = new Entry(this.value.clone(), this.name?.clone() ?? null);

		clone.leading = this.leading;
		clone.trailing = this.trailing;
		clone.equals = this.equals;

		return clone;
	}

	/**
	 * Return the tag of this entry, if any
	 *
	 * @returns {string | null}
	 * @see {@link Value.prototype.getTag}
	 */
	getTag() {
		return this.value.getTag();
	}

	/**
	 * Set the tag of this entry to the given tag
	 *
	 * @param {string | null | undefined} tag
	 * @see {@link Value.prototype.setTag}
	 */
	setTag(tag) {
		this.value.setTag(tag);
	}

	/**
	 * Return the name of this entry, if any
	 *
	 * @returns {string | null}
	 */
	getName() {
		return this.name ? this.name.name : null;
	}

	/**
	 * Set the name of this entry to the given name
	 *
	 * @param {string | null | undefined} name
	 */
	setName(name) {
		this.name = name != null ? new Identifier(name) : null;
	}

	/**
	 * Return the value of this entry
	 *
	 * @returns {Value['value']}
	 */
	getValue() {
		return this.value.value;
	}

	/**
	 * Set the name of this entry to the given name
	 *
	 * @param {Value['value']} value
	 */
	setValue(value) {
		this.value = new Value(value);
	}

	/**
	 * Return whether this entry is an argument
	 *
	 * @returns {boolean}
	 */
	isArgument() {
		return this.name == null;
	}

	/**
	 * Return whether this entry is a named property
	 *
	 * @returns {boolean}
	 */
	isProperty() {
		return this.name != null;
	}
}
