import {InvalidKdlError} from "./error.js";
import {isIdentifierChar, isInvalidCharacter} from "./parser/tokenize.js";

/** @import {ParserCtx} from "./parser/parse.js" */
/** @import {Token} from "./parser/token.js" */

const escapeWhitespace =
	/((?:^|[^\\])(?:\\\\)*)\\([\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+)/g;
const escape =
	/\\(?:$|u\{(0[0-9a-fA-F]{0,5}|10[0-9a-fA-F]{4}|[1-9a-fA-F][0-9a-fA-F]{0,4})\}|u(\{[^}]{1,6}\}?|[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})|.)/g;

/** @param {string} identifier */
export function isValidBareIdentifier(identifier) {
	// no values that can be confused with keywords
	if (
		identifier === "true" ||
		identifier === "false" ||
		identifier === "null" ||
		identifier === "inf" ||
		identifier === "-inf" ||
		identifier === "nan"
	) {
		return false;
	}

	// no empty strings
	if (identifier === "") {
		return false;
	}

	for (const part of identifier) {
		const c = /** @type {number} */ (part.codePointAt(0));
		if (isInvalidCharacter(c) || !isIdentifierChar(c)) {
			return false;
		}
	}

	return !/^[+-]?\.?[0-9]/.test(identifier);
}

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

export const reNewline = /\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029]/;

export const reStartsWithInlineWhitespace =
	/^[\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/;
const reEntirelyInlineWhitespace =
	/^[\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;

/**
 * @param {ParserCtx} ctx
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessRawStringValue(ctx, value, token) {
	if (reNewline.test(value)) {
		ctx.errors.push(
			new InvalidKdlError(
				`Raw strings with single quotes cannot contain any newlines, use triple-quotes for multiline strings`,
				{token},
			),
		);
	}

	return value;
}

/**
 * @param {ParserCtx} ctx
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessMultilineRawStringValue(ctx, value, token) {
	const lines = value.split(reNewline);

	if (lines.length === 1) {
		ctx.errors.push(
			new InvalidKdlError(
				`Raw strings with three quotes must be multiline strings`,
				{token},
			),
		);

		return value;
	}

	const firstLine = /** @type {string} */ (lines.shift());
	const lastLine = /** @type {string} */ (lines.pop());

	if (firstLine.length) {
		ctx.errors.push(
			new InvalidKdlError(`Multi-line strings must start with a newline`, {
				token,
			}),
		);

		return value;
	}

	if (!reEntirelyInlineWhitespace.test(lastLine)) {
		ctx.errors.push(
			new InvalidKdlError(
				`The final line in a multiline string may only contain whitespace`,
				{token},
			),
		);

		return value;
	}

	return lines
		.map((line, index) => {
			if (reEntirelyInlineWhitespace.test(line)) {
				return "";
			} else if (!line.startsWith(lastLine)) {
				ctx.errors.push(
					new InvalidKdlError(
						`Line ${index + 1} of this multi-line string doesn't start with the offset defined by the last line of the string`,
						{token},
					),
				);
				return "";
			} else {
				return line.slice(lastLine.length);
			}
		})
		.join("\n");
}

/**
 * @param {ParserCtx} ctx
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessStringValue(ctx, value, token) {
	value = removeWhitespaceEscapes(value);

	if (reNewline.test(value)) {
		// mustn't be a multiline string...
		ctx.errors.push(
			new InvalidKdlError(
				`Strings with single quotes cannot contain any unescaped newlines, use triple-quotes for multiline strings`,
				{token},
			),
		);
	}

	return replaceEscapes(ctx, value, token);
}

/**
 * @param {ParserCtx} ctx
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessMultilineStringValue(ctx, value, token) {
	const lines = removeWhitespaceEscapes(value).split(reNewline);

	if (lines.length === 1) {
		ctx.errors.push(
			new InvalidKdlError(
				`Strings with three quotes must be multiline strings`,
				{token},
			),
		);

		return value;
	}

	const firstLine = /** @type {string} */ (lines.shift());
	const lastLine = /** @type {string} */ (lines.pop());

	if (firstLine.length) {
		ctx.errors.push(
			new InvalidKdlError(`Multi-line strings must start with a newline`, {
				token,
			}),
		);

		return value;
	}

	if (!reEntirelyInlineWhitespace.test(lastLine)) {
		ctx.errors.push(
			new InvalidKdlError(
				`The final line in a multiline string may only contain whitespace`,
				{token},
			),
		);

		return value;
	}

	return replaceEscapes(
		ctx,
		lines
			.map((line, index) => {
				if (reEntirelyInlineWhitespace.test(line)) {
					return "";
				} else if (!line.startsWith(lastLine)) {
					ctx.errors.push(
						new InvalidKdlError(
							`Line ${index + 1} of this multi-line string doesn't start with the offset defined by the last line of the string`,
							{token},
						),
					);
					return "";
				} else {
					return line.slice(lastLine.length);
				}
			})
			.join("\n"),
		token,
	);
}

/** @param {string} value */
function removeWhitespaceEscapes(value) {
	return value.replaceAll(escapeWhitespace, (_, beforeEscape) => beforeEscape);
}

/**
 * @param {ParserCtx} ctx
 * @param {string} value
 * @param {Token} token
 */
function replaceEscapes(ctx, value, token) {
	let hadError = false;

	return value.replaceAll(escape, (escape, unicode, invalidUnicode) => {
		if (hadError) {
			return escape;
		}

		if (invalidUnicode) {
			if (!invalidUnicode.startsWith("{")) {
				ctx.errors.push(
					new InvalidKdlError(
						String.raw`Invalid unicode escape "\u${invalidUnicode}", did you forget to use {}? "\u{${invalidUnicode}}"`,
						{token},
					),
				);
			} else {
				ctx.errors.push(
					new InvalidKdlError(
						String.raw`Invalid unicode escape "\u${invalidUnicode.endsWith("}") ? invalidUnicode : `${invalidUnicode}...`}"`,
						{token},
					),
				);
			}

			hadError = true;
			return "";
		} else if (unicode) {
			const codePoint = parseInt(unicode, 16);

			// Non-scalar values
			if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
				ctx.errors.push(
					new InvalidKdlError(
						String.raw`Invalid unicode escape "\u{${unicode}}, only scalar values can be added using an escape`,
						{token},
					),
				);
			}

			return String.fromCodePoint(codePoint);
		} else {
			const replacement = escapedValues.get(escape);

			if (replacement == null) {
				ctx.errors.push(
					new InvalidKdlError(
						escape.length < 2 ?
							"Invalid whitespace escape at the end of a string"
						:	`Invalid escape "${escape}"`,
						{token},
					),
				);
				hadError = true;
				return "";
			}

			return replacement;
		}
	});
}
