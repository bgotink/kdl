import {InvalidKdlError, stringifyTokenOffset} from "../error.js";
import {format} from "../format.js";
import {storeLocation as _storeLocation} from "../locations.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "../model.js";
import {
	removeEscapedWhitespace,
	removeLeadingWhitespace,
	replaceEscapes,
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
 */

/** @param {ParserCtx} ctx */
function pop(ctx) {
	if (!ctx.current.done) {
		ctx.lastToken = ctx.current.value;
	}

	ctx.current = ctx.tokens.next();
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
		},
	};
}

/** @param {ParserCtx} ctx */
export function assertAtEOF(ctx) {
	if (ctx.current.done || ctx.current.value.type === T_EOF) {
		return;
	}

	throw mkError(
		ctx,
		`Expected EOF but found extra content ${JSON.stringify(ctx.current.value.text)}`,
	);
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
				throw new InvalidKdlError(
					`Invalid keyword "${token.text}", add a leading # to use the keyword, surround with quotes to pass a string`,
				);
			}
			return [token.text, token.text, token];
		case T_QUOTED_STRING:
			pop(ctx);
			return [
				replaceEscapes(
					removeLeadingWhitespace(
						removeEscapedWhitespace(token.text.slice(1, -1)),
						token,
					),
				),
				token.text,
				token,
			];
		case T_RAW_STRING: {
			pop(ctx);

			const raw = token.text;
			const quoteIndex = raw.indexOf('"');

			return [
				removeLeadingWhitespace(
					raw.slice(quoteIndex + 1, -(quoteIndex + 1)),
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
			throw mkError(ctx, `Invalid keyword ${raw}`);
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
export function parseEscline(ctx) {
	const start = consume(ctx, T_ESCLINE);
	if (!start) {
		return;
	}

	const parts = [start.text];

	while (true) {
		const part =
			parseMultilineComment(ctx) ?? consume(ctx, T_INLINE_WHITESPACE)?.text;

		if (!part) {
			break;
		}

		parts.push(part);
	}

	const end = parseSingleLineComment(ctx) ?? consume(ctx, T_NEWLINE)?.text;
	if (!end) {
		throw mkError(
			ctx,
			`Expected newline or single-line comment after backslash but got ${ctx.current.value?.text ?? "EOF"}`,
		);
	}
	parts.push(end);

	return parts.join("");
}

/** @param {ParserCtx} ctx */
function parsePlainLineSpace(ctx) {
	return (
		consume(ctx, T_BOM)?.text ??
		consume(ctx, T_NEWLINE)?.text ??
		consume(ctx, T_INLINE_WHITESPACE)?.text ??
		parseSingleLineComment(ctx) ??
		parseMultilineComment(ctx)
	);
}

/** @param {ParserCtx} ctx */
function parsePlainNodeSpace(ctx) {
	return (
		parseEscline(ctx) ??
		consume(ctx, T_INLINE_WHITESPACE)?.text ??
		parseMultilineComment(ctx)
	);
}

/** @param {ParserCtx} ctx */
function parseLineSpace(ctx) {
	/** @type {string[]} */
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
				result.push(part);
				while ((part = parsePlainNodeSpace(ctx))) {
					result.push(part);
				}

				const node = parseNode(ctx);
				if (!node) {
					throw mkError(ctx, "Invalid slashdash, expected a commented node");
				}

				result.push(format(node));
				continue;
			}
		}

		break;
	}

	return result.length > 0 ? result.join("") : undefined;
}

/**
 * @param {ParserCtx} ctx
 * @returns {[string, boolean]=}
 */
function parseNodeSpaceSlashDash(ctx) {
	const slashdash = consume(ctx, T_SLASHDASH);
	if (slashdash == null) {
		return;
	}

	const result = [slashdash.text];

	let part;
	while ((part = parsePlainNodeSpace(ctx))) {
		result.push(part);
	}

	let tmp;
	let endsWithNodeSpace = false;
	if ((tmp = parseNodePropOrArg(ctx))) {
		result.push(format(tmp[0]).slice(1) + (tmp[1]?.[0] ?? ""));
		endsWithNodeSpace = tmp[1]?.[1] ?? false;
	} else if ((tmp = parseNodeChildren(ctx))) {
		result.push(`{${format(tmp)}}`);
	} else {
		throw mkError(
			slashdash,
			`Couldn't find argument, property, or children that were commented by slashdash`,
		);
	}

	return [result.join(""), endsWithNodeSpace];
}

// function parseRequiredNodeSpace = not defined,
// use optionalNodeSpace and check whether it ends with inline whitespace or newline instead
/** @param {ParserCtx} ctx */
function parseOptionalNodeSpace(ctx) {
	/** @type {string[]} */
	const result = [];
	let endsWithPlainSpace = false;

	while (true) {
		const part = parsePlainNodeSpace(ctx);
		if (!part) {
			break;
		}

		endsWithPlainSpace = true;
		result.push(part);

		while (endsWithPlainSpace) {
			const slashDash = parseNodeSpaceSlashDash(ctx);
			if (!slashDash) {
				break;
			}

			result.push(slashDash[0]);
			endsWithPlainSpace = slashDash[1];
		}
	}

	return /** @type {[String, boolean]} */ ([
		result.join(""),
		endsWithPlainSpace,
	]);
}

/** @param {ParserCtx} ctx */
function parseTag(ctx) {
	const start = consume(ctx, T_OPEN_PAREN);
	if (!start) {
		return;
	}

	const leading = parseOptionalNodeSpace(ctx)[0];
	const name = _parseString(ctx);
	if (!name) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}
	const trailing = parseOptionalNodeSpace(ctx)[0];

	const end = consume(ctx, T_CLOSE_PAREN);
	if (!end) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}

	const result = new Tag(name[0]);
	result.representation = name[1];

	result.leading = leading;
	result.trailing = trailing;

	storeLocation(ctx, result, start, ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
function parseNodeTerminator(ctx) {
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

	const document = parseDocument(ctx);

	if (!consume(ctx, T_CLOSE_BRACE)) {
		throw mkError(ctx, `Invalid node children`);
	}

	return document;
}

/**
 * @param {ParserCtx} ctx
 * @returns {[Entry, [string, boolean] | undefined]=}
 */
export function parseNodePropOrArg(ctx) {
	const start = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	{
		let tag = parseTag(ctx);
		if (tag) {
			// starts with tag -> must be an argument
			const betweenTagAndValue = parseOptionalNodeSpace(ctx)[0];
			const value = parseValue(ctx);
			if (!value) {
				throw mkError(ctx, `Invalid argument`);
			}

			const entry = new Entry(value, null);
			entry.tag = tag;
			entry.betweenTagAndValue = betweenTagAndValue;

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

			return [new Entry(value, null), undefined];
		}
	}

	// string -> can be argument or property
	const nameOrValue = _parseString(ctx);
	if (!nameOrValue) {
		return;
	}

	const beforeEquals = parseOptionalNodeSpace(ctx);

	const equals = consume(ctx, T_EQUALS);
	if (!equals) {
		const value = new Value(nameOrValue[0]);
		value.representation = nameOrValue[1];
		storeLocation(ctx, value, nameOrValue[2]);
		return [new Entry(value, null), beforeEquals];
	}

	const name = new Identifier(nameOrValue[0]);
	name.representation = nameOrValue[1];
	storeLocation(ctx, name, nameOrValue[2]);

	const afterEquals = parseOptionalNodeSpace(ctx);

	const tag = parseTag(ctx);
	const afterTag = tag && parseOptionalNodeSpace(ctx);

	const value = parseValue(ctx);
	if (!value) {
		throw mkError(ctx, `Expected a value`);
	}

	const entry = new Entry(value, name);
	storeLocation(ctx, entry, start, ctx.lastToken);
	entry.equals = `${beforeEquals[0]}${equals.text}${afterEquals[0]}`;

	if (tag) {
		entry.tag = tag;
		entry.betweenTagAndValue = /** @type {[string, unknown]} */ (afterTag)[0];
	}

	return [entry, undefined];
}

/** @param {ParserCtx} ctx */
export function parseNodePropOrArgWithSpace(ctx) {
	const leading =
		(parseNodeSpaceSlashDash(ctx)?.[0] ?? "") + parseOptionalNodeSpace(ctx)[0];

	const _entry = parseNodePropOrArg(ctx);
	if (!_entry) {
		return;
	}

	const trailing = parseOptionalNodeSpace(ctx)[0];

	const entry = _entry[0];

	entry.leading = leading;
	entry.trailing = (_entry[1]?.[0] ?? "") + trailing;

	return entry;
}

/** @param {ParserCtx} ctx */
function parseNodePropsAndArgs(ctx) {
	// let start = $.LA(1);
	/** @type {Entry[]} */
	const entries = [];

	/** @type {[string, import("./tokenize.js").Token, import("./tokenize.js").Token, string, string, import("./tokenize.js").Token]=} */
	let entryName;

	const mkPreviousEntry = () => {
		if (entryName == null) {
			return;
		}

		const previousValue = new Value(entryName[3]);
		previousValue.representation = entryName[4];
		storeLocation(ctx, previousValue, entryName[5]);

		const previousEntry = new Entry(previousValue, null);
		previousEntry.leading = entryName[0];
		storeLocation(ctx, previousEntry, entryName[1], entryName[2]);

		entries.push(previousEntry);

		entryName = undefined;
	};

	let space = /** @type {readonly [string, boolean]} */ (["", true]);

	while (true) {
		const start = /** @type {import("./tokenize.js").Token} */ (
			ctx.current.value
		);

		if (space[1]) {
			{
				const tag = parseTag(ctx);
				if (tag) {
					// start with tag -> must be a value

					const betweenTagAndValue = parseOptionalNodeSpace(ctx)[0];
					const value = parseValue(ctx);
					if (!value) {
						throw mkError(ctx, `Expected a value`);
					}

					mkPreviousEntry();

					const entry = new Entry(value, null);
					entry.leading = space[0];
					entry.tag = tag;
					entry.betweenTagAndValue = betweenTagAndValue;

					storeLocation(ctx, entry, start, ctx.lastToken);
					entries.push(entry);
					space = parseOptionalNodeSpace(ctx);
					continue;
				}
			}

			{
				const rawValue = _parseKeyword(ctx) ?? _parseNumber(ctx);
				if (rawValue) {
					// non-string -> must be a value
					mkPreviousEntry();

					const value = new Value(rawValue[0]);
					value.representation = rawValue[1];
					storeLocation(ctx, value, rawValue[2]);

					const entry = new Entry(value, null);
					entry.leading = space[0];

					storeLocation(ctx, entry, start);
					entries.push(entry);
					space = parseOptionalNodeSpace(ctx);
					continue;
				}
			}
		}

		const _equals = consume(ctx, T_EQUALS);
		if (_equals) {
			// equals -> must be a value, but can only happen if we already have a property name
			if (entryName == null) {
				throw mkError(
					_equals,
					`Unexpected character "${_equals.text}", did you forget to quote a property name that isn't a valid identifier?`,
				);
			}

			const equalsString =
				space[0] + _equals.text + parseOptionalNodeSpace(ctx)[0];

			const tag = parseTag(ctx);
			const betweenTagAndValue = tag && parseOptionalNodeSpace(ctx)[0];

			const value = parseValue(ctx);
			if (!value) {
				throw mkError(ctx, `Expected a value`);
			}

			const [
				leading,
				startOfEntry,
				endOfEntry,
				nameString,
				nameRepresentation,
				startOfName,
			] = /** @type {NonNullable<typeof entryName>} */ (entryName);
			entryName = undefined;

			const name = new Identifier(nameString);
			name.representation = nameRepresentation;
			storeLocation(ctx, name, startOfName);

			const entry = new Entry(value, name);
			entry.leading = leading;
			entry.equals = equalsString;

			if (tag) {
				entry.tag = tag;
				entry.betweenTagAndValue = betweenTagAndValue;
			}

			storeLocation(ctx, entry, startOfEntry, endOfEntry);
			entries.push(entry);
			space = parseOptionalNodeSpace(ctx);
			continue;
		}

		if (space[1]) {
			const nameOrValue = _parseString(ctx);
			if (nameOrValue) {
				// string -> could be argument or property, we don't know yet
				mkPreviousEntry();

				entryName = [space[0], start, ctx.lastToken, ...nameOrValue];

				space = parseOptionalNodeSpace(ctx);
				continue;
			}
		}

		break;
	}

	mkPreviousEntry();

	return /** @type {[Entry[], [string, boolean]]} */ ([entries, space]);
}

/** @param {ParserCtx} ctx */
function parseBaseNode(ctx) {
	const startOfNode = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	const tag = parseTag(ctx);
	const betweenTagAndName = tag && parseOptionalNodeSpace(ctx)[0];

	const name = parseIdentifier(ctx);
	if (!name) {
		return;
	}

	/** @type {Entry[]} */
	let entries = [];

	let space = parseOptionalNodeSpace(ctx);

	if (space[1]) {
		const tmp = parseNodePropsAndArgs(ctx);
		if (tmp[0].length > 0) {
			entries = tmp[0];
			entries[0].leading = space[0] + (entries[0].leading ?? "");

			space = tmp[1];
		}
	}

	const possibleChildren = space[1] ? parseNodeChildren(ctx) : undefined;

	const node = new Node(name, entries, possibleChildren);
	node.tag = tag ?? null;
	node.betweenTagAndName = betweenTagAndName;
	if (node.children) {
		node.beforeChildren = space[0];
	} else {
		node.trailing = space[0];
	}

	storeLocation(ctx, node, startOfNode, ctx.lastToken);

	return node;
}

/** @param {ParserCtx} ctx */
export function parseNode(ctx) {
	const baseNode = parseBaseNode(ctx);
	if (!baseNode) {
		return;
	}

	const trailing = parseOptionalNodeSpace(ctx)[0];
	const terminator = parseNodeTerminator(ctx);
	if (terminator == null) {
		throw mkError(ctx, `Expected a node terminator`);
	}

	baseNode.trailing = (baseNode.trailing ?? "") + trailing + terminator;
	return baseNode;
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
	const trailing =
		parseOptionalNodeSpace(ctx)[0] +
		(parseNodeTerminator(ctx) ?? "") +
		(parseLineSpace(ctx) ?? "");

	node.leading = leading;
	node.trailing = trailing;

	return node;
}

/** @param {ParserCtx} ctx */
export function parseDocument(ctx) {
	const startOfDocument = /** @type {import("./tokenize.js").Token} */ (
		ctx.current.value
	);

	/** @type {Node[]} */
	const nodes = [];

	let hasSeparator = true;

	let space = parseLineSpace(ctx) ?? "";

	while (hasSeparator) {
		const node = parseBaseNode(ctx);
		if (!node) {
			break;
		}

		const trailing = parseOptionalNodeSpace(ctx)[0];
		const terminator = parseNodeTerminator(ctx);

		node.trailing = (node.trailing ?? "") + trailing + (terminator ?? "");
		nodes.push(node);

		node.leading = space;

		space = parseLineSpace(ctx) ?? "";

		hasSeparator = terminator != null;
	}

	const document = new Document(nodes);
	storeLocation(ctx, document, startOfDocument, ctx.lastToken);

	document.trailing = space;
	return document;
}
