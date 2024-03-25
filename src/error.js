import {T_EOF} from "./parser/tokenize.js";

/**
 * Error thrown when invalid KDL is encountered
 */
export class InvalidKdlError extends Error {
	/**
	 * @hidden
	 */
	name = "InvalidKdlError";
}

/**
 * @param {import("./parser/tokenize.js").Token} token
 */
export function stringifyTokenOffset(token) {
	if (token.type === T_EOF) {
		return `end of input`;
	}

	return `${token.start.line}:${token.start.column}`;
}
