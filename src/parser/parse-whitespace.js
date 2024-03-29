/**
 * @fileoverview
 * Copy of the whitespace parser functions of ./parse.js except these output
 * objects rather than strings
 */

import {
	T_BOM,
	T_ESCLINE,
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
	parseNode,
	parseNodeChildren,
	parseNodePropOrArg,
	parseSingleLineComment,
} from "./parse.js";

/** @typedef {import("./parse.js").ParserCtx} ParserCtx */

/**
 * @param {ParserCtx} ctx
 * @returns {import('../model/whitespace.js').PlainLineSpace=}
 */
function parsePlainLineSpace(ctx) {
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
 * @returns {import('../model/whitespace.js').PlainNodeSpace=}
 */
function parsePlainNodeSpace(ctx) {
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
 * @returns {import('../model/whitespace.js').LineSpace}
 */
export function parseLineSpace(ctx) {
	/** @type {import('../model/whitespace.js').LineSpace} */
	const result = [];

	while (true) {
		{
			const part = parsePlainLineSpace(ctx);
			if (part) {
				result.push(part);
				continue;
			}
		}

		{
			let part = consume(ctx, T_SLASHDASH)?.text;
			if (part) {
				let tmp;
				const preface = [];
				while ((tmp = parsePlainNodeSpace(ctx))) {
					preface.push(tmp);
				}

				const node = parseNode(ctx);
				if (!node) {
					throw mkError(ctx, "Invalid slashdash, expected a commented node");
				}

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
 * @returns {[import('../model/whitespace.js').NodeSpaceSlashDash, [string, boolean]]=}
 */
function parseNodeSpaceSlashDash(ctx) {
	const slashdash = consume(ctx, T_SLASHDASH);
	if (slashdash == null) {
		return;
	}

	const result = [slashdash.text];

	let part;
	/** @type {import("../model/whitespace.js").PlainNodeSpace[]} */
	const preface = [];
	while ((part = parsePlainNodeSpace(ctx))) {
		preface.push(part);
	}

	let value, tmp;
	/** @type {[string, boolean]} */
	let finalSpace = ["", false];
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
 * @returns {import("../model/whitespace.js").NodeSpace}
 */
export function parseNodeSpace(ctx) {
	/** @type {import("../model/whitespace.js").NodeSpace} */
	const result = [];

	while (true) {
		const part = parsePlainNodeSpace(ctx);
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
					...parseNodeSpace(createParserCtx(tokenize(slashDash[1][0]))),
				);
			}
			endsWithPlainSpace = slashDash[1][1];
		}
	}

	return result;
}
