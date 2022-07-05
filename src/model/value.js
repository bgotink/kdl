export class Value {
	/**
	 * @readonly
	 */
	type = 'value';

	/**
	 * @readonly
	 */
	static type = 'value';

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
