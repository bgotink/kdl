import {EOF} from "chevrotain";

export class InvalidKdlError extends Error {
	name = "InvalidKdlError";
}

/**
 * @param {object} offset
 * @param {number} [offset.line]
 * @param {number} [offset.column]
 * @param {number} offset.offset
 */
export function stringifyOffset(offset) {
	if (offset.line != null && offset.column != null) {
		return `${offset.line}:${offset.column}`;
	} else if (offset.line != null) {
		return `${offset.line}`;
	}

	return `${offset.offset}`;
}
/**
 * @param {import('chevrotain').IToken} token
 */
export function stringifyTokenOffset(token) {
	if (token.tokenType === EOF) {
		return `end of input`;
	}

	if (token.startLine != null && token.startColumn != null) {
		return `${token.startLine}:${token.startColumn}`;
	} else if (token.startLine != null) {
		return `${token.startLine}`;
	}

	return `${token.startOffset}`;
}
