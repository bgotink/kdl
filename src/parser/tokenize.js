/**
 * @typedef {object} Location
 * @prop {number} offset
 * @prop {number} line
 * @prop {number} column
 */

import {InvalidKdlError} from "../error.js";

/**
 * @typedef {object} Token
 * @prop {string} type
 * @prop {string} text
 * @prop {Location} start
 * @prop {Location} end
 */

export const T_EOF = "EOF";

export const T_BOM = "BOM";
export const T_SLASHDASH = "/-";
export const T_OPEN_PAREN = "(";
export const T_OPEN_BRACE = "{";
export const T_CLOSE_PAREN = ")";
export const T_CLOSE_BRACE = "}";
export const T_SEMICOLON = ";";

export const T_QUOTED_STRING = "QUOTED_STRING";
export const T_RAW_STRING = "RAW_STRING";
export const T_IDENTIFIER_STRING = "IDENTIFIER_STRING";

export const T_EQUALS = "EQUALS";
export const T_KEYWORD = "KEYWORD";

export const T_NUMBER_HEXADECIMAL = "HEXADECIMAL_NUMBER";
export const T_NUMBER_DECIMAL = "DECIMAL_NUMBER";
export const T_NUMBER_OCTAL = "OCTAL_NUMBER";
export const T_NUMBER_BINARY = "BINARY_NUMBER";

export const T_INLINE_WHITESPACE = "WHITESPACE";
export const T_NEWLINE = "NEWLINE";
export const T_ESCLINE = "ESCLINE";

export const T_COMMENT_SINGLE = "SINGLE_LINE_COMMENT";
export const T_COMMENT_MULTI = "MULTILINE_COMMENT";

/** @param {number} codePoint  */
function isBOM(codePoint) {
	return codePoint === 0xfeff;
}

/** @param {number} codePoint  */
function isUnicodeSpace(codePoint) {
	return (
		codePoint === 0x0009 || // Character Tabulation
		codePoint === 0x000b || // Line Tabulation
		codePoint === 0x0020 || // Space
		codePoint === 0x00a0 || // No-Break Space
		codePoint === 0x1680 || // Ogham Space Mark
		codePoint === 0x2000 || // En Quad
		codePoint === 0x2001 || // Em Quad
		codePoint === 0x2002 || // En Space
		codePoint === 0x2003 || // Em Space
		codePoint === 0x2004 || // Three-Per-Em Space
		codePoint === 0x2005 || // Four-Per-Em Space
		codePoint === 0x2006 || // Six-Per-Em Space
		codePoint === 0x2007 || // Figure Space
		codePoint === 0x2008 || // Punctuation Space
		codePoint === 0x2009 || // Thin Space
		codePoint === 0x200a || // Hair Space
		codePoint === 0x202f || // Narrow No-Break Space
		codePoint === 0x205f || // Medium Mathematical Space
		codePoint === 0x3000 || // Ideographic Space
		false
	);
}

/** @param {number} codePoint */
function isNewLine(codePoint) {
	return (
		codePoint === 0x0d || // Carriage Return
		codePoint === 0x0a || // Line Feed
		codePoint === 0x85 || // Next Line
		codePoint === 0x0c || // Form Feed
		codePoint === 0x2028 || // Line Separator
		codePoint === 0x2029 || // Paragraph Separator
		false
	);
}

/** @param {number} codePoint */
function isInvalidCharacter(codePoint) {
	return (
		// Everything < \x20 except those that count as whitespace
		codePoint < 0x08 ||
		(codePoint >= 0x0e && codePoint <= 0x19) ||
		// Delete
		codePoint === 0x7f ||
		// Non-scalar values
		(codePoint >= 0xd800 && codePoint <= 0xdfff) ||
		// Direction control characters
		codePoint === 0x200e ||
		codePoint === 0x200f ||
		(codePoint >= 0x202a && codePoint <= 0x202e) ||
		(codePoint >= 0x2066 && codePoint <= 0x2069) ||
		// BOM is only valid at the start, otherwise it counts as invalid
		codePoint === 0xfeff
	);
}

/** @param {number} codePoint */
function isEqualsSign(codePoint) {
	return (
		codePoint === 0x003d || // EQUALS SIGN =
		codePoint === 0xfe66 || // SMALL EQUALS SIGN ﹦
		codePoint === 0xff1d || // FULLWIDTH EQUALS SIGN ＝
		codePoint === 0x1f7f0 || // HEAVY EQUALS SIGN 🟰
		false
	);
}

/** @param {number} codePoint */
function isIdentifierChar(codePoint) {
	return (
		!isNaN(codePoint) &&
		!isUnicodeSpace(codePoint) &&
		!isNewLine(codePoint) &&
		!isEqualsSign(codePoint) &&
		!isInvalidCharacter(codePoint) &&
		codePoint !== 0x5c && // \
		codePoint !== 0x2f && // /
		codePoint !== 0x28 && // (
		codePoint !== 0x29 && // )
		codePoint !== 0x7b && // {
		codePoint !== 0x7d && // }
		codePoint !== 0x3b && // ;
		codePoint !== 0x5b && // [
		codePoint !== 0x5d && // ]
		codePoint !== 0x22 && // "
		codePoint !== 0x23 && // #
		true
	);
}

/** @param {number} codePoint */
function isHexadecimalDigit(codePoint) {
	return (
		(codePoint >= 0x30 && codePoint < 0x40) || // decimal
		(codePoint >= 0x41 && codePoint < 0x47) || // A-F
		(codePoint >= 0x61 && codePoint < 0x67) || // a-f
		false
	);
}

/** @param {number} codePoint */
function isHexadecimalDigitOrUnderscore(codePoint) {
	return isHexadecimalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
function isDecimalDigit(codePoint) {
	return codePoint >= 0x30 && codePoint < 0x3a;
}

/** @param {number} codePoint */
function isDecimalDigitOrUnderscore(codePoint) {
	return isDecimalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
function isOctalDigit(codePoint) {
	return codePoint >= 0x30 && codePoint < 0x38;
}

/** @param {number} codePoint */
function isOctalDigitOrUnderscore(codePoint) {
	return isOctalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
function isBinaryDigit(codePoint) {
	return codePoint === 0x30 || codePoint === 0x31;
}

/** @param {number} codePoint */
function isBinaryDigitOrUnderscore(codePoint) {
	return isBinaryDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
function isNumberSign(codePoint) {
	return codePoint === 0x2d || codePoint === 0x2b;
}

/** @type {Intl.Segmenter=} */
let segmenter;

/** @param {string} text */
function* iterateGraphemes(text) {
	// We don't have to pass in any locale(s), but then the segmenter would
	// default to the configured locale(s) in node or the OS, and do we want to
	// yield different behaviour based on Node / OS settings? Let's go with no
	for (const segment of (segmenter ??= new Intl.Segmenter("en")).segment(
		text,
	)) {
		yield segment.segment;
	}
}

/**
 * @param {string} text
 * @returns {Iterator<string, void>}
 */
function iterateCodePoints(text) {
	return text[Symbol.iterator]();
}

/**
 * @param {string} text
 * @returns {Generator<Token, void>}
 */
export function* tokenize(text, {graphemeLocations = false} = {}) {
	let line = 1;
	let column = 1;
	let offset = 0;

	const {length} = text;

	const iterator =
		graphemeLocations ? iterateGraphemes(text) : iterateCodePoints(text);

	let currentIter = iterator.next();

	/**
	 * The first code point of the iterator's last result, or NaN if the iterator has ended
	 *
	 * While the last result can consist of multiple code points, we can limit
	 * ourselves to only looking at the first code point:
	 *
	 * - We don't have special handling for any grapheme that contains multiple
	 *   code points, those are all either string content or part of an identifier
	 * - "\r\n" is the only exception, which we want to count as a single newline,
	 *   and by looking at the first code point we can easily handle that.
	 */
	let current =
		currentIter.done ? NaN : (
			/** @type {number} */ (currentIter.value.codePointAt(0))
		);

	let start = {line, column, offset};

	if (consume(isBOM)) {
		// don't let BOM count as column
		column = 1;
		yield mkToken(T_BOM);
	}

	if (isInvalidCharacter(current)) {
		throw mkError(`Invalid character \\u${current.toString(16)}`);
	}

	outer: while (!currentIter.done) {
		if (consume(isEqualsSign)) {
			yield mkToken(T_EQUALS);
			continue;
		}

		if (consume(isUnicodeSpace)) {
			zerOrMore(isUnicodeSpace);
			yield mkToken(T_INLINE_WHITESPACE);
			continue;
		}

		if (consumeNewline()) {
			yield mkToken(T_NEWLINE);
			continue;
		}

		if (consumeCodePoint(0x7b)) {
			// {
			yield mkToken(T_OPEN_BRACE);
			continue;
		}
		if (consumeCodePoint(0x7d)) {
			// }
			yield mkToken(T_CLOSE_BRACE);
			continue;
		}
		if (consumeCodePoint(0x28)) {
			// (
			yield mkToken(T_OPEN_PAREN);
			continue;
		}
		if (consumeCodePoint(0x29)) {
			// )
			yield mkToken(T_CLOSE_PAREN);
			continue;
		}
		if (consumeCodePoint(0x3b)) {
			// ;
			yield mkToken(T_SEMICOLON);
			continue;
		}
		if (consumeCodePoint(0x5c)) {
			// backslash
			yield mkToken(T_ESCLINE);
			continue;
		}

		if (consumeCodePoint(0x23)) {
			// #

			if (current === 0x23 || current === 0x22) {
				// ## or #" -> raw string

				let numberOfOpeningHashes = 1;

				while (consumeCodePoint(0x23)) {
					numberOfOpeningHashes++;
				}

				if (!consumeCodePoint(0x22)) {
					throw mkError(
						`Expected a quote after ${"#".repeat(numberOfOpeningHashes)}`,
					);
				}

				while (true) {
					if (offset > length) {
						throw new InvalidKdlError(
							"Unexpected EOF while parsing raw string",
						);
					}

					if (consumeCodePoint(0x22)) {
						let numberOfClosingHashes = 0;
						while (
							numberOfClosingHashes < numberOfOpeningHashes &&
							consumeCodePoint(0x23)
						) {
							numberOfClosingHashes++;
						}

						if (numberOfClosingHashes === numberOfOpeningHashes) {
							yield mkToken(T_RAW_STRING);
							continue outer;
						}
					} else {
						consumeNewline() || pop();
					}
				}
			} else {
				// #<something>, either a keyword or invalid

				// allow - at the start
				consumeCodePoint(0x2d);

				zerOrMore(isIdentifierChar);

				yield mkToken(T_KEYWORD);
				continue;
			}
		}

		if (consumeCodePoint(0x22)) {
			// " -> quoted string

			while (current !== 0x22 && offset < length) {
				// backslash, skip the next character
				consumeCodePoint(0x5c);

				consumeNewline() || pop();
			}

			if (!consumeCodePoint(0x22)) {
				throw mkError("Unexpected EOF inside string");
			}

			yield mkToken(T_QUOTED_STRING);
			continue;
		}

		if (consume(isNumberSign)) {
			if (isDecimalDigit(current)) {
				// [0-9]

				if (consumeCodePoint(0x30)) {
					// 0 -> handle 0x | 0b | 0o

					switch (current) {
						case 0x62: // b
							pop();
							require(isBinaryDigit, "Invalid binary number");
							zerOrMore(isBinaryDigitOrUnderscore);

							yield mkToken(T_NUMBER_BINARY);
							continue;
						case 0x6f: // o
							pop();
							require(isOctalDigit, "Invalid octal number");
							zerOrMore(isOctalDigitOrUnderscore);

							yield mkToken(T_NUMBER_OCTAL);
							continue;
						case 0x78: // x
							pop();
							require(isHexadecimalDigit, "Invalid hexadecimal number");
							zerOrMore(isHexadecimalDigitOrUnderscore);

							yield mkToken(T_NUMBER_HEXADECIMAL);
							continue;
					}
				}

				zerOrMore(isDecimalDigitOrUnderscore);

				if (consumeCodePoint(0x2e)) {
					// .

					require(isDecimalDigit, "Invalid decimal number");
					zerOrMore(isDecimalDigitOrUnderscore);
				}

				if (consumeCodePoint(0x65) || consumeCodePoint(0x45)) {
					// e | E

					consume(isNumberSign);

					require(isDecimalDigit, "Invalid decimal number");
					zerOrMore(isDecimalDigitOrUnderscore);
				}

				yield mkToken(T_NUMBER_DECIMAL);
				continue;
			} else if (consumeCodePoint(0x2e)) {
				// .

				if (consume(isDecimalDigit)) {
					throw mkError(`Invalid identifier`);
				}

				zerOrMore(isIdentifierChar);

				yield mkToken(T_IDENTIFIER_STRING);
				continue;
			} else {
				zerOrMore(isIdentifierChar);

				yield mkToken(T_IDENTIFIER_STRING);
				continue;
			}
		}

		if (consumeCodePoint(0x2e)) {
			// .

			if (consume(isDecimalDigit)) {
				throw mkError(`Invalid identifier`);
			}

			zerOrMore(isIdentifierChar);

			yield mkToken(T_IDENTIFIER_STRING);
			continue;
		}

		if (isDecimalDigit(current)) {
			if (consumeCodePoint(0x30)) {
				// 0 -> handle 0x | 0b | 0o

				switch (current) {
					case 0x62: // b
						pop();
						require(isBinaryDigit, "Invalid binary number");
						zerOrMore(isBinaryDigitOrUnderscore);

						yield mkToken(T_NUMBER_BINARY);
						continue;
					case 0x6f: // o
						pop();
						require(isOctalDigit, "Invalid octal number");
						zerOrMore(isOctalDigitOrUnderscore);

						yield mkToken(T_NUMBER_OCTAL);
						continue;
					case 0x78: // x
						pop();
						require(isHexadecimalDigit, "Invalid hexadecimal number");
						zerOrMore(isHexadecimalDigitOrUnderscore);

						yield mkToken(T_NUMBER_HEXADECIMAL);
						continue;
				}
			}

			zerOrMore(isDecimalDigitOrUnderscore);

			if (consumeCodePoint(0x2e)) {
				// .

				require(isDecimalDigit, "Invalid decimal number");
				zerOrMore(isDecimalDigitOrUnderscore);
			}

			if (consumeCodePoint(0x65) || consumeCodePoint(0x45)) {
				// e | E

				consume(isNumberSign);

				require(isDecimalDigit, "Invalid decimal number");
				zerOrMore(isDecimalDigitOrUnderscore);
			}

			yield mkToken(T_NUMBER_DECIMAL);
			continue;
		}

		if (consumeCodePoint(0x2f)) {
			// slash

			if (consumeCodePoint(0x2d)) {
				// slash-dash

				yield mkToken(T_SLASHDASH);
				continue;
			} else if (consumeCodePoint(0x2f)) {
				// --> //

				while (offset < length && !isNewLine(current)) {
					pop();
				}

				yield mkToken(T_COMMENT_SINGLE);
				continue;
			} else if (consumeCodePoint(0x2a)) {
				// --> /*

				let level = 1;

				while (offset < length) {
					if (consumeCodePoint(0x2a)) {
						if (consumeCodePoint(0x2f)) {
							// --> */

							level--;

							if (level === 0) {
								yield mkToken(T_COMMENT_MULTI);
								continue outer;
							}
						}
					} else if (consumeCodePoint(0x2f)) {
						if (consumeCodePoint(0x2a)) {
							// --> /*
							level++;
						}
					} else {
						consumeNewline() || pop();
					}
				}

				throw mkError("Unexpected EOF in multiline comment" + level);
			}
		}

		if (consume(isIdentifierChar)) {
			zerOrMore(isIdentifierChar);
			yield mkToken(T_IDENTIFIER_STRING);
			continue;
		}

		throw mkError(
			`Unexpected character ${JSON.stringify(String.fromCodePoint(current))}, did you forget to quote an identifier\?`,
		);
	}

	yield mkToken(T_EOF);

	function pop() {
		offset += /** @type {string} */ (currentIter.value).length;
		column++;

		currentIter = iterator.next();
		current =
			currentIter.done ? NaN : (
				/** @type {number} */ (currentIter.value.codePointAt(0))
			);

		if (isInvalidCharacter(current)) {
			throw mkError(`Invalid character \\u${current.toString(16)}`);
		}

		return current;
	}

	/** @param {(codePoint: number) => boolean} test */
	function consume(test) {
		if (test(current)) {
			const previous = current;
			pop();
			return previous;
		}
	}

	/**
	 * Consume the current code point if it matches the given code point
	 *
	 * @param {number} codePoint
	 */
	function consumeCodePoint(codePoint) {
		if (current === codePoint) {
			pop();
			return codePoint;
		}
	}

	function consumeNewline() {
		if (!isNewLine(current)) {
			return false;
		}

		// consume \r\n as a single newline
		if (
			!graphemeLocations &&
			current === 0x0d &&
			text.codePointAt(offset + 1) === 0x0a
		) {
			iterator.next();
			offset++;
		}

		pop();

		column = 1;
		line++;

		return true;
	}

	/**
	 * @param {(codePoint: number) => boolean} test
	 * @param {string} message
	 */
	function require(test, message) {
		if (test(current)) {
			const previous = current;
			pop();
			return previous;
		}

		throw mkError(message);
	}

	/** @param {(codePoint: number) => boolean} test */
	function zerOrMore(test) {
		while (test(current)) {
			pop();
		}
	}

	/**
	 * @param {string} type
	 * @returns {Token}
	 */
	function mkToken(type) {
		const end = {line, column, offset};
		const s = start;

		start = end;

		return {
			type,
			text: text.slice(s.offset, end.offset),
			start: s,
			end,
		};
	}

	/**
	 * @param {string} message
	 */
	function mkError(message) {
		return new InvalidKdlError(`${message} at ${line}:${column}`);
	}
}
