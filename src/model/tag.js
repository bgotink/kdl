/**
 * A tag is tied to anode or entry
 */
export class Tag {
	/**
	 * @readonly
	 * @hidden
	 */
	type = "tag";

	/**
	 * @readonly
	 * @hidden
	 */
	static type = "tag";

	/**
	 * String representation of the tag
	 *
	 * @type {string=}
	 */
	representation;

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
	 * @param {string} name
	 */
	constructor(name) {
		/**
		 * The tag itself
		 *
		 * @type {string}
		 * @readonly
		 */
		this.name;

		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: false,
			value: name,
		});
	}

	/**
	 * Create an identical copy of this tag
	 *
	 * @returns {Tag}
	 */
	clone() {
		const clone = new Tag(this.name);
		clone.representation = this.representation;

		clone.leading = this.leading;
		clone.trailing = this.trailing;

		return clone;
	}
}
