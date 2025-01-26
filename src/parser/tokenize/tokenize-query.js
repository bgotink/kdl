import {
	consumeCodePoint,
	createContext,
	init,
	mkToken,
	pop,
	zerOrMore,
} from "./context.js";
import {
	createSingleCharacterToken,
	handleDotCharacter,
	handleHashCharacter,
	handleIdentifierCharacter,
	handleInvalidCharacter,
	handleNewlineCharacter,
	handleNumberCharacter,
	handleQuoteCharacter,
	handleSignCharacter,
	handleSignCharacterAfterPop,
	handleSlashCharacter,
	handleWhitespaceCharacter,
} from "./tokenize.js";
import {
	T_CLOSE_BRACE,
	T_CLOSE_PAREN,
	T_CLOSE_SQUARE,
	T_EOF,
	T_ESCLINE,
	T_IDENTIFIER_STRING,
	T_OPEN_BRACE,
	T_OPEN_PAREN,
	T_OPEN_SQUARE,
	T_QUERY_OPERATOR,
	T_SEMICOLON,
	isIdentifierChar,
	isNewLine,
	isUnicodeSpace,
} from "./types.js";

/** @import {Token} from "../token.js" */

/** @import {TokenizeContext} from "./context.js" */

/** @param {TokenizeContext} ctx */
function handleQueryOperatorCharacter(ctx) {
	switch (ctx.current) {
		case 0x3d /* = */:
			pop(ctx);
			return mkToken(ctx, T_QUERY_OPERATOR);
		case 0x3e /* > */:
			pop(ctx);
			consumeCodePoint(ctx, 0x3d) || consumeCodePoint(ctx, 0x3e); // > or >= or >>
			return mkToken(ctx, T_QUERY_OPERATOR);
		case 0x3c /* < */:
			pop(ctx);
			consumeCodePoint(ctx, 0x3d); // < or <=
			return mkToken(ctx, T_QUERY_OPERATOR);
		case 0x21 /* ! */:
		case 0x24 /* $ */:
		case 0x2a /* * */:
		case 0x5e /* ^ */:
			pop(ctx);
			if (consumeCodePoint(ctx, 0x3d)) {
				return mkToken(ctx, T_QUERY_OPERATOR);
			}

			zerOrMore(ctx, isIdentifierChar);
			return mkToken(ctx, T_IDENTIFIER_STRING);
		case 0x7c /* | */:
			pop(ctx);
			if (consumeCodePoint(ctx, 0x7c)) {
				return mkToken(ctx, T_QUERY_OPERATOR);
			}

			zerOrMore(ctx, isIdentifierChar);
			return mkToken(ctx, T_IDENTIFIER_STRING);
		default:
			throw new Error("unreachable");
	}
}

/** @param {TokenizeContext} ctx */
function handleQueryPlusSignCharacter(ctx) {
	pop(ctx);

	if (consumeCodePoint(ctx, 0x2b)) {
		return mkToken(ctx, T_QUERY_OPERATOR);
	}

	if (isUnicodeSpace(ctx.current)) {
		return mkToken(ctx, T_QUERY_OPERATOR);
	}

	return handleSignCharacterAfterPop(ctx);
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
characterHandlers[0x21 /* ! */] = handleQueryOperatorCharacter;
characterHandlers[0x22 /* " */] = handleQuoteCharacter;
characterHandlers[0x23 /* # */] = handleHashCharacter;
characterHandlers[0x24 /* $ */] = handleQueryOperatorCharacter;
characterHandlers[0x28 /* ( */] = createSingleCharacterToken(T_OPEN_PAREN);
characterHandlers[0x29 /* ) */] = createSingleCharacterToken(T_CLOSE_PAREN);
characterHandlers[0x2a /* * */] = handleQueryOperatorCharacter;
characterHandlers[0x2b /* + */] = handleQueryPlusSignCharacter;
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
characterHandlers[0x3c /* < */] = handleQueryOperatorCharacter;
characterHandlers[0x3d /* = */] = handleQueryOperatorCharacter;
characterHandlers[0x3e /* > */] = handleQueryOperatorCharacter;
characterHandlers[0x5b /* [ */] = createSingleCharacterToken(T_OPEN_SQUARE);
characterHandlers[0x5c /* \ */] = createSingleCharacterToken(T_ESCLINE);
characterHandlers[0x5d /* ] */] = createSingleCharacterToken(T_CLOSE_SQUARE);
characterHandlers[0x5e /* ^ */] = handleQueryOperatorCharacter;
characterHandlers[0x7b /* { */] = createSingleCharacterToken(T_OPEN_BRACE);
characterHandlers[0x7c /* | */] = handleQueryOperatorCharacter;
characterHandlers[0x7d /* } */] = createSingleCharacterToken(T_CLOSE_BRACE);
characterHandlers[0x85] = handleNewlineCharacter; // Next Line
characterHandlers[0xa0] = handleWhitespaceCharacter; // No-Break Space

/**
 * @param {string} t
 * @param {{graphemeLocations?: boolean}} opts
 * @returns {Generator<Token, void>}
 */
export function* tokenizeQuery(t, opts) {
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
