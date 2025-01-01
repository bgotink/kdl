/**
 * An identifier
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
	 * @hidden
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
		 * @hidden
		 */
		this.name = name;
	}

	/**
	 * Returns the name of this identifier
	 */
	getName() {
		return this.name;
	}

	/**
	 * Change the name of the identifier
	 *
	 * @param {string} name
	 */
	setName(name) {
		if (name !== this.name) {
			this.name = name;
			this.representation = undefined;
		}
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
