import {InvalidKdlError, stringifyTokenOffset} from "./error.js";

const escapeWhitespace =
	/((?:^|[^\\])(?:\\\\)*)\\([\x0A\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+)/g;
const escape =
	/\\(?:$|u\{([0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\}|u(\{[^}]{1,6}\}?|[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})|.)/g;

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

/**
 * @param {string} value
 * @param {import("./parser/tokenize.js").Token} token
 * @returns {string}
 */
export function postProcessRawStringValue(value, token) {
	if (reAllNewlines.test(value)) {
		throw new InvalidKdlError(
			`Multi-line strings must start with three quotes at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	return value;
}

/**
 * @param {string} value
 * @param {import("./parser/tokenize.js").Token} token
 * @returns {string}
 */
export function postProcessMultilineRawStringValue(value, token) {
	const lines = value.split(reAllNewlines);

	if (lines.length === 1) {
		throw new InvalidKdlError(
			`Strings quotes with three quotes must be multiline at ${stringifyTokenOffset(
				token,
			)}`,
		);
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
	value = removeWhitespaceEscapes(value);
	const lines = value.split(reAllNewlines);

	if (lines.length > 1) {
		// mustn't be a multiline string...
		throw new InvalidKdlError(
			`Multi-line strings must start with three quotes at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	return replaceEscapes(value);
}

/**
 * @param {string} value
 * @param {import("./parser/tokenize.js").Token} token
 * @returns {string}
 */
export function postProcessMultilineStringValue(value, token) {
	const lines = removeWhitespaceEscapes(value).split(reAllNewlines);

	if (lines.length === 1) {
		throw new InvalidKdlError(
			`Strings quotes with three quotes must be multiline at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

	if (lines[0].length) {
		throw new InvalidKdlError(
			`Multi-line strings must start with a newline at ${stringifyTokenOffset(
				token,
			)}`,
		);
	}

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

/** @param {string} value */
function removeWhitespaceEscapes(value) {
	return value.replaceAll(escapeWhitespace, (_, beforeEscape) => beforeEscape);
}

/**
 * @param {string} value
 */
function replaceEscapes(value) {
	return value.replaceAll(escape, (escape, unicode, invalidUnicode) => {
		if (invalidUnicode) {
			if (!invalidUnicode.startsWith("{")) {
				throw new InvalidKdlError(
					String.raw`Invalid unicode escape "\u${invalidUnicode}", did you forget to use {}? "\u{${invalidUnicode}}"`,
				);
			} else {
				throw new InvalidKdlError(
					String.raw`Invalid unicode escape "\u${invalidUnicode.endsWith("}") ? invalidUnicode : `${invalidUnicode}...`}"`,
				);
			}
		} else if (unicode) {
			return String.fromCodePoint(parseInt(unicode, 16));
		} else {
			const replacement = escapedValues.get(escape);

			if (replacement == null) {
				if (escape.length < 2) {
					throw new InvalidKdlError(
						"Invalid whitespace escape at the end of a string",
					);
				}

				throw new InvalidKdlError(`Invalid escape "${escape}"`);
			}

			return replacement;
		}
	});
}
