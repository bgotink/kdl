import {T_EOF} from "./parser/tokenize.js";

/** @import {Token} from "./parser/tokenize.js" */

/**
 * Error thrown when invalid KDL is encountered
 */
export class InvalidKdlError extends Error {
	/**
	 * @hidden
	 */
	name = "InvalidKdlError";

	/**
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
 * @param {import("./parser/tokenize.js").Token} token
 */
function stringifyTokenOffset(token) {
	if (token.type === T_EOF) {
		return `end of input`;
	}

	return `${token.start.line}:${token.start.column}`;
}
