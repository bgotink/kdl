import {InvalidKdlError, stringifyTokenOffset} from "./error.js";

const escapedWhitespace =
	/(?<=(?:^|[^\\])(?:\\\\)*)\\[\x0A\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;
const escape = /\\(?:[^u]|u\{([0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\})/g;

const escapedValues = new Map([
	["\\n", "\n"],
	["\\r", "\r"],
	["\\t", "\t"],
	["\\\\", "\\"],
	['\\"', '"'],
	["\\b", "\b"],
	["\\f", "\f"],
	["\\s", " "],
]);

const reAllNewlines = /\x0D\x0A|[\x0A\x0C\x0D\x85\u2028\u2029]/g;

export const reEntirelyInlineWhitespace =
	/^[\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;

/**
 * @param {string} value
 * @param {import("./parser/tokenize.js").Token} token
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
