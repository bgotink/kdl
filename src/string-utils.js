import {InvalidKdlError} from "./error.js";
import {
	isIdentifierChar,
	isInvalidCharacter,
	T_MULTILINE_QUOTED_STRING,
	T_MULTILINE_RAW_STRING,
	T_RAW_STRING,
} from "./parser/tokenize.js";

/** @import {ParserCtx} from "./parser/parse.js" */
/** @import {Location, Token} from "./parser/token.js" */

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
export const reAllNewline = /\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029]/g;
// Something that isn't a backslash followed by an even number of backslashes followed by inline whitespace followed by a newline
export const reUnescapedNewline =
	/(?:^|[^\\\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\x0A\x0B\x0C\x0D\x85\u2028\u2029])(?:\\\\)*[\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\x0A\x0B\x0C\x0D\x85\u2028\u2029]*(\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029])/s;
export const reAllUnescapedNewline =
	/(?:^|[^\\\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\x0A\x0B\x0C\x0D\x85\u2028\u2029])(?:\\\\)*[\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\x0A\x0B\x0C\x0D\x85\u2028\u2029]*(\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029])/dgs;

/**
 * @param {Error[]} errors
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessRawStringValue(errors, value, token) {
	// mustn't be a multiline string...
	let newlineMatch;
	while ((newlineMatch = reAllNewline.exec(value))) {
		const start = computeStartLocation(token, value, newlineMatch.index);

		errors.push(
			new InvalidKdlError(
				`Raw strings with single quotes cannot contain any unescaped newlines, use triple-quotes for multiline strings`,
				{
					token,
					start,
					end: {
						offset: start.offset + newlineMatch[0].length,
						line: start.line + 1,
						column: 1,
					},
				},
			),
		);
	}

	return value;
}

const reFinalWhitespaceLine =
	/[\x0A\x0B\x0C\x0D\x85\u2028\u2029]([\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)$/;
const reFinalWhitespaceLineIncludingEscapes =
	/(?:^|[^\\\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000])(?:\\\\)*[\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*[\x0A\x0B\x0C\x0D\x85\u2028\u2029]([\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)(?:\\[\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)*$/;
const reNewlineWithLeadingSpace =
	/(\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029])([\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)([^\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]?)/g;
const reLastNonWhitespaceOrNewline =
	/([^\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000])[\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$/;

/**
 * @param {Error[]} errors
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessMultilineRawStringValue(errors, value, token) {
	if (!reNewline.test(value)) {
		errors.push(
			new InvalidKdlError(
				`Raw strings with three quotes must be multiline strings`,
				{token},
			),
		);

		return value;
	}

	if (!reNewline.test(value[0])) {
		errors.push(
			new InvalidKdlError(`Multi-line strings must start with a newline`, {
				token,
			}),
		);

		return value;
	}

	const lastLine = reFinalWhitespaceLine.exec(value)?.[1];

	if (lastLine == null) {
		errors.push(
			new InvalidKdlError(
				`The final line in a multiline string may only contain whitespace`,
				{token},
			),
		);

		return value;
	}

	return (
		value
			.replace(
				reNewlineWithLeadingSpace,
				(_, newline, leadingWhitespace, firstContentCharacter, offset) => {
					if (!firstContentCharacter) {
						return "\n";
					}

					if (!leadingWhitespace.startsWith(lastLine)) {
						const start = computeStartLocation(
							token,
							value,
							offset + newline.length,
						);

						errors.push(
							new InvalidKdlError(
								`Every non-blank line of a multi-line string must start with the offset defined by the last line of the string`,
								{
									token,
									start,
									end: {
										offset: start.offset + lastLine.length,
										line: start.line,
										column: start.column + lastLine.length,
									},
								},
							),
						);

						return "\n";
					}

					return (
						"\n" +
						leadingWhitespace.slice(lastLine.length) +
						firstContentCharacter
					);
				},
			)
			// Cut off the \n after #""" and the final \n before """#
			.slice(1, -1)
	);
}

const reSingleLineEscape =
	/\\(?:$|u\{(0[0-9a-fA-F]{0,5}|10[0-9a-fA-F]{4}|[1-9a-fA-F][0-9a-fA-F]{0,4})\}|u(\{[^}]{1,6}\}?|[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})|([\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+)|.)/g;

/**
 * @param {Error[]} errors
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessStringValue(errors, value, token) {
	// mustn't be a multiline string...
	let unescapedNewlineMatch;
	while ((unescapedNewlineMatch = reAllUnescapedNewline.exec(value))) {
		const start = computeStartLocation(
			token,
			value,
			/** @type {RegExpIndicesArray} */ (unescapedNewlineMatch.indices)[1][0],
		);

		errors.push(
			new InvalidKdlError(
				`Strings with single quotes cannot contain any unescaped newlines, use triple-quotes for multiline strings`,
				{
					token,
					start,
					end: {
						offset: start.offset + unescapedNewlineMatch[1].length,
						line: start.line + 1,
						column: 1,
					},
				},
			),
		);
	}

	return value.replace(
		reSingleLineEscape,
		(escape, unicode, invalidUnicode, whitespace, offset) =>
			replaceEscape(
				errors,
				value,
				token,
				escape,
				unicode,
				invalidUnicode,
				whitespace,
				offset,
			),
	);
}

const reMultiLineNewLineWithWhitespaceOrEscape =
	/(\x0D\x0A|[\x0A\x0B\x0C\x0D\x85\u2028\u2029])([\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)|\\(?:$|u\{(0[0-9a-fA-F]{0,5}|10[0-9a-fA-F]{4}|[1-9a-fA-F][0-9a-fA-F]{0,4})\}|u(\{[^}]{1,6}\}?|[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})|([\x0A\x0B\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+)|.)/g;

/**
 * @param {Error[]} errors
 * @param {string} value
 * @param {Token} token
 * @returns {string}
 */
export function postProcessMultilineStringValue(errors, value, token) {
	if (!reUnescapedNewline.test(value)) {
		errors.push(
			new InvalidKdlError(
				`Strings with three quotes must be multiline strings`,
				{token},
			),
		);

		return value;
	}

	if (!reNewline.test(value[0])) {
		errors.push(
			new InvalidKdlError(`Multi-line strings must start with a newline`, {
				token,
			}),
		);

		return value;
	}

	const lastLine = reFinalWhitespaceLineIncludingEscapes.exec(value)?.[1];

	if (lastLine == null) {
		const match = reLastNonWhitespaceOrNewline.exec(value);
		const start =
			match ? computeStartLocation(token, value, match.index) : undefined;

		let message =
			"The final line in a multiline string may only contain whitespace";
		if (match?.[0][0] === "\\") {
			message += " after removing escaped whitespace";
		}

		errors.push(
			new InvalidKdlError(message, {
				token,
				start,
				end: start && {
					offset: start.offset,
					line: start.line,
					column: start.column + 1,
				},
			}),
		);

		return value;
	}

	return (
		value
			.replace(
				reMultiLineNewLineWithWhitespaceOrEscape,
				(
					match,
					newline,
					leadingWhitespace,
					unicode,
					invalidUnicode,
					whitespace,
					offset,
				) => {
					if (!newline) {
						return replaceEscape(
							errors,
							value,
							token,
							match,
							unicode,
							invalidUnicode,
							whitespace,
							offset,
						);
					}

					const firstContentCharacter =
						value[
							offset +
								newline.length +
								(leadingWhitespace ? leadingWhitespace.length : 0)
						];
					if (reNewline.test(firstContentCharacter)) {
						return "\n";
					}

					if (!leadingWhitespace.startsWith(lastLine)) {
						const start = computeStartLocation(
							token,
							value,
							offset + newline.length,
						);

						errors.push(
							new InvalidKdlError(
								`Every non-blank line of a multi-line string must start with the offset defined by the last line of the string`,
								{
									token,
									start,
									end: {
										offset: start.offset + lastLine.length,
										line: start.line,
										column: start.column + lastLine.length,
									},
								},
							),
						);

						return "\n";
					}

					return "\n" + leadingWhitespace.slice(lastLine.length);
				},
			)
			// Cut off the \n after #""" and the final \n before """#
			.slice(1, -1)
	);
}

/**
 * @param {Error[]} errors
 * @param {string} value
 * @param {Token} token
 * @param {string} escape
 * @param {string} unicode
 * @param {string} invalidUnicode
 * @param {string} whitespace
 * @param {number} offset
 */
function replaceEscape(
	errors,
	value,
	token,
	escape,
	unicode,
	invalidUnicode,
	whitespace,
	offset,
) {
	if (whitespace) {
		return "";
	}

	if (invalidUnicode) {
		const multiline = token.text.startsWith('"""');
		const linesBefore = value.slice(0, offset).split(reNewline);
		const start = {
			offset: token.start.offset + (multiline ? 3 : 1) + offset,
			line: token.start.line + (linesBefore.length - 1),
			column:
				linesBefore.length === 1 ?
					token.start.column + (multiline ? 3 : 1) + offset
				:	/** @type {string} */ (linesBefore.at(-1)).length,
		};
		const end = {
			offset: start.offset + escape.length,
			line: start.line,
			column: start.column + escape.length,
		};

		if (!invalidUnicode.startsWith("{")) {
			errors.push(
				new InvalidKdlError(
					String.raw`Invalid unicode escape "\u${invalidUnicode}", did you forget to use {}? "\u{${invalidUnicode}}"`,
					{token, start, end},
				),
			);
		} else {
			errors.push(
				new InvalidKdlError(
					String.raw`Invalid unicode escape "\u${invalidUnicode.endsWith("}") ? invalidUnicode : `${invalidUnicode}...`}"`,
					{token, start, end},
				),
			);
		}

		return "";
	} else if (unicode) {
		const codePoint = parseInt(unicode, 16);

		// Non-scalar values
		if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
			errors.push(
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
			errors.push(
				new InvalidKdlError(
					escape.length < 2 ?
						"Invalid whitespace escape at the end of a string"
					:	`Invalid escape "${escape}"`,
					{token},
				),
			);

			return "";
		}

		return replacement;
	}
}

/**
 * @param {Token} token
 * @param {string} value
 * @param {number} offset
 * @returns {Location}
 */
function computeStartLocation(token, value, offset) {
	let preludeLength = 1;
	switch (token.type) {
		case T_MULTILINE_QUOTED_STRING:
			preludeLength = 3;
			break;
		case T_RAW_STRING:
			preludeLength = token.text.indexOf('"') + 1;
			break;
		case T_MULTILINE_RAW_STRING:
			preludeLength = token.text.indexOf('"') + 3;
			break;
	}

	const linesBeforeOffset = value.slice(0, offset).split(reNewline);

	return {
		offset: token.start.offset + preludeLength + offset,
		line: token.start.line + (linesBeforeOffset.length - 1),
		column:
			linesBeforeOffset.length === 1 ?
				token.start.column + preludeLength + offset
			:	1 + linesBeforeOffset[linesBeforeOffset.length - 1].length,
	};
}
