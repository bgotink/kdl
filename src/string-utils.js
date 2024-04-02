import {InvalidKdlError, stringifyTokenOffset} from "./error.js";

const escape =
	/(?<=(?:^|[^\\])(?:\\\\)*)\\(?:$|([\x0A\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+)|[^u]|u\{([0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\})/g;

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

const reEntirelyInlineWhitespace =
	/^[\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;

const reEndsWithEscapedWhitespace =
	/(?<=(?:^|[^\\])(?:\\\\)*)\\[\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;

/**
 * @param {string} value
 * @param {import("./parser/tokenize.js").Token} token
 * @returns {string}
 */
export function postProcessRawStringValue(value, token) {
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
 * @param {import("./parser/tokenize.js").Token} token
 * @returns {string}
 */
export function postProcessStringValue(value, token) {
	const lines = value.split(reAllNewlines);

	if (lines.length === 1) {
		return replaceEscapes(value);
	}

	if (lines[0].length) {
		// mustn't be a multiline string...
		if (
			lines.slice(0, -1).some((line) => !reEndsWithEscapedWhitespace.test(line))
		) {
			throw new InvalidKdlError(
				`Multi-line strings must start with a newline at ${stringifyTokenOffset(
					token,
				)}`,
			);
		}

		return replaceEscapes(value);
	}

	// multiline string

	lines.shift();
	const lastLine = /** @type {string} */ (lines.pop());

	if (!reEntirelyInlineWhitespace.test(lastLine)) {
		throw new InvalidKdlError(
			`Multi-line strings must end with a line containing only whitespace at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	return replaceEscapes(
		lines
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
			.join("\n"),
	);
}

/**
 * @param {string} value
 */
function replaceEscapes(value) {
	return value.replaceAll(escape, (escape, escapedWhitespace, unicode) => {
		if (escapedWhitespace) {
			return "";
		} else if (unicode) {
			return String.fromCodePoint(parseInt(unicode, 16));
		} else {
			const replacement = escapedValues.get(escape);

			if (replacement == null) {
				throw new InvalidKdlError(
					escape ?
						`Invalid escape "\\${escape}"`
					:	"Invalid whitespace escape at the end of a string",
				);
			}

			return replacement;
		}
	});
}
