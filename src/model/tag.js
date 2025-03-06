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
	 * @hidden
	 */
	representation;

	/**
	 * Leading whitespace
	 *
	 * @type {string=}
	 * @hidden
	 */
	leading;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 * @hidden
	 */
	trailing;

	/**
	 * Whether the tag is shown as suffix or not
	 * @type {boolean=}
	 * @hidden
	 */
	suffix;

	/**
	 * @param {string} name
	 */
	constructor(name) {
		/**
		 * The tag itself
		 *
		 * @type {string}
		 * @readonly
		 * @hidden
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
	 * Return the tag name
	 *
	 * @returns {string}
	 */
	getName() {
		return this.name;
	}

	/**
	 * Change the tag name
	 *
	 * @param {string} name
	 */
	setName(name) {
		if (name !== this.name) {
			/** @type {{name: string}} */ (this).name = name;
			this.representation = undefined;
		}
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
		clone.suffix = this.suffix;

		return clone;
	}
}
