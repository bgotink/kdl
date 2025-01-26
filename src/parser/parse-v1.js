import {format} from "../format.js";
import {storeLocation as _storeLocation} from "../locations.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "../model.js";
import {isValidBareIdentifier, reNewline} from "../string-utils.js";

/** @import {ParserCtx} from "./parse.js"; */
/** @import {Token} from "./token.js" */

import {concatenate, consume, mkError, pop, storeLocation} from "./parse.js";
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
 * @param {ParserCtx} ctx
 * @returns {Value=}
 */
function parseNonStringValue(ctx) {
	const {value: token} = ctx.current;
	let value;
	let text = token?.text;

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
		case T_KEYWORD:
			text = "#" + text;
			switch (token.text) {
				case "null":
					value = null;
					break;
				case "true":
					value = true;
					break;
				case "false":
					value = false;
					break;
				default:
					throw new Error(
						`Unreachable, unexpected keyword ${JSON.stringify(token.text)}`,
					);
			}
			break;
		default:
			return;
	}

	pop(ctx);
	const result = new Value(value);
	result.representation = text;
	storeLocation(ctx, result, token);
	return result;
}

const escapes = new Map([
	["\\n", "\n"],
	["\\r", "\r"],
	["\\t", "\t"],
	["\\\\", "\\"],
	["\\/", "/"],
	['\\"', '"'],
	["\\b", "\b"],
	["\\f", "\f"],
]);

/**
 * @param {ParserCtx} ctx
 * @returns {[string, string, Token]=}
 */
function _parseString(ctx) {
	if (ctx.current.done) {
		return;
	}

	let token = consume(ctx, T_QUOTED_STRING);
	if (token) {
		let raw = token.text;

		const text = raw
			.slice(1, -1)
			.replaceAll(
				/\\u\{(0?[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\}/g,
				(_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)),
			)
			.replaceAll(
				/\\[nrt\\/"bf]/g,
				(s) => /** @type {string} */ (escapes.get(s)),
			);

		if (reNewline.test(raw)) {
			raw = '"""\n' + raw.slice(1, -1) + '\n"""';
		}

		// Remove escape from forward slashes
		raw = raw.replaceAll(/\\[\\/]/g, (s) => (s === "\\/" ? "/" : s));

		return [text, raw, token];
	}

	token = consume(ctx, T_RAW_STRING);
	if (token) {
		// Cut off the leading r, v2 doesn't have it anymore
		let raw = token.text.slice(1);
		let quoteIndex = raw.indexOf('"');

		const text = raw.slice(quoteIndex + 1, -(quoteIndex + 1));

		if (quoteIndex === 0) {
			raw = `#${raw}#`;
			quoteIndex = 1;
		}

		if (reNewline.test(text)) {
			raw =
				raw.slice(0, quoteIndex + 1) +
				'""\n' +
				raw.slice(quoteIndex + 1, -(quoteIndex + 1)) +
				'\n""' +
				raw.slice(-(quoteIndex + 1));
		}

		if (text === '"') {
			// This is one thing that can't be represented as a raw string: #"""# is invalid in KDL v2
			raw = '"\\""';
		}

		return [text, raw, token];
	}

	return;
}

/** @param {ParserCtx} ctx */
function parseIdentifier(ctx) {
	/** @type {[string, string, Token]=} */
	let name;

	let token = consume(ctx, T_IDENTIFIER_STRING);
	if (token) {
		name = [
			token.text,
			isValidBareIdentifier(token.text) ? token.text : `"${token.text}"`,
			token,
		];
	} else {
		name = _parseString(ctx);
	}

	if (!name) {
		return;
	}

	const result = new Identifier(name[0]);
	result.representation = name[1];
	storeLocation(ctx, result, name[2], ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
function parseValue(ctx) {
	const value = parseNonStringValue(ctx);
	if (value) {
		return value;
	}

	const string = _parseString(ctx);
	if (!string) {
		return;
	}

	const result = new Value(string[0]);
	result.representation = string[1];
	storeLocation(ctx, result, string[2], ctx.lastToken);
	return result;
}

/** @param {ParserCtx} ctx */
function parseSingleLineComment(ctx) {
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
function parseMultilineComment(ctx) {
	return consume(ctx, T_COMMENT_MULTI)?.text;
}

/** @param {ParserCtx} ctx */
function parseWs(ctx) {
	return consume(ctx, T_INLINE_WHITESPACE) ?? parseMultilineComment(ctx);
}

/** @param {ParserCtx} ctx */
function parseEscline(ctx) {
	const start = consume(ctx, T_ESCLINE);
	if (!start) {
		return;
	}

	while (parseWs(ctx)) {}

	if (!parseSingleLineComment(ctx) && !consume(ctx, T_NEWLINE)) {
		ctx.errors.push(
			mkError(
				ctx,
				`Expected newline or single-line comment after backslash but got ${ctx.current.value?.text ?? "EOF"}`,
			),
		);
	}

	return ctx.text.slice(start.start.offset, ctx.lastToken.end.offset);
}

/** @param {ParserCtx} ctx */
function parseLineSpace(ctx) {
	const start = ctx.lastToken.end;

	while (
		consume(ctx, T_NEWLINE)?.text ??
		parseSingleLineComment(ctx) ??
		parseWs(ctx)
	) {}

	if (ctx.lastToken.end === start) {
		return undefined;
	}

	return ctx.text.slice(start.offset, ctx.lastToken.end.offset);
}

/** @param {ParserCtx} ctx */
function parseNodeSpace(ctx) {
	const start = ctx.lastToken.end;

	while (parseWs(ctx) ?? parseEscline(ctx)) {}

	if (ctx.lastToken.end === start) {
		return undefined;
	}

	return ctx.text.slice(start.offset, ctx.lastToken.end.offset);
}

/** @param {ParserCtx} ctx */
function parseTag(ctx) {
	const start = consume(ctx, T_OPEN_PAREN);
	if (!start) {
		return;
	}

	let name = parseIdentifier(ctx);

	if (!name) {
		if (parseNonStringValue(ctx)) {
			ctx.errors.push(
				mkError(ctx, "Invalid tag, did you forget to quote a string?"),
			);
			name = new Identifier("error");
			name.representation = "error";
		}
	}

	if (!name) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}

	if (!consume(ctx, T_CLOSE_PAREN)) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}

	const result = new Tag(name.name);
	result.representation = name.representation;

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
function parseNodeChildren(ctx) {
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
 * @returns {Entry=}
 */
function parseNodePropOrArg(ctx) {
	const start = /** @type {Token} */ (ctx.current.value);

	{
		let tag = parseTag(ctx);
		if (tag) {
			// starts with tag -> must be an argument
			const value = parseValue(ctx);
			if (!value) {
				throw mkError(ctx, `Invalid argument`);
			}

			value.tag = tag;

			const entry = new Entry(value, null);

			storeLocation(ctx, value, start, ctx.lastToken);
			storeLocation(ctx, entry, start, ctx.lastToken);

			if (consume(ctx, T_EQUALS)) {
				ctx.errors.push(
					mkError(
						ctx.lastToken,
						typeof value.value === "string" ?
							"Unexpected equals sign, properties are name=(tag)value not (tag)name=value"
						:	"Unexpected equals sign",
					),
				);
			}

			return entry;
		}
	}

	{
		let value = parseNonStringValue(ctx);
		if (value) {
			const entry = new Entry(value, null);
			storeLocation(ctx, entry, start, ctx.lastToken);

			if (consume(ctx, T_EQUALS)) {
				ctx.errors.push(
					mkError(
						ctx.lastToken,
						"Unexpected equals sign, did you forget to quote the property name?",
					),
				);
			}

			return entry;
		}
	}

	// string -> can be argument or property
	const nameOrValue = _parseString(ctx);
	if (nameOrValue && !consume(ctx, T_EQUALS)) {
		const value = new Value(nameOrValue[0]);
		value.representation = nameOrValue[1];
		storeLocation(ctx, value, nameOrValue[2]);

		const entry = new Entry(value, null);
		storeLocation(ctx, entry, start, ctx.lastToken);

		return entry;
	}

	let name;
	if (nameOrValue) {
		name = new Identifier(nameOrValue[0]);
		name.representation = nameOrValue[1];
		storeLocation(ctx, name, nameOrValue[2]);
	} else {
		name = parseIdentifier(ctx);

		if (name && !consume(ctx, T_EQUALS)) {
			ctx.errors.push(
				mkError(
					ctx,
					"Unexpected identifier, did you forget to quote a string?",
				),
			);
			return new Entry(new Value(name.name), null);
		}
	}

	if (!name) {
		return;
	}

	const tag = parseTag(ctx);
	const value = parseValue(ctx);
	if (!value) {
		throw mkError(ctx, `Expected a value`);
	}

	if (tag) {
		value.tag = tag;
	}

	const entry = new Entry(value, name);
	entry.equals = "=";
	storeLocation(ctx, entry, start, ctx.lastToken);

	return entry;
}

/** @param {ParserCtx} ctx */
function parseSlashdash(ctx) {
	let text = consume(ctx, T_SLASHDASH)?.text;
	if (!text) {
		return;
	}

	return concatenate(text, parseNodeSpace(ctx));
}

/** @param {ParserCtx} ctx */
function parseBaseNode(ctx) {
	const startOfNode = /** @type {Token} */ (ctx.current.value);

	const tag = parseTag(ctx);

	const name = parseIdentifier(ctx);
	if (!name) {
		if (tag) {
			throw mkError(ctx, `Couldn't find node name`);
		} else {
			return;
		}
	}

	let space = parseNodeSpace(ctx);
	let hasSpace = true;
	/** @type {string=} */
	let slashdash;
	/** @type {Entry[]} */
	const entries = [];

	while (hasSpace) {
		slashdash = parseSlashdash(ctx);
		const entry = parseNodePropOrArg(ctx);
		if (!entry) {
			break;
		}

		if (slashdash) {
			space = concatenate(space, slashdash, format(entry).slice(1));

			const extra = parseNodeSpace(ctx);
			hasSpace = !!extra;
			space = concatenate(space, extra);

			slashdash = undefined;
		} else {
			entry.leading = space;
			entries.push(entry);

			space = parseNodeSpace(ctx);
			hasSpace = !!space;
		}
	}

	let trailing = space;
	/** @type {string=} */
	let beforeChildren;

	let children = parseNodeChildren(ctx);

	if (slashdash) {
		if (children) {
			trailing = concatenate(trailing, slashdash, "{" + format(children) + "}");
			children = undefined;
			space = undefined;
		} else {
			if (slashdash) {
				throw mkError(ctx, `Unexpected slashdash`);
			}
		}
	}

	if (children) {
		beforeChildren = trailing;
		trailing = undefined;
	}

	const node = new Node(name, entries, children);
	node.tag = tag ?? null;

	node.beforeChildren = beforeChildren;
	node.trailing = trailing;

	storeLocation(ctx, node, startOfNode, ctx.lastToken);

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
	const startOfDocument = /** @type {Token} */ (ctx.current.value);

	/** @type {Node[]} */
	const nodes = [];

	let space = parseLineSpace(ctx);

	while (true) {
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
		if (terminator == null) {
			ctx.errors.push(mkError(ctx, "Missing node terminator"));
		}

		if (slashdash) {
			// prevent format(node) from appending a newline
			node.trailing ??= "";

			space =
				/** @type {string} */
				(
					concatenate(
						concatenate(space, slashdash),
						concatenate(format(node), trailing, terminator),
						parseLineSpace(ctx),
					)
				);
		} else {
			node.trailing = concatenate(node.trailing, trailing, terminator) ?? "";
			nodes.push(node);

			node.leading = space ?? "";

			space = parseLineSpace(ctx);
		}
	}

	const document = new Document(nodes);
	storeLocation(ctx, document, startOfDocument, ctx.lastToken);

	document.trailing = space ?? "";
	return document;
}
