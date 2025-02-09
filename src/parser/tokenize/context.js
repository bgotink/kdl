import {InvalidKdlError} from "../../error.js";

import {isInvalidCharacter, isNewLine, T_BOM} from "./types.js";

/** @import {Location, Token} from "../token.js" */

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
 * @returns {Iterator<string>}
 */
function iterateCodePoints(text) {
	return text[Symbol.iterator]();
}

/**
 * @typedef {object} TokenizeContext
 * @prop {string} text
 * @prop {number} line
 * @prop {number} column
 * @prop {number} offset
 * @prop {number} length
 * @prop {Iterator<string, void, any>} iterator
 * @prop {IteratorResult<string, void>} currentIter
 * @prop {number} current
 * @prop {Location} start
 * @prop {boolean} graphemeLocations
 * @prop {InvalidKdlError[] | null} errorsInToken
 */

/**
 * @param {string} text
 * @param {{graphemeLocations?: boolean}} opts
 * @returns {TokenizeContext}
 */
export function createContext(text, opts) {
	const graphemeLocations = opts.graphemeLocations ?? false;

	const iterator =
		graphemeLocations ? iterateGraphemes(text) : iterateCodePoints(text);
	const currentIter = iterator.next();

	return {
		text,
		graphemeLocations,

		line: 1,
		column: 1,
		offset: 0,

		length: text.length,

		iterator,
		currentIter,

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
		current:
			currentIter.done ? NaN : (
				/** @type {number} */ (currentIter.value.codePointAt(0))
			),

		start: {line: 1, column: 1, offset: 0},

		errorsInToken: null,
	};
}

/**
 * @param {TokenizeContext} ctx
 * @returns {Generator<Token, void>}
 */
export function* init(ctx) {
	if (consumeCodePoint(ctx, 0xfeff)) {
		// Byte-Order Mark
		// don't let BOM count as column
		ctx.column = 1;
		yield mkToken(ctx, T_BOM);
	}

	if (isInvalidCharacter(ctx.current)) {
		throw mkError(ctx, `Invalid character \\u${ctx.current.toString(16)}`);
	}
}

/**
 * @param {TokenizeContext} ctx
 */
export function pop(ctx) {
	ctx.offset += /** @type {string} */ (ctx.currentIter.value).length;
	ctx.column++;

	const currentIter = (ctx.currentIter = ctx.iterator.next());
	const current = (ctx.current =
		currentIter.done ? NaN : (
			/** @type {number} */ (currentIter.value.codePointAt(0))
		));

	if (isInvalidCharacter(current)) {
		if ((current >= 0xd800 && current <= 0xdfff) || current > 0x10ffff) {
			// Non-scalar value, cannot be represented whatsoever
			pushError(ctx, `Invalid character \\u${current.toString(16)}`);
		} else {
			pushError(
				ctx,
				`Invalid character \\u${current.toString(16)}, this character is not allowed but can be included in strings as \\u{${current.toString(16)}}`,
			);
		}
	}

	return current;
}

/**
 * @param {TokenizeContext} ctx
 * @param {(codePoint: number) => boolean} test
 */
export function consume(ctx, test) {
	if (test(ctx.current)) {
		const previous = ctx.current;
		pop(ctx);
		return previous;
	}
}

/**
 * Consume the current code point if it matches the given code point
 *
 * @param {TokenizeContext} ctx
 * @param {number} codePoint
 */
export function consumeCodePoint(ctx, codePoint) {
	if (ctx.current === codePoint) {
		pop(ctx);
		return codePoint;
	}
}

/**
 * @param {TokenizeContext} ctx
 */
export function consumeNewline(ctx) {
	if (!isNewLine(ctx.current)) {
		return false;
	}

	// consume \r\n as a single newline
	if (
		!ctx.graphemeLocations &&
		ctx.current === 0x0d &&
		ctx.text.codePointAt(ctx.offset + 1) === 0x0a
	) {
		ctx.iterator.next();
		ctx.offset++;
	}

	pop(ctx);

	ctx.column = 1;
	ctx.line++;

	return true;
}

/**
 * @param {TokenizeContext} ctx
 * @param {(codePoint: number) => boolean} test
 */
export function zerOrMore(ctx, test) {
	while (test(ctx.current)) {
		pop(ctx);
	}
}

/**
 * @param {TokenizeContext} ctx
 * @param {number} type
 * @param {string?=} error
 * @returns {Token}
 */
export function mkToken(ctx, type, error) {
	const {line, column, offset} = ctx;
	const end = {line, column, offset};
	const s = ctx.start;

	ctx.start = end;

	const errors = ctx.errorsInToken;
	ctx.errorsInToken = null;

	/** @type {Token} */
	const token = {
		type,
		text: ctx.text.slice(s.offset, end.offset),
		start: s,
		end,
		errors,
	};

	if (error) {
		if (!token.errors) {
			token.errors = [];
		}
		token.errors.push(new InvalidKdlError(error, {token}));
	}

	return token;
}

/**
 * Create an error based on the current token and location
 *
 * @param {TokenizeContext} ctx
 * @param {string | InvalidKdlError} message
 */
export function mkError(ctx, message) {
	if (message instanceof InvalidKdlError) {
		return message;
	}

	const {line, column, offset} = ctx;
	const start = {line, column, offset};
	let end;

	if (offset < ctx.length) {
		if (isNewLine(ctx.current)) {
			end = {line: line + 1, column: 1, offset: offset + 1};
		} else {
			end = {line, column: column + 1, offset: offset + 1};
		}
	}

	return new InvalidKdlError(`${message}`, {start, end});
}

/**
 * Create an error based on the current token and location
 *
 * @param {TokenizeContext} ctx
 * @param {string | InvalidKdlError} message
 */
export function pushError(ctx, message) {
	(ctx.errorsInToken ??= []).push(mkError(ctx, message));
}
