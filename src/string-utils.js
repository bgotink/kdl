import {InvalidKdlError, stringifyTokenOffset} from "./error.js";
import {escape, escapedValues, escapedWhitespace} from "./tokens/strings.js";
import {
	reAllNewlines,
	reEntirelyInlineWhitespace,
} from "./tokens/whitespace.js";

/**
 * @param {string} value
 * @param {import("chevrotain").IToken} token
 */
export function removeLeadingWhitespace(value, token) {
	const lines = value.split(reAllNewlines);

	if (lines.length === 1) {
		return value;
	}

	const firstLine = /** @type {string} */ (lines.shift());
	const lastLine = /** @type {string} */ (lines.pop());

	if (firstLine.length) {
		throw new InvalidKdlError(
			`Multi-line strings must start with a newline at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	if (!reEntirelyInlineWhitespace.test(lastLine)) {
		throw new InvalidKdlError(
			`Multi-line strings must end with a line containing only whitespace at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	return lines
		.map((line, index) => {
			if (reEntirelyInlineWhitespace.test(line)) {
				return "";
			} else if (!line.startsWith(lastLine)) {
				throw new InvalidKdlError(
					`Line ${index + 1} of multi-line string at ${stringifyTokenOffset(
						token,
					)} doesn't start with the offset defined by the last line of the string`,
				);
			} else {
				return line.slice(lastLine.length);
			}
		})
		.join("\n");
}

/**
 * @param {string} value
 */
export function removeEscapedWhitespace(value) {
	return value.replaceAll(escapedWhitespace, "");
}

/**
 * @param {string} value
 */
export function replaceEscapes(value) {
	return value.replaceAll(escape, (escape, unicode) => {
		if (unicode) {
			return String.fromCharCode(parseInt(unicode, 16));
		} else {
			const replacement = escapedValues.get(escape);

			if (replacement == null) {
				throw new InvalidKdlError(`Invalid escape "${escape}"`);
			}

			return replacement;
		}
	});
}
