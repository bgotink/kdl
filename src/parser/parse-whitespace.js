/**
 * @fileoverview
 * Copy of the whitespace parser functions of ./parse.js except these output
 * objects rather than strings
 */

import {
	T_BOM,
	T_INLINE_WHITESPACE,
	T_NEWLINE,
	T_SLASHDASH,
	tokenize,
} from "./tokenize.js";
import {
	consume,
	createParserCtx,
	mkError,
	parseEscline,
	parseMultilineComment,
	parseBaseNode,
	parseNodeChildren,
	parseNodePropOrArg,
	parseSingleLineComment,
	parseNodeTerminator,
	concatenate,
} from "./parse.js";

/** @typedef {import("./parse.js").ParserCtx} ParserCtx */

/**
 * @template T
 * @param {ParserCtx} ctx
 * @param {(ctx: ParserCtx) => T | undefined} fn
 * @returns {T[] | undefined}
 */
function repeat(ctx, fn) {
	/** @type {T[]} */
	const parts = [];
	let part;

	while ((part = fn(ctx))) {
		parts.push(part);
	}

	return parts.length > 0 ? parts : undefined;
}

/**
 * @param {ParserCtx} ctx
 * @returns {import('../model/whitespace.js').LineSpace=}
 */
function parseLineSpace(ctx) {
	{
		const bom = consume(ctx, T_BOM);
		if (bom) {
			return {type: "bom", text: bom.text};
		}
	}

	{
		const newLine = consume(ctx, T_NEWLINE);
		if (newLine) {
			return {type: "newline", text: newLine.text};
		}
	}

	{
		const inlineWhitespace = consume(ctx, T_INLINE_WHITESPACE);
		if (inlineWhitespace) {
			return {type: "space", text: inlineWhitespace.text};
		}
	}

	{
		const singleLineComment = parseSingleLineComment(ctx);
		if (singleLineComment) {
			return {type: "singleline", text: singleLineComment};
		}
	}

	{
		const multilineComment = parseMultilineComment(ctx);
		if (multilineComment) {
			return {type: "multiline", text: multilineComment};
		}
	}

	return;
}

/**
 * @param {ParserCtx} ctx
 * @returns {import('../model/whitespace.js').NodeSpace=}
 */
function parseNodeSpace(ctx) {
	{
		const escLine = parseEscline(ctx);
		if (escLine) {
			return {type: "line-escape", text: escLine};
		}
	}

	{
		const inlineWhitespace = consume(ctx, T_INLINE_WHITESPACE);
		if (inlineWhitespace) {
			return {type: "space", text: inlineWhitespace.text};
		}
	}

	{
		const multilineComment = parseMultilineComment(ctx);
		if (multilineComment) {
			return {type: "multiline", text: multilineComment};
		}
	}

	return;
}

/**
 * @param {ParserCtx} ctx
 * @returns {import('../model/whitespace.js').WhitespaceInDocument}
 */
export function parseWhitespaceInDocument(ctx) {
	/** @type {import('../model/whitespace.js').WhitespaceInDocument} */
	const result = [];

	while (true) {
		{
			const part = parseLineSpace(ctx);
			if (part) {
				result.push(part);
				continue;
			}
		}

		{
			let part = consume(ctx, T_SLASHDASH)?.text;
			if (part) {
				let tmp;
				const preface = repeat(ctx, parseNodeSpace) ?? [];

				const node = parseBaseNode(ctx);
				if (!node) {
					throw mkError(ctx, "Invalid slashdash, expected a commented node");
				}

				node.trailing = concatenate(
					node.trailing,
					repeat(ctx, parseNodeSpace)
						?.map((v) => v.text)
						.join(""),
					parseNodeTerminator(ctx),
				);

				result.push({type: "slashdash", preface, value: node});
				continue;
			}
		}

		break;
	}

	return result;
}

/**
 * @param {ParserCtx} ctx
 * @returns {[import('../model/whitespace.js').SlashDashInNode, string]=}
 */
function parseNodeSpaceSlashDash(ctx) {
	const slashdash = consume(ctx, T_SLASHDASH);
	if (slashdash == null) {
		return;
	}

	let part;
	/** @type {import("../model/whitespace.js").NodeSpace[]} */
	const preface = [];
	while ((part = parseNodeSpace(ctx))) {
		preface.push(part);
	}

	let value, tmp;
	let finalSpace = "";
	if ((tmp = parseNodePropOrArg(ctx))) {
		value = tmp[0];
		if (tmp[1]) {
			finalSpace = tmp[1];
		}
	} else if ((tmp = parseNodeChildren(ctx))) {
		value = tmp;
	} else {
		throw mkError(
			slashdash,
			`Couldn't find argument, property, or children that were commented by slashdash`,
		);
	}

	return [{type: "slashdash", preface, value}, finalSpace];
}

/**
 * @param {ParserCtx} ctx
 * @returns {import("../model/whitespace.js").WhitespaceInNode}
 */
export function parseWhitespaceInNode(ctx) {
	/** @type {import("../model/whitespace.js").WhitespaceInNode} */
	const result = [];

	while (true) {
		const part = parseNodeSpace(ctx);
		if (!part) {
			break;
		}

		let endsWithPlainSpace = true;
		result.push(part);

		while (endsWithPlainSpace) {
			const slashDash = parseNodeSpaceSlashDash(ctx);
			if (!slashDash) {
				break;
			}

			result.push(slashDash[0]);
			if (slashDash[1][0]) {
				result.push(
					...parseWhitespaceInNode(
						createParserCtx(
							slashDash[1][0],
							tokenize(slashDash[1][0], {
								flags: ctx.flags,
							}),
							{
								flags: ctx.flags,
							},
						),
					),
				);
			}
			endsWithPlainSpace = !!slashDash[1][0];
		}
	}

	return result;
}
