import {InvalidKdlError, stringifyTokenOffset} from "../error.js";
import {format} from "../format.js";
import {storeLocation as _storeLocation} from "../locations.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "../model.js";
import {
	postProcessMultilineRawStringValue,
	postProcessMultilineStringValue,
	postProcessRawStringValue,
	postProcessStringValue,
} from "../string-utils.js";

import {
	T_BOM,
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
} from "./tokenize.js";

/**
 * @typedef {object} ParserCtx
 * @prop {IteratorResult<import("./tokenize.js").Token, void>} current
 * @prop {Iterator<import("./tokenize.js").Token, void>} tokens
 * @prop {import("./tokenize.js").Token} lastToken
 * @prop {boolean} storeLocations
 * @prop {Error[]} errors
 */

/** @param {ParserCtx} ctx */
function pop(ctx) {
	if (!ctx.current.done) {
		ctx.lastToken = ctx.current.value;
	}

	ctx.current = ctx.tokens.next();

	const error = !ctx.current.done && ctx.current.value.error;
	if (error) {
		ctx.errors.push(error);
	}
}

/**
 * @param {ParserCtx} ctx
 * @param {import("./tokenize.js").Token['type']} tokenType
 */
export function consume(ctx, tokenType) {
	if (!ctx.current.done && ctx.current.value.type === tokenType) {
		const token = ctx.current.value;
		pop(ctx);

		return token;
	}
}

/**
 * @param {ParserCtx | import("./tokenize.js").Token} ctx
 * @param {string} message
 */
export function mkError(ctx, message) {
	const token = "current" in ctx ? ctx.current.value : ctx;
	return new InvalidKdlError(
		`${message} at ${token ? stringifyTokenOffset(token) : "end of input"}`,
	);
}

/**
 * @param {ParserCtx} ctx
 * @param {Value | Identifier | Tag | Entry | Node | Document} value
 * @param {import("./tokenize.js").Token} start
 * @param {import("./tokenize.js").Token} [end]
 */
function storeLocation(ctx, value, start, end = start) {
	if (ctx.storeLocations) {
		_storeLocation(value, start, end);
	}
}

/**
 * @param  {...(string | undefined | null)} parts
 */
export function concatenate(...parts) {
	parts = parts.filter(Boolean);

	return parts.length ? parts.join("") : undefined;
}

/**
 * @param {Iterable<import("./tokenize.js").Token>} tokens
 * @param {object} [options]
 * @param {boolean} [options.storeLocations]
 * @returns {ParserCtx}
 */
export function createParserCtx(tokens, {storeLocations = false} = {}) {
	const iterator = tokens[Symbol.iterator]();

	return {
		tokens: iterator,
		current: iterator.next(),
		storeLocations,
		lastToken: {
			type: -1,
			text: "",
			start: {
				offset: 0,
				line: 1,
				column: 1,
			},
			end: {
				offset: 0,
				line: 1,
				column: 1,
			},
			error: null,
		},
		errors: [],
	};
}

/** @param {ParserCtx} ctx */
export function finalize(ctx) {
	if (!ctx.current.done && ctx.current.value.type !== T_EOF) {
		throw mkError(
			ctx,
			`Unexpected token ${JSON.stringify(ctx.current.value.text)}, did you forget to quote an identifier?`,
		);
	}

	if (ctx.errors.length) {
		if (ctx.errors.length === 1) {
			throw ctx.errors[0];
		} else {
			throw new AggregateError(ctx.errors);
		}
	}
}

/**
 * @param {ParserCtx} ctx
 * @returns {[number, string, import("./tokenize.js").Token]=}
 */
function _parseNumber(ctx) {
	const {value: token} = ctx.current;
	let value;

	switch (token?.type) {
		case T_NUMBER_BINARY:
			value = Number.parseInt(token.text.slice(2).replaceAll("_", ""), 2);
			break;
		case T_NUMBER_OCTAL:
			value = Number.parseInt(token.text.slice(2).replaceAll("_", ""), 8);
			break;
		case T_NUMBER_DECIMAL:
			value = Number.parseFloat(token.text.replaceAll("_", ""));
			break;
		case T_NUMBER_HEXADECIMAL:
			value = Number.parseInt(token.text.slice(2).replaceAll("_", ""), 16);
			break;
		default:
			return;
	}

	pop(ctx);
	return [value, token.text, token];
}

/**
 * @param {ParserCtx} ctx
 * @returns {[string, string, import("./tokenize.js").Token]=}
 */
function _parseString(ctx) {
	if (ctx.current.done) {
		return;
	}

	const {value: token} = ctx.current;
	switch (token.type) {
		case T_IDENTIFIER_STRING:
			pop(ctx);
			if (
				token.text === "inf" ||
				token.text === "-inf" ||
				token.text === "nan" ||
				token.text === "true" ||
				token.text === "false" ||
				token.text === "null"
			) {
				ctx.errors.push(
					mkError(
						ctx,
						`Invalid keyword "${token.text}", add a leading # to use the keyword or surround with quotes to make it a string`,
					),
				);
			}
			return [token.text, token.text, token];
		case T_QUOTED_STRING:
			pop(ctx);
			return [
				postProcessStringValue(token.text.slice(1, -1), token),
				token.text,
				token,
			];
		case T_MULTILINE_QUOTED_STRING:
			pop(ctx);
			return [
				postProcessMultilineStringValue(token.text.slice(3, -3), token),
				token.text,
				token,
			];
		case T_RAW_STRING: {
			pop(ctx);

			const raw = token.text;
			const quoteIndex = raw.indexOf('"');

			return [
				postProcessRawStringValue(
					raw.slice(quoteIndex + 1, -(quoteIndex + 1)),
					token,
				),
				raw,
				token,
			];
		}
		case T_MULTILINE_RAW_STRING: {
			pop(ctx);

			const raw = token.text;
			const quoteIndex = raw.indexOf('"');

			return [
				postProcessMultilineRawStringValue(
					raw.slice(quoteIndex + 3, -(quoteIndex + 3)),
					token,
				),
				raw,
				token,
			];
		}
	}

	return;
}

/** @param {ParserCtx} ctx */
function _parseKeyword(ctx) {
	if (ctx.current.value?.type !== T_KEYWORD) {
		return;
	}

	const token = ctx.current.value;
	const raw = token.text;
	let value;

	switch (raw) {
		case "#null":
			value = null;
			break;
		case "#true":
			value = true;
			break;
		case "#false":
			value = false;
			break;
		case "#inf":
			value = Infinity;
			break;
		case "#-inf":
			value = -Infinity;
			break;
		case "#nan":
			value = NaN;
			break;
		default:
			ctx.errors.push(mkError(ctx, `Invalid keyword ${raw}`));
			value = null;
	}

	pop(ctx);
	return /** @type {const} */ ([value, raw, token]);
}

/** @param {ParserCtx} ctx */
export function parseIdentifier(ctx) {
	const name = _parseString(ctx);
	if (!name) {
		return;
	}

	const result = new Identifier(name[0]);
	result.representation = name[1];
	storeLocation(ctx, result, name[2], ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
export function parseValue(ctx) {
	const value = _parseNumber(ctx) ?? _parseString(ctx) ?? _parseKeyword(ctx);
	if (!value) {
		return;
	}

	const result = new Value(value[0]);
	result.representation = value[1];
	storeLocation(ctx, result, value[2], ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
export function parseSingleLineComment(ctx) {
	const comment = consume(ctx, T_COMMENT_SINGLE);
	if (!comment) {
		return;
	}

	// due to tokenizer we know the next token MUST be a newline or we've reached
	// the end, there's no need to check this
	const {value: newlineToken} = ctx.current;
	pop(ctx);

	return comment.text + (newlineToken?.text ?? "");
}

/** @param {ParserCtx} ctx */
export function parseMultilineComment(ctx) {
	return consume(ctx, T_COMMENT_MULTI)?.text;
}

/** @param {ParserCtx} ctx */
function parseWs(ctx) {
	return consume(ctx, T_INLINE_WHITESPACE)?.text ?? parseMultilineComment(ctx);
}

/** @param {ParserCtx} ctx */
export function parseEscline(ctx) {
	const start = consume(ctx, T_ESCLINE);
	if (!start) {
		return;
	}

	const parts = [start.text];

	while (true) {
		const part = parseWs(ctx);
		if (!part) {
			break;
		}

		parts.push(part);
	}

	let end =
		parseSingleLineComment(ctx) ??
		consume(ctx, T_NEWLINE)?.text ??
		consume(ctx, T_EOF)?.text;
	if (end == null) {
		ctx.errors.push(
			mkError(
				ctx,
				`Expected newline or single-line comment after backslash but got ${ctx.current.value?.text ?? "EOF"}`,
			),
		);
		end = "";
	}
	parts.push(end);

	return parts.join("");
}

/** @param {ParserCtx} ctx */
function parseLineSpace(ctx) {
	const result = [];

	let tmp;
	while (
		(tmp =
			consume(ctx, T_NEWLINE)?.text ??
			parseWs(ctx) ??
			parseSingleLineComment(ctx))
	) {
		result.push(tmp);
	}

	return result.length ? result : undefined;
}

/** @param {ParserCtx} ctx */
function parseNodeSpace(ctx) {
	const result = [];

	let tmp;
	while ((tmp = parseWs(ctx) ?? parseEscline(ctx))) {
		result.push(tmp);
	}

	return result.length ? result : undefined;
}

/** @param {ParserCtx} ctx */
function parseTag(ctx) {
	const start = consume(ctx, T_OPEN_PAREN);
	if (!start) {
		return;
	}

	const leading = parseNodeSpace(ctx);
	const name = _parseString(ctx);
	if (!name) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}
	const trailing = parseNodeSpace(ctx);

	const end = consume(ctx, T_CLOSE_PAREN);
	if (!end) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}

	const result = new Tag(name[0]);
	result.representation = name[1];

	result.leading = leading?.join("");
	result.trailing = trailing?.join("");

	storeLocation(ctx, result, start, ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
export function parseNodeTerminator(ctx) {
	return (
		parseSingleLineComment(ctx) ??
		consume(ctx, T_NEWLINE)?.text ??
		consume(ctx, T_SEMICOLON)?.text ??
		consume(ctx, T_EOF)?.text
	);
}

/** @param {ParserCtx} ctx */
export function parseNodeChildren(ctx) {
	if (!consume(ctx, T_OPEN_BRACE)) {
		return;
	}

	const document = _parseDocument(ctx);

	if (!consume(ctx, T_CLOSE_BRACE)) {
		throw mkError(ctx, `Invalid node children`);
	}

	return document;
}

/**
 * @param {ParserCtx} ctx
 * @returns {[Entry, string | undefined]=}
 */
export function parseNodePropOrArg(ctx) {
	const start = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	{
		let tag = parseTag(ctx);
		if (tag) {
			// starts with tag -> must be an argument
			const betweenTagAndValue = parseNodeSpace(ctx);
			const value = parseValue(ctx);
			if (!value) {
				throw mkError(ctx, `Invalid argument`);
			}

			const entry = new Entry(value, null);
			entry.tag = tag;
			entry.betweenTagAndValue = betweenTagAndValue?.join("");

			storeLocation(ctx, entry, start, ctx.lastToken);
			return [entry, undefined];
		}
	}

	{
		let rawValue = _parseKeyword(ctx) ?? _parseNumber(ctx);
		if (rawValue) {
			// non-string -> must be argument
			const value = new Value(rawValue[0]);
			value.representation = rawValue[1];
			storeLocation(ctx, value, rawValue[2]);

			const entry = new Entry(value, null);
			storeLocation(ctx, entry, start, ctx.lastToken);

			return [entry, undefined];
		}
	}

	// string -> can be argument or property
	const nameOrValue = _parseString(ctx);
	if (!nameOrValue) {
		return;
	}

	const beforeEquals = parseNodeSpace(ctx);

	const equals = consume(ctx, T_EQUALS);
	if (!equals) {
		const value = new Value(nameOrValue[0]);
		value.representation = nameOrValue[1];
		storeLocation(ctx, value, nameOrValue[2]);

		const entry = new Entry(value, null);
		storeLocation(ctx, entry, start, ctx.lastToken);

		return [entry, beforeEquals?.join("")];
	}

	const name = new Identifier(nameOrValue[0]);
	name.representation = nameOrValue[1];
	storeLocation(ctx, name, nameOrValue[2]);

	const afterEquals = parseNodeSpace(ctx);

	const tag = parseTag(ctx);
	const afterTag = tag && parseNodeSpace(ctx);

	const value = parseValue(ctx);
	if (!value) {
		throw mkError(ctx, `Expected a value`);
	}

	const entry = new Entry(value, name);
	storeLocation(ctx, entry, start, ctx.lastToken);
	entry.equals = concatenate(
		beforeEquals?.join(""),
		equals.text,
		afterEquals?.join(""),
	);

	if (tag) {
		entry.tag = tag;
		entry.betweenTagAndValue = afterTag?.join("");
	}

	return [entry, undefined];
}

/** @param {ParserCtx} ctx */
export function parseNodePropOrArgWithSpace(ctx) {
	const leading = parseNodeSpace(ctx) ?? [];

	let tmp;
	while ((tmp = parseSlashdash(ctx))) {
		const propOrArg = parseNodePropOrArg(ctx);
		if (!propOrArg) {
			throw mkError(ctx, `Expected a property or argument`);
		}

		leading.push(tmp, format(propOrArg[0]).slice(1));

		const space = propOrArg[1] ?? parseNodeSpace(ctx)?.join("");

		if (!space) {
			throw mkError(
				ctx,
				`Expected space after slashdashed property or argument`,
			);
		}

		leading.push(space);
	}

	const _entry = parseNodePropOrArg(ctx);
	if (!_entry) {
		return;
	}

	const trailing = _entry[1] ? [_entry[1]] : parseNodeSpace(ctx) ?? [];

	while ((tmp = parseSlashdash(ctx))) {
		const propOrArg = parseNodePropOrArg(ctx);
		if (!propOrArg) {
			throw mkError(ctx, `Expected a property or argument`);
		}

		trailing.push(tmp, format(propOrArg[0]).slice(1));

		const space = propOrArg[1] ?? parseNodeSpace(ctx)?.join("");

		if (!space) {
			break;
		}

		trailing.push(space);
	}

	const entry = _entry[0];

	entry.leading = leading.join("");
	entry.trailing = trailing.join("");

	return entry;
}

/** @param {ParserCtx} ctx */
function parseSlashdash(ctx) {
	let text = consume(ctx, T_SLASHDASH)?.text;
	if (!text) {
		return;
	}

	/** @type {string[]} */
	const result = [];

	while (text) {
		result.push(text);
		text =
			consume(ctx, T_NEWLINE)?.text ??
			parseWs(ctx) ??
			parseSingleLineComment(ctx) ??
			parseEscline(ctx);
	}

	return result.join("");
}

/** @param {ParserCtx} ctx */
export function parseBaseNode(ctx) {
	const startOfNode = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	const tag = parseTag(ctx);
	const betweenTagAndName = tag && parseNodeSpace(ctx);

	const name = parseIdentifier(ctx);
	if (!name) {
		if (tag) {
			throw mkError(ctx, `Couldn't find node name`);
		} else {
			return;
		}
	}

	let space = parseNodeSpace(ctx);
	/** @type {string=} */
	let slashdash;
	/** @type {Entry[]} */
	const entries = [];

	while (space) {
		slashdash = parseSlashdash(ctx);

		const _entry = parseNodePropOrArg(ctx);
		if (!_entry) {
			break;
		}

		if (slashdash) {
			space.push(slashdash, format(_entry[0]).slice(1));
			if (_entry[1]) {
				space.push(_entry[1]);
			}
			slashdash = undefined;

			const extraSpace = parseNodeSpace(ctx);
			if (extraSpace) {
				space.push(extraSpace.join(""));
			}
		} else {
			const entry = _entry[0];
			entry.leading = space.join("");
			entries.push(entry);

			space = _entry[1] ? [_entry[1]] : parseNodeSpace(ctx);
		}
	}

	/** @type {Document=} */
	let possibleChildren;
	/** @type {string[]=} */
	let spaceBeforeChildren;

	while (space) {
		slashdash ??= parseSlashdash(ctx);

		const parsedChildren = parseNodeChildren(ctx);
		if (!parsedChildren) {
			if (slashdash) {
				throw mkError(ctx, `Unexpected slashdash`);
			}

			break;
		}

		if (slashdash) {
			space.push(slashdash, "{", format(parsedChildren), "}");
			slashdash = undefined;
		} else {
			if (possibleChildren) {
				ctx.errors.push(
					mkError(ctx, `A node can only have one children block`),
				);
			}

			possibleChildren = parsedChildren;
			spaceBeforeChildren = space;
			space = undefined;
		}

		const spaceAfter = parseNodeSpace(ctx);
		if (!spaceAfter) {
			break;
		}

		if (space) {
			space.push(...spaceAfter);
		} else {
			space = spaceAfter;
		}
	}

	const node = new Node(name, entries, possibleChildren);
	node.tag = tag ?? null;
	node.betweenTagAndName = betweenTagAndName?.join("");

	node.beforeChildren = spaceBeforeChildren?.join("");
	node.trailing = space?.join("") ?? "";

	storeLocation(ctx, node, startOfNode, ctx.lastToken);

	return node;
}

/** @param {ParserCtx} ctx */
export function parseNodeWithSpace(ctx) {
	const leading = parseLineSpace(ctx);
	const node = parseBaseNode(ctx);
	if (!node) {
		// XXX ctx has been updated by the consumption of leading space...
		// In theory this is bad, but in practice this function is only used in a
		// way that the context is no longer used if we reach this code branch.
		return;
	}
	const trailing = concatenate(
		parseNodeTerminator(ctx),
		parseLineSpace(ctx)?.join(""),
	);

	node.leading = concatenate(leading?.join(""), node.leading);
	node.trailing = concatenate(node.trailing, trailing);

	return node;
}

/** @param {ParserCtx} ctx */
export function parseDocument(ctx) {
	const bom = consume(ctx, T_BOM)?.text;

	const document = _parseDocument(ctx);

	if (!bom) {
		return document;
	}

	if (document.nodes[0]) {
		document.nodes[0].leading = concatenate(bom, document.nodes[0].leading);
	} else {
		document.trailing = concatenate(bom, document.trailing);
	}

	return document;
}

/** @param {ParserCtx} ctx */
function _parseDocument(ctx) {
	const startOfDocument = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	/** @type {Node[]} */
	const nodes = [];

	let hasSeparator = true;

	let space = parseLineSpace(ctx);

	while (hasSeparator) {
		const slashdash = parseSlashdash(ctx);

		const node = parseBaseNode(ctx);
		if (!node) {
			if (slashdash) {
				throw mkError(ctx, `Unexpected slashdash`);
			}

			break;
		}

		const trailing = parseNodeSpace(ctx);
		const terminator = parseNodeTerminator(ctx);

		if (slashdash) {
			space = [
				/** @type {string} */
				(
					concatenate(
						space?.join(""),
						slashdash,
						format(node),
						trailing?.join(""),
						terminator,
						parseLineSpace(ctx)?.join(""),
					)
				),
			];
		} else {
			node.trailing =
				concatenate(node.trailing, trailing?.join(""), terminator) ?? "";
			nodes.push(node);

			node.leading = space?.join("") ?? "";

			space = parseLineSpace(ctx);
		}

		hasSeparator = terminator != null;
	}

	const document = new Document(nodes);
	storeLocation(ctx, document, startOfDocument, ctx.lastToken);

	document.trailing = space?.join("") ?? "";
	return document;
}
