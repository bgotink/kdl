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
	 * @param {string} message
	 * @param {ErrorOptions & {token?: Token; start?: Location; end?: Location}} [options]
	 */
	constructor(message, options) {
		const token = options?.token;
		const start = options?.start ?? token?.start;

		if (token?.type === T_EOF) {
			message = `${message} at end of input`;
		} else if (start) {
			message = `${message} at ${start.line}:${start.column}`;
		}

		super(message, options);

		this.token = token;
		this.start = start;
		this.end = options?.end ?? token?.end;
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
	constructor(message, options) {
		const token = options?.token;
		const start = options?.start ?? token?.start;

		if (token?.type === T_EOF) {
			message = `${message} at end of input`;
		} else if (start) {
			message = `${message} at ${start.line}:${start.column}`;
		}

		super(message, options);

		this.token = token;
		this.start = start;
		this.end = options?.end ?? token?.end;
	}
}
