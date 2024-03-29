/**
 * An
 */
export class Identifier {
	/**
	 * @readonly
	 * @hidden
	 */
	type = "identifier";

	/**
	 * @readonly
	 * @hidden
	 */
	static type = "identifier";

	/**
	 * String representation of the identifier
	 *
	 * @type {string=}
	 */
	representation;

	/**
	 * @param {string} name
	 */
	constructor(name) {
		/**
		 * The identifier itself
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
	 * Create an identical copy of this identifier
	 *
	 * @returns {Identifier}
	 */
	clone() {
		const clone = new Identifier(this.name);
		clone.representation = this.representation;
		return clone;
	}
}
