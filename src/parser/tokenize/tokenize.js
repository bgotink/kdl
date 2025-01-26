import {
	consume,
	consumeCodePoint,
	consumeNewline,
	createContext,
	init,
	mkError,
	mkToken,
	pop,
	pushError,
	zerOrMore,
} from "./context.js";
import {
	T_CLOSE_BRACE,
	T_CLOSE_PAREN,
	T_COMMENT_MULTI,
	T_COMMENT_SINGLE,
	T_EOF,
	T_EQUALS,
	T_ESCLINE,
	T_IDENTIFIER_STRING,
	T_INLINE_WHITESPACE,
	T_KEYWORD,
	T_MULTILINE_QUOTED_STRING,
	T_MULTILINE_RAW_STRING,
	T_NEWLINE,
	T_NUMBER_BINARY,
	T_NUMBER_DECIMAL,
	T_NUMBER_HEXADECIMAL,
	T_NUMBER_OCTAL,
	T_OPEN_BRACE,
	T_OPEN_PAREN,
	T_QUOTED_STRING,
	T_RAW_STRING,
	T_SEMICOLON,
	T_SLASHDASH,
	isBinaryDigit,
	isBinaryDigitOrUnderscore,
	isDecimalDigit,
	isDecimalDigitOrUnderscore,
	isHexadecimalDigit,
	isHexadecimalDigitOrUnderscore,
	isIdentifierChar,
	isNewLine,
	isNumberSign,
	isOctalDigit,
	isOctalDigitOrUnderscore,
	isUnicodeSpace,
} from "./types.js";

/** @import {Token} from "../token.js" */

/** @import {TokenizeContext} from "./context.js" */

/** @param {number} type */
export function createSingleCharacterToken(type) {
	/** @param {TokenizeContext} ctx */
	return (ctx) => {
		pop(ctx);
		return mkToken(ctx, type);
	};
}

/** @param {TokenizeContext} ctx */
export function handleWhitespaceCharacter(ctx) {
	zerOrMore(ctx, isUnicodeSpace);
	return mkToken(ctx, T_INLINE_WHITESPACE);
}

/** @param {TokenizeContext} ctx */
export function handleNewlineCharacter(ctx) {
	consumeNewline(ctx);
	return mkToken(ctx, T_NEWLINE);
}

/** @param {TokenizeContext} ctx */
export function handleQuoteCharacter(ctx) {
	pop(ctx);

	let finished = false;
	let multiline = false;
	if (consumeCodePoint(ctx, 0x22)) {
		// "" -> either empty or multiline string
		if (!consumeCodePoint(ctx, 0x22)) {
			// only two quotes
			return mkToken(ctx, T_QUOTED_STRING);
		}

		multiline = true;

		if (ctx.current === 0x22) {
			throw mkError(
				ctx,
				"Multiline strings must start with exactly three quotes",
			);
		}

		while (!finished && ctx.offset < ctx.length) {
			if (consumeCodePoint(ctx, 0x22)) {
				if (consumeCodePoint(ctx, 0x22) && consumeCodePoint(ctx, 0x22)) {
					finished = true;
				}
			} else {
				consumeCodePoint(ctx, 0x5c);

				consumeNewline(ctx) || pop(ctx);
			}
		}
	} else {
		while (!finished && ctx.offset < ctx.length) {
			if (consumeCodePoint(ctx, 0x22)) {
				finished = true;
			} else {
				consumeCodePoint(ctx, 0x5c);

				consumeNewline(ctx) || pop(ctx);
			}
		}
	}

	if (!finished) {
		throw mkError(ctx, "Unexpected EOF inside string");
	}

	return mkToken(ctx, multiline ? T_MULTILINE_QUOTED_STRING : T_QUOTED_STRING);
}

/** @param {TokenizeContext} ctx */
export function handleHashCharacter(ctx) {
	pop(ctx);

	if (ctx.current === 0x23 || ctx.current === 0x22) {
		// ## or #" -> raw string

		let numberOfOpeningHashes = 1;

		while (consumeCodePoint(ctx, 0x23)) {
			numberOfOpeningHashes++;
		}

		if (!consumeCodePoint(ctx, 0x22)) {
			throw mkError(
				ctx,
				`Expected a quote after ${"#".repeat(numberOfOpeningHashes)}`,
			);
		}

		let multiline = false;
		if (consumeCodePoint(ctx, 0x22)) {
			// #"" -> either #""# or multiline string
			if (consumeCodePoint(ctx, 0x22)) {
				// three quotes! yay

				if (ctx.current === 0x22) {
					// That's too many quotes
					throw mkError(
						ctx,
						"Multiline strings must start with exactly three quotes",
					);
				}

				multiline = true;
			} else {
				let numberOfClosingHashes = 0;

				while (consumeCodePoint(ctx, 0x23)) {
					numberOfClosingHashes++;
				}

				if (numberOfClosingHashes === numberOfOpeningHashes) {
					return mkToken(ctx, T_RAW_STRING);
				}
			}
		}

		while (true) {
			if (ctx.offset >= ctx.length) {
				throw mkError(ctx, "Unexpected EOF while parsing raw string");
			}

			if (consumeCodePoint(ctx, 0x22)) {
				if (multiline) {
					if (!consumeCodePoint(ctx, 0x22) || !consumeCodePoint(ctx, 0x22)) {
						continue;
					}
				}

				let numberOfClosingHashes = 0;
				while (
					numberOfClosingHashes < numberOfOpeningHashes &&
					consumeCodePoint(ctx, 0x23)
				) {
					numberOfClosingHashes++;
				}

				if (numberOfClosingHashes === numberOfOpeningHashes) {
					return mkToken(
						ctx,
						multiline ? T_MULTILINE_RAW_STRING : T_RAW_STRING,
					);
				}
			} else {
				consumeNewline(ctx) || pop(ctx);
			}
		}
	} else {
		// #<something>, either a keyword or invalid

		// allow - at the start
		consumeCodePoint(ctx, 0x2d);

		zerOrMore(ctx, isIdentifierChar);

		return mkToken(ctx, T_KEYWORD);
	}
}

/** @param {TokenizeContext} ctx */
export function handleDotCharacter(ctx) {
	pop(ctx);

	if (consume(ctx, isDecimalDigit)) {
		zerOrMore(ctx, isIdentifierChar);
		return mkToken(
			ctx,
			T_IDENTIFIER_STRING,
			"Invalid identifier, identifiers that start with a sign and a dot must be quoted if the next character is a digit to prevent confusion with decimal numbers",
		);
	}

	zerOrMore(ctx, isIdentifierChar);

	return mkToken(ctx, T_IDENTIFIER_STRING);
}

/** @param {TokenizeContext} ctx */
export function handleSlashCharacter(ctx) {
	pop(ctx);

	if (consumeCodePoint(ctx, 0x2d)) {
		// slash-dash

		return mkToken(ctx, T_SLASHDASH);
	} else if (consumeCodePoint(ctx, 0x2f)) {
		// --> //

		while (ctx.offset < ctx.length && !isNewLine(ctx.current)) {
			pop(ctx);
		}

		return mkToken(ctx, T_COMMENT_SINGLE);
	} else if (consumeCodePoint(ctx, 0x2a)) {
		// --> /*

		let level = 1;

		while (ctx.offset < ctx.length) {
			if (consumeCodePoint(ctx, 0x2a)) {
				if (consumeCodePoint(ctx, 0x2f)) {
					// --> */

					level--;

					if (level === 0) {
						return mkToken(ctx, T_COMMENT_MULTI);
					}
				}
			} else if (consumeCodePoint(ctx, 0x2f)) {
				if (consumeCodePoint(ctx, 0x2a)) {
					// --> /*
					level++;
				}
			} else {
				consumeNewline(ctx) || pop(ctx);
			}
		}

		throw mkError(ctx, "Unexpected EOF in multiline comment");
	} else {
		handleInvalidCharacter(ctx);
	}
}

/** @param {TokenizeContext} ctx */
export function handleSignCharacter(ctx) {
	pop(ctx);

	return handleSignCharacterAfterPop(ctx);
}

/** @param {TokenizeContext} ctx */
export function handleSignCharacterAfterPop(ctx) {
	if (isDecimalDigit(ctx.current)) {
		return handleNumberCharacter(ctx);
	} else if (consumeCodePoint(ctx, 0x2e)) {
		// .

		if (consume(ctx, isDecimalDigit)) {
			zerOrMore(ctx, isIdentifierChar);
			return mkToken(
				ctx,
				T_IDENTIFIER_STRING,
				"Invalid identifier or number, surround with quotes to make it an identifier or add a zero between the sign and the decimal point",
			);
		}

		zerOrMore(ctx, isIdentifierChar);

		return mkToken(ctx, T_IDENTIFIER_STRING);
	} else {
		zerOrMore(ctx, isIdentifierChar);

		return mkToken(ctx, T_IDENTIFIER_STRING);
	}
}

/** @param {TokenizeContext} ctx */
export function handleNumberCharacter(ctx) {
	if (consumeCodePoint(ctx, 0x30)) {
		// 0 -> handle 0x | 0b | 0o

		switch (ctx.current) {
			case 0x62: // b
				ctx.current = pop(ctx);

				if (!consume(ctx, isBinaryDigit)) {
					if (ctx.current === 0x5f) {
						// _
						pushError(
							ctx,
							"Invalid binary number, the first character after 0b cannot be an underscore",
						);
					} else {
						zerOrMore(ctx, isIdentifierChar);
						return mkToken(ctx, T_IDENTIFIER_STRING, "Invalid binary number");
					}
				}

				zerOrMore(ctx, isBinaryDigitOrUnderscore);

				return mkToken(ctx, T_NUMBER_BINARY);
			case 0x6f: // o
				ctx.current = pop(ctx);

				if (!consume(ctx, isOctalDigit)) {
					if (ctx.current === 0x5f) {
						// _
						pushError(
							ctx,
							"Invalid octal number, the first character after 0o cannot be an underscore",
						);
					} else {
						zerOrMore(ctx, isIdentifierChar);
						return mkToken(ctx, T_IDENTIFIER_STRING, "Invalid octal number");
					}
				}

				zerOrMore(ctx, isOctalDigitOrUnderscore);

				return mkToken(ctx, T_NUMBER_OCTAL);
			case 0x78: // x
				ctx.current = pop(ctx);

				if (!consume(ctx, isHexadecimalDigit)) {
					if (ctx.current === 0x5f) {
						// _
						pushError(
							ctx,
							"Invalid hexadecimal number, the first character after 0x cannot be an underscore",
						);
					} else {
						zerOrMore(ctx, isIdentifierChar);
						return mkToken(
							ctx,
							T_IDENTIFIER_STRING,
							"Invalid hexadecimal number",
						);
					}
				}

				zerOrMore(ctx, isHexadecimalDigitOrUnderscore);

				return mkToken(ctx, T_NUMBER_HEXADECIMAL);
		}
	}

	zerOrMore(ctx, isDecimalDigitOrUnderscore);

	if (consumeCodePoint(ctx, 0x2e)) {
		// .

		if (!consume(ctx, isDecimalDigit)) {
			if (ctx.current === 0x5f) {
				// _
				pushError(
					ctx,
					"Invalid decimal number, the part after the decimal point mustn't start on an underscore",
				);
			} else {
				pushError(
					ctx,
					"Invalid decimal number, a decimal point must be followed by a digit",
				);
			}
		}

		zerOrMore(ctx, isDecimalDigitOrUnderscore);
	}

	if (consumeCodePoint(ctx, 0x65) || consumeCodePoint(ctx, 0x45)) {
		// e | E

		consume(ctx, isNumberSign);

		if (!consume(ctx, isDecimalDigit)) {
			if (ctx.current === 0x5f) {
				// _
				pushError(
					ctx,
					"Invalid decimal number, the number after the exponent mustn't start on an underscore",
				);
			} else {
				zerOrMore(ctx, isIdentifierChar);

				return mkToken(
					ctx,
					T_NUMBER_DECIMAL,
					"Invalid decimal number, missing a number after the exponent",
				);
			}
		}

		zerOrMore(ctx, isDecimalDigitOrUnderscore);
	}

	return mkToken(ctx, T_NUMBER_DECIMAL);
}

/** @param {TokenizeContext} ctx */
export function handleIdentifierCharacter(ctx) {
	pop(ctx);

	zerOrMore(ctx, isIdentifierChar);
	return mkToken(ctx, T_IDENTIFIER_STRING);
}

/**
 * @param {TokenizeContext} ctx
 * @returns {never}
 */
export function handleInvalidCharacter(ctx) {
	throw mkError(
		ctx,
		`Unexpected character ${JSON.stringify(String.fromCodePoint(ctx.current))}, did you forget to quote an identifier?`,
	);
}

/** @type {((ctx: TokenizeContext) => Token)[]} */
const characterHandlers = Array(0xff);
characterHandlers.fill(handleIdentifierCharacter);

for (let i = 0; i < 0x20; i++) {
	characterHandlers[i] = handleInvalidCharacter;
}

characterHandlers[0x09] = handleWhitespaceCharacter; // Character Tabulation
characterHandlers[0x0a] = handleNewlineCharacter; // Line Feed
characterHandlers[0x0b] = handleNewlineCharacter; // Line Tabulation
characterHandlers[0x0c] = handleNewlineCharacter; // Form Feed
characterHandlers[0x0d] = handleNewlineCharacter; // Carriage Return
characterHandlers[0x20] = handleWhitespaceCharacter; // Space
characterHandlers[0x22] = handleQuoteCharacter; // "
characterHandlers[0x23] = handleHashCharacter; // #
characterHandlers[0x28] = createSingleCharacterToken(T_OPEN_PAREN); // (
characterHandlers[0x29] = createSingleCharacterToken(T_CLOSE_PAREN); // )
characterHandlers[0x2b] = handleSignCharacter; // +
characterHandlers[0x2d] = handleSignCharacter; // -
characterHandlers[0x2e] = handleDotCharacter; // .
characterHandlers[0x2f] = handleSlashCharacter; // /
characterHandlers[0x30] = handleNumberCharacter; // 0
characterHandlers[0x31] = handleNumberCharacter; // 1
characterHandlers[0x32] = handleNumberCharacter; // 2
characterHandlers[0x33] = handleNumberCharacter; // 3
characterHandlers[0x34] = handleNumberCharacter; // 4
characterHandlers[0x35] = handleNumberCharacter; // 5
characterHandlers[0x36] = handleNumberCharacter; // 6
characterHandlers[0x37] = handleNumberCharacter; // 7
characterHandlers[0x38] = handleNumberCharacter; // 8
characterHandlers[0x39] = handleNumberCharacter; // 9
characterHandlers[0x3b] = createSingleCharacterToken(T_SEMICOLON); // ;
characterHandlers[0x3d] = createSingleCharacterToken(T_EQUALS); // =
characterHandlers[0x5b] = handleInvalidCharacter; // [
characterHandlers[0x5c] = createSingleCharacterToken(T_ESCLINE); // \
characterHandlers[0x5d] = handleInvalidCharacter; // ]
characterHandlers[0x7b] = createSingleCharacterToken(T_OPEN_BRACE); // {
characterHandlers[0x7d] = createSingleCharacterToken(T_CLOSE_BRACE); // }
characterHandlers[0x85] = handleNewlineCharacter; // Next Line
characterHandlers[0xa0] = handleWhitespaceCharacter; // No-Break Space

/**
 * @param {string} t
 * @param {{graphemeLocations?: boolean}} opts
 * @returns {Generator<Token, void>}
 */
export function* tokenize(t, opts) {
	const ctx = createContext(t, opts);
	yield* init(ctx);

	while (!ctx.currentIter.done) {
		if (ctx.current < 0xff) {
			const handler = characterHandlers[ctx.current];
			yield handler(ctx);
			continue;
		}

		if (isUnicodeSpace(ctx.current)) {
			yield handleWhitespaceCharacter(ctx);
			continue;
		}

		if (isNewLine(ctx.current)) {
			yield handleNewlineCharacter(ctx);
			continue;
		}

		// All non-whitespace non-identifier characters are ASCII, which is already filtered out
		yield handleIdentifierCharacter(ctx);
	}

	yield mkToken(ctx, T_EOF);
}
