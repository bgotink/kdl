import {InvalidKdlError} from "../error.js";

/** @import {Token} from "./token.js" */

export const T_EOF = 1;

export const T_BOM = 2;
export const T_SLASHDASH = 3;
export const T_OPEN_PAREN = 4;
export const T_OPEN_BRACE = 5;
export const T_CLOSE_PAREN = 6;
export const T_CLOSE_BRACE = 7;
export const T_SEMICOLON = 8;

export const T_QUOTED_STRING = 9;
export const T_RAW_STRING = 10;
export const T_IDENTIFIER_STRING = 11;

export const T_EQUALS = 12;
export const T_KEYWORD = 13;

export const T_NUMBER_HEXADECIMAL = 14;
export const T_NUMBER_DECIMAL = 15;
export const T_NUMBER_OCTAL = 16;
export const T_NUMBER_BINARY = 17;

export const T_INLINE_WHITESPACE = 18;
export const T_NEWLINE = 19;
export const T_ESCLINE = 20;

export const T_COMMENT_SINGLE = 21;
export const T_COMMENT_MULTI = 22;

export const T_MULTILINE_QUOTED_STRING = 23;
export const T_MULTILINE_RAW_STRING = 24;

/** @param {number} codePoint  */
function isBOM(codePoint) {
	return codePoint === 0xfeff;
}

/** @param {number} codePoint  */
function isUnicodeSpace(codePoint) {
	return (
		codePoint === 0x0009 || // Character Tabulation
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
		codePoint === 0x0b || // Line Tabulation
		codePoint === 0x0c || // Form Feed
		codePoint === 0x2028 || // Line Separator
		codePoint === 0x2029 || // Paragraph Separator
		false
	);
}

/** @param {number} codePoint */
export function isInvalidCharacter(codePoint) {
	return (
		// Everything < \x20 except those that count as whitespace
		codePoint < 0x08 ||
		(codePoint >= 0x0e && codePoint <= 0x19) ||
		// Delete
		codePoint === 0x7f ||
		// Non-scalar values
		(codePoint >= 0xd800 && codePoint <= 0xdfff) ||
		codePoint > 0x10ffff ||
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
export function isIdentifierChar(codePoint) {
	// All other functions check whether the code point is one of a set of values,
	// this check does the opposite, it checks that the code point doesn't have
	// certain values.
	// That means this check has to explicitly check for EOF, which we represent
	// using NaN.
	return (
		!isNaN(codePoint) &&
		!isUnicodeSpace(codePoint) &&
		!isNewLine(codePoint) &&
		codePoint !== 0x3d && // =
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

// Yay, global state!
// Actually, we more or less have to make this state global for the sake of performance.
// If we scope these variables to the tokenize function, then we also have to move any functions that modify the variables to that scope.
// Redefining those functions for every call to tokenize results in a 25% slowdown in our benchmark.

let text = "";
let line = 1,
	column = 1,
	offset = 0;
let length = 0;
/** @type {Iterator<string, void, any>} */
let iterator;
/** @type {IteratorResult<string, void>} */
let currentIter;
let current = NaN;
let start = {line, column, offset};
let graphemeLocations = false;
/** @type {Error[] | null} */
let errorsInToken = null;

/**
 * @param {string} t
 * @param {{graphemeLocations?: boolean}} opts
 * @returns {Generator<Token, void>}
 */
export function* tokenize(t, opts) {
	text = t;
	graphemeLocations = opts.graphemeLocations ?? false;

	line = 1;
	column = 1;
	offset = 0;

	length = text.length;

	iterator =
		graphemeLocations ? iterateGraphemes(text) : iterateCodePoints(text);

	currentIter = iterator.next();

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
	current =
		currentIter.done ? NaN : (
			/** @type {number} */ (currentIter.value.codePointAt(0))
		);

	start = {line, column, offset};

	if (consume(isBOM)) {
		// don't let BOM count as column
		column = 1;
		yield mkToken(T_BOM);
	}

	if (isInvalidCharacter(current)) {
		throw mkError(`Invalid character \\u${current.toString(16)}`);
	}

	outer: while (!currentIter.done) {
		if (consumeCodePoint(0x3d)) {
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

				let multiline = false;
				if (consumeCodePoint(0x22)) {
					// #"" -> either #""# or multiline string
					if (consumeCodePoint(0x22)) {
						// three quotes! yay

						if (current === 0x22) {
							// That's too many quotes
							throw mkError(
								"Multiline strings must start with exactly three quotes",
							);
						}

						multiline = true;
					} else {
						let numberOfClosingHashes = 0;

						while (consumeCodePoint(0x23)) {
							numberOfClosingHashes++;
						}

						if (numberOfClosingHashes === numberOfOpeningHashes) {
							yield mkToken(T_RAW_STRING);
							continue;
						}
					}
				}

				while (true) {
					if (offset >= length) {
						throw mkError("Unexpected EOF while parsing raw string");
					}

					if (consumeCodePoint(0x22)) {
						if (multiline) {
							if (!consumeCodePoint(0x22) || !consumeCodePoint(0x22)) {
								continue;
							}
						}

						let numberOfClosingHashes = 0;
						while (
							numberOfClosingHashes < numberOfOpeningHashes &&
							consumeCodePoint(0x23)
						) {
							numberOfClosingHashes++;
						}

						if (numberOfClosingHashes === numberOfOpeningHashes) {
							yield mkToken(multiline ? T_MULTILINE_RAW_STRING : T_RAW_STRING);
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

			let multiline = false;
			if (consumeCodePoint(0x22)) {
				// "" -> either empty or multiline string
				if (!consumeCodePoint(0x22)) {
					// only two quotes
					yield mkToken(T_QUOTED_STRING);
					continue;
				}

				if (current === 0x22) {
					throw mkError(
						"Multiline strings must start with exactly three quotes",
					);
				}

				multiline = true;
			}

			let finished = false;
			while (offset < length) {
				// backslash, skip the next character
				if (consumeCodePoint(0x5c)) {
					consumeNewline() || pop();
				} else {
					if (
						consumeCodePoint(0x22) &&
						(!multiline || (consumeCodePoint(0x22) && consumeCodePoint(0x22)))
					) {
						finished = true;
						break;
					}

					consumeNewline() || pop();
				}
			}

			if (!finished) {
				throw mkError("Unexpected EOF inside string");
			}

			yield mkToken(multiline ? T_MULTILINE_QUOTED_STRING : T_QUOTED_STRING);
			continue;
		}

		if (consume(isNumberSign)) {
			if (isDecimalDigit(current)) {
				// [0-9]

				if (consumeCodePoint(0x30)) {
					// 0 -> handle 0x | 0b | 0o

					switch (current) {
						case 0x62: // b
							current = pop();

							if (!consume(isBinaryDigit)) {
								if (current === 0x5f) {
									// _
									(errorsInToken ??= []).push(
										mkError(
											"Invalid hexadecimal number, the first character after 0x cannot be an underscore",
										),
									);
								} else {
									zerOrMore(isIdentifierChar);
									yield mkToken(
										T_IDENTIFIER_STRING,
										"Invalid hexadecimal number",
									);
									continue;
								}
							}

							zerOrMore(isBinaryDigitOrUnderscore);

							yield mkToken(T_NUMBER_BINARY);
							continue;
						case 0x6f: // o
							current = pop();

							if (!consume(isOctalDigit)) {
								if (current === 0x5f) {
									// _
									(errorsInToken ??= []).push(
										mkError(
											"Invalid hexadecimal number, the first character after 0x cannot be an underscore",
										),
									);
								} else {
									zerOrMore(isIdentifierChar);
									yield mkToken(
										T_IDENTIFIER_STRING,
										"Invalid hexadecimal number",
									);
									continue;
								}
							}

							zerOrMore(isOctalDigitOrUnderscore);

							yield mkToken(T_NUMBER_OCTAL);
							continue;
						case 0x78: // x
							current = pop();

							if (!consume(isHexadecimalDigit)) {
								if (current === 0x5f) {
									// _
									(errorsInToken ??= []).push(
										mkError(
											"Invalid hexadecimal number, the first character after 0x cannot be an underscore",
										),
									);
								} else {
									zerOrMore(isIdentifierChar);
									yield mkToken(
										T_IDENTIFIER_STRING,
										"Invalid hexadecimal number",
									);
									continue;
								}
							}

							zerOrMore(isHexadecimalDigitOrUnderscore);

							yield mkToken(T_NUMBER_HEXADECIMAL);
							continue;
					}
				}

				zerOrMore(isDecimalDigitOrUnderscore);

				if (consumeCodePoint(0x2e)) {
					// .

					if (!consume(isDecimalDigit)) {
						if (current === 0x5f) {
							// _
							(errorsInToken ??= []).push(
								mkError(
									"Invalid decimal number, the part after the decimal point mustn't start on an underscore",
								),
							);
						} else {
							(errorsInToken ??= []).push(
								mkError(
									"Invalid decimal number, a decimal point must be followed by a digit",
								),
							);
						}
					}

					zerOrMore(isDecimalDigitOrUnderscore);
				}

				if (consumeCodePoint(0x65) || consumeCodePoint(0x45)) {
					// e | E

					consume(isNumberSign);

					if (!consume(isDecimalDigit)) {
						if (current === 0x5f) {
							// _
							(errorsInToken ??= []).push(
								mkError(
									"Invalid decimal number, the number after the exponent mustn't start on an underscore",
								),
							);
						} else {
							zerOrMore(isIdentifierChar);

							yield mkToken(
								T_NUMBER_DECIMAL,
								"Invalid decimal number, missing a number after the exponent",
							);
							continue;
						}
					}

					zerOrMore(isDecimalDigitOrUnderscore);
				}

				yield mkToken(T_NUMBER_DECIMAL);
				continue;
			} else if (consumeCodePoint(0x2e)) {
				// .

				if (consume(isDecimalDigit)) {
					zerOrMore(isIdentifierChar);
					yield mkToken(
						T_IDENTIFIER_STRING,
						"Invalid identifier or number, surround with quotes to make it an identifier or add a zero between the sign and the decimal point",
					);
					continue;
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
				zerOrMore(isIdentifierChar);
				yield mkToken(
					T_IDENTIFIER_STRING,
					"Invalid identifier, identifiers that start with a sign and a dot must be quoted if the next character is a digit to prevent confusion with decimal numbers",
				);
				continue;
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
						current = pop();

						if (!consume(isBinaryDigit)) {
							if (current === 0x5f) {
								// _
								(errorsInToken ??= []).push(
									mkError(
										"Invalid binary number, the first character after 0b cannot be an underscore",
									),
								);
							} else {
								zerOrMore(isIdentifierChar);
								yield mkToken(T_IDENTIFIER_STRING, "Invalid binary number");
								continue;
							}
						}

						zerOrMore(isBinaryDigitOrUnderscore);

						yield mkToken(T_NUMBER_BINARY);
						continue;
					case 0x6f: // o
						current = pop();

						if (!consume(isOctalDigit)) {
							if (current === 0x5f) {
								// _
								(errorsInToken ??= []).push(
									mkError(
										"Invalid octal number, the first character after 0o cannot be an underscore",
									),
								);
							} else {
								zerOrMore(isIdentifierChar);
								yield mkToken(T_IDENTIFIER_STRING, "Invalid octal number");
								continue;
							}
						}

						zerOrMore(isOctalDigitOrUnderscore);

						yield mkToken(T_NUMBER_OCTAL);
						continue;
					case 0x78: // x
						current = pop();

						if (!consume(isHexadecimalDigit)) {
							if (current === 0x5f) {
								// _
								(errorsInToken ??= []).push(
									mkError(
										"Invalid hexadecimal number, the first character after 0x cannot be an underscore",
									),
								);
							} else {
								zerOrMore(isIdentifierChar);
								yield mkToken(
									T_IDENTIFIER_STRING,
									"Invalid hexadecimal number",
								);
								continue;
							}
						}

						zerOrMore(isHexadecimalDigitOrUnderscore);

						yield mkToken(T_NUMBER_HEXADECIMAL);
						continue;
				}
			}

			zerOrMore(isDecimalDigitOrUnderscore);

			if (consumeCodePoint(0x2e)) {
				// .

				if (!consume(isDecimalDigit)) {
					if (current === 0x5f) {
						// _
						(errorsInToken ??= []).push(
							mkError(
								"Invalid decimal number, the part after the decimal point mustn't start on an underscore",
							),
						);
					} else {
						(errorsInToken ??= []).push(
							mkError(
								"Invalid decimal number, a decimal point must be followed by a digit",
							),
						);
					}
				}

				zerOrMore(isDecimalDigitOrUnderscore);
			}

			if (consumeCodePoint(0x65) || consumeCodePoint(0x45)) {
				// e | E

				consume(isNumberSign);

				if (!consume(isDecimalDigit)) {
					if (current === 0x5f) {
						// _
						(errorsInToken ??= []).push(
							mkError(
								"Invalid decimal number, the number after the exponent mustn't start on an underscore",
							),
						);
					} else {
						zerOrMore(isIdentifierChar);

						yield mkToken(
							T_NUMBER_DECIMAL,
							"Invalid decimal number, missing a number after the exponent",
						);
						continue;
					}
				}

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

				throw mkError("Unexpected EOF in multiline comment");
			}
		}

		if (consume(isIdentifierChar)) {
			zerOrMore(isIdentifierChar);
			yield mkToken(T_IDENTIFIER_STRING);
			continue;
		}

		throw mkError(
			`Unexpected character ${JSON.stringify(String.fromCodePoint(current))}, did you forget to quote an identifier?`,
		);
	}

	cleanup();
	yield mkToken(T_EOF);
}

function pop() {
	offset += /** @type {string} */ (currentIter.value).length;
	column++;

	currentIter = iterator.next();
	current =
		currentIter.done ? NaN : (
			/** @type {number} */ (currentIter.value.codePointAt(0))
		);

	if (isInvalidCharacter(current)) {
		if ((current >= 0xd800 && current <= 0xdfff) || current > 0x10ffff) {
			// Non-scalar value, cannot be represented whatsoever
			(errorsInToken ??= []).push(
				mkError(`Invalid character \\u${current.toString(16)}`),
			);
		} else {
			(errorsInToken ??= []).push(
				mkError(
					`Invalid character \\u${current.toString(16)}, this character is not allowed but can be included in strings as \\u{${current.toString(16)}}`,
				),
			);
		}
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

/** @param {(codePoint: number) => boolean} test */
function zerOrMore(test) {
	while (test(current)) {
		pop();
	}
}

/**
 * @param {number} type
 * @param {string?=} error
 * @returns {Token}
 */
function mkToken(type, error) {
	const end = {line, column, offset};
	const s = start;

	start = end;

	/** @type {Error[] | null} */
	let errors = null;
	if (errorsInToken) {
		errors = errorsInToken;
		errorsInToken = null;
	}

	/** @type {Token} */
	const token = {
		type,
		text: text.slice(s.offset, end.offset),
		start: s,
		end,
		errors,
	};

	if (error) {
		(token.errors ??= []).push(new InvalidKdlError(error, {token}));
	}

	return token;
}

/**
 * Create an error based on the current token and location
 *
 * @param {string} message
 */
function mkError(message) {
	const start = {line, column, offset};
	let end;

	if (offset < length) {
		if (isNewLine(current)) {
			end = {line: line + 1, column: 1, offset: offset + 1};
		} else {
			end = {line, column: column + 1, offset: offset + 1};
		}
	}

	return new InvalidKdlError(`${message}`, {start, end});
}

/**
 * Clean up a few global variables to make sure we don't needlessly retain them in memory
 */
function cleanup() {
	text = "";
	// @ts-ignore
	iterator = currentIter = null;
}
