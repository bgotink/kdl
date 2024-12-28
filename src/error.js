import {T_EOF} from "./parser/tokenize.js";

/** @import {Token} from "./parser/token.js" */

/**
 * Error thrown when invalid KDL is encountered
 */
export class InvalidKdlError extends Error {
	/**
	 * @hidden
	 */
	name = "InvalidKdlError";

	/**
	 * The location of the error, if it can be tied to a single location
	 *
	 * @readonly
	 * @type {Token=}
	 */
	token;

	/**
	 * @param {string} message
	 * @param {ErrorOptions & {token?: Token}} [options]
	 */
	constructor(message, options) {
		const token = options?.token;

		if (token) {
			message = `${message} at ${stringifyTokenOffset(token)}`;
		}

		super(message, options);

		this.token = token;
	}
}

/**
 * @param {Token} token
 */
function stringifyTokenOffset(token) {
	if (token.type === T_EOF) {
		return `end of input`;
	}

	return `${token.start.line}:${token.start.column}`;
}
