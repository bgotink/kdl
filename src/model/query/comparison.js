/** @import { Tag } from "../tag.js"; */
/** @import { Primitive, Value } from "../value.js"; */

/**
 * @abstract
 */
export class Comparison {
	/**
	 * @param {'=' | '!=' | '>' | '<' | '>=' | '<=' | '^=' | '$=' | '*='} operator
	 * @param {Value | Tag} value
	 * @returns {Comparison}
	 */
	static create(operator, value) {
		if (operator === "=") {
			return new EqualsComparison(value);
		}

		if (value.type !== "value") {
			return new ImpossibleComparison();
		}

		const v = value.value;

		if (operator === "!=") {
			return new NotEqualsComparison(v);
		}

		if (typeof v === "boolean" || v === null) {
			return new ImpossibleComparison();
		}

		switch (operator) {
			case ">":
				return new GreaterThanComparison(v);
			case ">=":
				return new GreaterThanOrEqualsComparison(v);
			case "<":
				return new LessThanComparison(v);
			case "<=":
				return new LessThanOrEqualsComparison(v);
		}

		if (typeof v === "string") {
			switch (operator) {
				case "^=":
					return new StartsWithComparison(v);
				case "$=":
					return new EndsWithComparison(v);
				case "*=":
					return new IncludesComparison(v);
			}
		}

		return new ImpossibleComparison();
	}

	/**
	 * @param {Value} value
	 * @returns {boolean}
	 */
	matches(value) {
		return false;
	}
}

class ImpossibleComparison extends Comparison {
	/** @override */
	matches() {
		return false;
	}
}

class EqualsComparison extends Comparison {
	/** @type {Value | Tag} */
	#value;
	/** @param {Value | Tag} value */
	constructor(value) {
		super();
		this.#value = value;
	}

	/** @override @param {Value} value */
	matches(value) {
		if (this.#value.type === "tag") {
			return value.tag?.name === this.#value.name;
		} else {
			return value.value === this.#value.value;
		}
	}
}

class NotEqualsComparison extends Comparison {
	/** @type {Primitive} */
	#value;
	/** @param {Primitive} value */
	constructor(value) {
		super();
		this.#value = value;
	}

	/** @override @param {Value} value */
	matches(value) {
		return value.value !== this.#value;
	}
}

/** @abstract */
class ValueComparison extends Comparison {
	/** @param {string | number} value */
	constructor(value) {
		super();

		/** @readonly @type {string | number} */
		this.value = value;
	}
}

class GreaterThanComparison extends ValueComparison {
	/** @override @param {Value} value */
	matches(value) {
		return (
			typeof value.value === typeof this.value &&
			/** @type {string | number} */ (value.value) > this.value
		);
	}
}

class LessThanComparison extends ValueComparison {
	/** @override @param {Value} value */
	matches(value) {
		return (
			typeof value.value === typeof this.value &&
			/** @type {string | number} */ (value.value) < this.value
		);
	}
}

class GreaterThanOrEqualsComparison extends ValueComparison {
	/** @override @param {Value} value */
	matches(value) {
		return (
			typeof value.value === typeof this.value &&
			/** @type {string | number} */ (value.value) >= this.value
		);
	}
}

class LessThanOrEqualsComparison extends ValueComparison {
	/** @override @param {Value} value */
	matches(value) {
		return (
			typeof value.value === typeof this.value &&
			/** @type {string | number} */ (value.value) <= this.value
		);
	}
}

/** @abstract */
class StringComparison extends Comparison {
	/** @param {string} value */
	constructor(value) {
		super();

		/** @readonly @type {string} */
		this.value = value;
	}
}

class StartsWithComparison extends StringComparison {
	/** @override @param {Value} value */
	matches(value) {
		return (
			typeof value.value === "string" && value.value.startsWith(this.value)
		);
	}
}

class EndsWithComparison extends StringComparison {
	/** @override @param {Value} value */
	matches(value) {
		return typeof value.value === "string" && value.value.endsWith(this.value);
	}
}

class IncludesComparison extends StringComparison {
	/** @override @param {Value} value */
	matches(value) {
		return typeof value.value === "string" && value.value.includes(this.value);
	}
}
