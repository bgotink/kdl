import {
	consume,
	consumeCodePoint,
	consumeNewline,
	createContext,
	init,
	mkError,
	mkToken,
	pop,
	zerOrMore,
} from "./context.js";
import {
	createSingleCharacterToken,
	handleInvalidCharacter,
	handleNewlineCharacter,
	handleNumberCharacter,
	handleSignCharacter,
	handleWhitespaceCharacter,
} from "./tokenize.js";
import {
	T_CLOSE_BRACE,
	T_CLOSE_PAREN,
	T_COMMENT_MULTI,
	T_COMMENT_SINGLE,
	T_EOF,
	T_EQUALS,
	T_ESCLINE,
	T_IDENTIFIER_STRING,
	T_KEYWORD_OR_HASHED_IDENT,
	T_MULTILINE_QUOTED_STRING,
	T_OPEN_BRACE,
	T_OPEN_PAREN,
	T_QUOTED_STRING,
	T_RAW_STRING,
	T_SEMICOLON,
	T_SLASHDASH,
	isDecimalDigit,
	isIdentifierChar as isV2IdentifierChar,
	isNewLine,
	isUnicodeSpace,
} from "./types.js";

/** @import {Token} from "../token.js" */

/** @import {TokenizeContext} from "./context.js" */

/** @param {number} codePoint */
function isV1IdentifierChar(codePoint) {
	// Allowed in KDL v2 but not in KDL v1:
	if (
		codePoint === 0x3c || // <
		codePoint === 0x3e || // >
		codePoint === 0x2c // ,
	) {
		return false;
	}

	// Allowed in KDL v1 but not in KDL v2:
	if (
		codePoint === 0x23 // #
	) {
		return true;
	}

	return isV2IdentifierChar(codePoint);
}

/** @param {TokenizeContext} ctx */
function handleQuoteCharacter(ctx) {
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
function handleDotCharacter(ctx) {
	pop(ctx);

	if (consume(ctx, isDecimalDigit)) {
		zerOrMore(ctx, isV1IdentifierChar);
		return mkToken(
			ctx,
			T_IDENTIFIER_STRING,
			"Invalid identifier, identifiers that start with a sign and a dot must be quoted if the next character is a digit to prevent confusion with decimal numbers",
		);
	}

	zerOrMore(ctx, isV1IdentifierChar);

	return mkToken(ctx, T_IDENTIFIER_STRING);
}

/** @param {TokenizeContext} ctx */
function handleSlashCharacter(ctx) {
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
function handleV1IdentifierCharacter(ctx) {
	pop(ctx);

	zerOrMore(ctx, isV1IdentifierChar);
	return mkToken(ctx, T_IDENTIFIER_STRING);
}

/**
 * @param {string} keyword
 * @returns {(ctx: TokenizeContext) => Token}
 */
function handleV1KeywordOrIdentifier(keyword) {
	const keywordCodePoints = Array.from(
		keyword,
		(c) => /** @type {number} */ (c.codePointAt(0)),
	);
	const {length} = keywordCodePoints;

	return (ctx) => {
		pop(ctx);

		let matchesKeyword = true;
		for (let i = 1; i < length; i++) {
			if (ctx.current !== keywordCodePoints[i]) {
				matchesKeyword = false;
				break;
			}

			pop(ctx);
		}

		if (matchesKeyword && !isV1IdentifierChar(ctx.current)) {
			return mkToken(ctx, T_KEYWORD_OR_HASHED_IDENT);
		}

		zerOrMore(ctx, isV1IdentifierChar);
		return mkToken(ctx, T_IDENTIFIER_STRING);
	};
}

/**
 * @param {TokenizeContext} ctx
 * @returns {Token}
 */
function handleV1RawStringOrIdentifier(ctx) {
	pop(ctx);

	if (ctx.current !== 0x22 && ctx.current !== 0x23) {
		zerOrMore(ctx, isV1IdentifierChar);
		return mkToken(ctx, T_IDENTIFIER_STRING);
	}

	let numberOfOpeningHashes = 0;
	while (consumeCodePoint(ctx, 0x23)) {
		numberOfOpeningHashes++;
	}

	if (!consumeCodePoint(ctx, 0x22)) {
		throw mkError(
			ctx,
			`Expected a quote after r${"#".repeat(numberOfOpeningHashes)}`,
		);
	}

	while (true) {
		if (ctx.offset >= ctx.length) {
			throw mkError(ctx, "Unexpected EOF while parsing raw string");
		}

		if (consumeCodePoint(ctx, 0x22)) {
			let numberOfClosingHashes = 0;
			while (
				numberOfClosingHashes < numberOfOpeningHashes &&
				consumeCodePoint(ctx, 0x23)
			) {
				numberOfClosingHashes++;
			}

			if (numberOfClosingHashes === numberOfOpeningHashes) {
				return mkToken(ctx, T_RAW_STRING);
			}
		} else {
			consumeNewline(ctx) || pop(ctx);
		}
	}
}

/** @type {((ctx: TokenizeContext) => Token)[]} */
const characterHandlers = Array(0xff);
characterHandlers.fill(handleV1IdentifierCharacter);

for (let i = 0; i < 0x20; i++) {
	characterHandlers[i] = handleInvalidCharacter;
}

characterHandlers[0x09] = handleWhitespaceCharacter; // Character Tabulation
characterHandlers[0x0a] = handleNewlineCharacter; // Line Feed
characterHandlers[0x0b] = handleNewlineCharacter; // Line Tabulation
characterHandlers[0x0c] = handleNewlineCharacter; // Form Feed
characterHandlers[0x0d] = handleNewlineCharacter; // Carriage Return
characterHandlers[0x20] = handleWhitespaceCharacter; // Space
characterHandlers[0x22 /* " */] = handleQuoteCharacter;
characterHandlers[0x28 /* ( */] = createSingleCharacterToken(T_OPEN_PAREN);
characterHandlers[0x29 /* ) */] = createSingleCharacterToken(T_CLOSE_PAREN);
characterHandlers[0x2b /* + */] = handleSignCharacter;
characterHandlers[0x2d /* - */] = handleSignCharacter;
characterHandlers[0x2e /* . */] = handleDotCharacter;
characterHandlers[0x2f /* / */] = handleSlashCharacter;
characterHandlers[0x30 /* 0 */] = handleNumberCharacter;
characterHandlers[0x31 /* 1 */] = handleNumberCharacter;
characterHandlers[0x32 /* 2 */] = handleNumberCharacter;
characterHandlers[0x33 /* 3 */] = handleNumberCharacter;
characterHandlers[0x34 /* 4 */] = handleNumberCharacter;
characterHandlers[0x35 /* 5 */] = handleNumberCharacter;
characterHandlers[0x36 /* 6 */] = handleNumberCharacter;
characterHandlers[0x37 /* 7 */] = handleNumberCharacter;
characterHandlers[0x38 /* 8 */] = handleNumberCharacter;
characterHandlers[0x39 /* 9 */] = handleNumberCharacter;
characterHandlers[0x3b /* ; */] = createSingleCharacterToken(T_SEMICOLON);
characterHandlers[0x3d /* = */] = createSingleCharacterToken(T_EQUALS);
characterHandlers[0x5b /* [ */] = handleInvalidCharacter;
characterHandlers[0x5c /* \ */] = createSingleCharacterToken(T_ESCLINE);
characterHandlers[0x5d /* ] */] = handleInvalidCharacter;
characterHandlers[0x66 /* f */] = handleV1KeywordOrIdentifier("false");
characterHandlers[0x6e /* n */] = handleV1KeywordOrIdentifier("null");
characterHandlers[0x72 /* r */] = handleV1RawStringOrIdentifier;
characterHandlers[0x74 /* t */] = handleV1KeywordOrIdentifier("true");
characterHandlers[0x7b /* { */] = createSingleCharacterToken(T_OPEN_BRACE);
characterHandlers[0x7d /* } */] = createSingleCharacterToken(T_CLOSE_BRACE);
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
		yield handleV1IdentifierCharacter(ctx);
	}

	yield mkToken(ctx, T_EOF);
}
