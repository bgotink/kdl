import {T_EOF} from "./parser/tokenize.js";

/** @import {Location, Token} from "./parser/token.js" */

/**
 * Error thrown when invalid KDL is encountered
 */
export class InvalidKdlError extends Error {
	/**
	 * @hidden
	 */
	name = "InvalidKdlError";

	/**
	 * The location of the start of the error, if it can be tied to a single location
	 *
	 * @readonly
	 * @type {Location=}
	 */
	start;

	/**
	 * The location of the end of the error, if it can be tied to a single location
	 *
	 * @readonly
	 * @type {Location=}
	 */
	end;

	/**
	 * Token tied to the error, if it can be tied to a single token
	 *
	 * @readonly
	 * @type {Token=}
	 */
	token;

	/**
	 * Collection of more specific errors
	 *
	 * If this property is present, then the message of this error will be something generic and
	 * the errors in this property will contain more useful information.
	 *
	 * @readonly
	 * @type {InvalidKdlError[]=}
	 */
	errors;

	/**
	 * @param {string} message
	 * @param {ErrorOptions & {token?: Token; start?: Location; end?: Location; errors?: InvalidKdlError[]}} [options]
	 */
	constructor(
		message,
		{token, start = token?.start, end = token?.end, errors, ...options} = {},
	) {
		if (token?.type === T_EOF) {
			message = `${message} at end of input`;
		} else if (start) {
			message = `${message} at ${start.line}:${start.column}`;
		}

		super(message, options);

		this.token = token;
		this.start = start;
		this.end = end;
		this.errors = errors;
	}

	/**
	 * Returns an iterable for the details of this error
	 *
	 * If this error contains more detailed errors, this iterable yields those detailed errors.
	 * If this error doesn't have more detailed errors, this iterable yields this error itself.
	 *
	 * @returns {Generator<InvalidKdlError, void, void>}
	 */
	*flat() {
		if (this.errors == null) {
			yield this;
			return;
		}

		for (const error of this.errors) {
			yield* error.flat();
		}
	}
}

export class InvalidKdlQueryError extends Error {
	/**
	 * @hidden
	 */
	name = "InvalidKdlQueryError";

	/**
	 * The location of the start of the error, if it can be tied to a single location
	 *
	 * @readonly
	 * @type {Location=}
	 */
	start;

	/**
	 * The location of the end of the error, if it can be tied to a single location
	 *
	 * @readonly
	 * @type {Location=}
	 */
	end;

	/**
	 * Token tied to the error, if it can be tied to a single token
	 *
	 * @readonly
	 * @type {Token=}
	 */
	token;

	/**
	 * @param {string} message
	 * @param {ErrorOptions & {token?: Token; start?: Location; end?: Location}} [options]
	 */
	constructor(
		message,
		{token, start = token?.start, end = token?.end, ...options} = {},
	) {
		if (token?.type === T_EOF) {
			message = `${message} at end of input`;
		} else if (start) {
			message = `${message} at ${start.line}:${start.column}`;
		}

		super(message, options);

		this.token = token;
		this.start = start;
		this.end = end;
	}
}
