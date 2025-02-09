import {InvalidKdlError} from "../error.js";
import {storeLocation as _storeLocation} from "../locations.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "../model.js";
import {
	postProcessMultilineRawStringValue,
	postProcessMultilineStringValue,
	postProcessRawStringValue,
	postProcessStringValue,
} from "../string-utils.js";

/** @import {Token} from "./token.js" */

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
 * @prop {string} text
 * @prop {IteratorResult<Token, void>} current
 * @prop {Iterator<Token, void>} tokens
 * @prop {Token} lastToken
 * @prop {boolean} storeLocations
 * @prop {InvalidKdlError[]} errors
 */

/** @param {ParserCtx} ctx */
export function pop(ctx) {
	if (!ctx.current.done) {
		ctx.lastToken = ctx.current.value;
	}

	ctx.current = ctx.tokens.next();

	const errors = !ctx.current.done && ctx.current.value.errors;
	if (errors) {
		ctx.errors.push(...errors);
	}
}

/**
 * @param {ParserCtx} ctx
 * @param {Token['type']} tokenType
 */
export function consume(ctx, tokenType) {
	if (!ctx.current.done && ctx.current.value.type === tokenType) {
		const token = ctx.current.value;
		pop(ctx);

		return token;
	}
}

/**
 * @param {ParserCtx | Token} ctx
 * @param {string} message
 */
export function mkError(ctx, message) {
	const token = "current" in ctx ? (ctx.current.value ?? ctx.lastToken) : ctx;
	return new InvalidKdlError(message, {token});
}

/**
 * @param {ParserCtx} ctx
 * @param {Value | Identifier | Tag | Entry | Node | Document} value
 * @param {Token} start
 * @param {Token} [end]
 */
export function storeLocation(ctx, value, start, end = start) {
	if (ctx.storeLocations) {
		_storeLocation(value, start, end);
	}
}

export function concatenate(one = "", two = "", three = "") {
	return one + two + three || undefined;
}

/**
 * @param {string} text
 * @param {Iterable<Token>} tokens
 * @param {object} [options]
 * @param {boolean} [options.storeLocations]
 * @returns {ParserCtx}
 */
export function createParserCtx(text, tokens, {storeLocations = false} = {}) {
	const iterator = tokens[Symbol.iterator]();

	return {
		text,
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
			errors: null,
		},
		errors: [],
	};
}

/**
 * @param {ParserCtx} ctx
 * @param {unknown} [fatalError]
 */
export function finalize(ctx, fatalError) {
	if (!fatalError && !ctx.current.done && ctx.current.value.type !== T_EOF) {
		fatalError = mkError(
			ctx,
			`Unexpected token ${JSON.stringify(ctx.current.value.text)}, did you forget to quote an identifier?`,
		);
	}

	const errors = ctx.errors ?? [];

	if (fatalError != null) {
		if (fatalError instanceof InvalidKdlError) {
			if (fatalError.errors) {
				errors.push(...fatalError.errors);
			} else {
				errors.push(fatalError);
			}
		} else {
			errors.push(
				new InvalidKdlError(
					`An unexpected error occurred, ${String(fatalError)}, this is likely a bug in the KDL parser`,
					{cause: fatalError},
				),
			);
		}
	}

	if (errors.length) {
		if (errors.length === 1) {
			throw errors[0];
		} else {
			throw new InvalidKdlError("Encountered multiple errors", {errors});
		}
	}
}

/**
 * @param {ParserCtx} ctx
 * @returns {Value=}
 */
function parseNonStringValue(ctx) {
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
		case T_KEYWORD:
			switch (token.text) {
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
					switch (token.text.toLowerCase()) {
						case "#null":
						case "#true":
						case "#false":
						case "#inf":
						case "#-inf":
						case "#nan":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, keywords are case sensitive, write ${token.text.toLowerCase()} instead`,
								),
							);
							break;
						case "#nul":
						case "#nill":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, did you mean #null?`,
								),
							);
							break;
						case "#fals":
						case "#fasle":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, did you mean #false?`,
								),
							);
							break;
						case "#ture":
						case "#treu":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, did you mean #true?`,
								),
							);
							break;
						case "#ifn":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, did you mean #inf?`,
								),
							);
							break;
						case "#-ifn":
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, did you mean #-inf?`,
								),
							);
							break;
						default:
							ctx.errors.push(
								mkError(
									ctx,
									`Invalid keyword ${token.text}, surround it with quotes to use a string`,
								),
							);
					}
					value = null;
			}
			break;
		default:
			return;
	}

	pop(ctx);
	const result = new Value(value);
	result.representation = token.text;
	storeLocation(ctx, result, token);
	return result;
}

/**
 * @param {ParserCtx} ctx
 * @returns {[string, string, Token]=}
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
				postProcessStringValue(ctx.errors, token.text.slice(1, -1), token),
				token.text,
				token,
			];
		case T_MULTILINE_QUOTED_STRING:
			pop(ctx);
			return [
				postProcessMultilineStringValue(
					ctx.errors,
					token.text.slice(3, -3),
					token,
				),
				token.text,
				token,
			];
		case T_RAW_STRING: {
			pop(ctx);

			const raw = token.text;
			const quoteIndex = raw.indexOf('"');

			return [
				postProcessRawStringValue(
					ctx.errors,
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
					ctx.errors,
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
	return consume(ctx, T_INLINE_WHITESPACE) ?? parseMultilineComment(ctx);
}

/** @param {ParserCtx} ctx */
export function parseEscline(ctx) {
	const start = consume(ctx, T_ESCLINE);
	if (!start) {
		return;
	}

	while (parseWs(ctx)) {}

	if (
		!parseSingleLineComment(ctx) &&
		!consume(ctx, T_NEWLINE) &&
		!consume(ctx, T_EOF)
	) {
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
		parseWs(ctx) ??
		parseEscline(ctx)
	) {}

	if (ctx.lastToken.end === start) {
		return undefined;
	}

	return ctx.text.slice(start.offset, ctx.lastToken.end.offset);
}

/** @param {ParserCtx} ctx */
export function parseNodeSpace(ctx) {
	const start = ctx.lastToken.end;

	while (parseWs(ctx) ?? parseEscline(ctx)) {}

	if (ctx.lastToken.end === start) {
		return undefined;
	}

	return ctx.text.slice(start.offset, ctx.lastToken.end.offset);
}

/** @param {ParserCtx} ctx */
export function parseTag(ctx) {
	const start = consume(ctx, T_OPEN_PAREN);
	if (!start) {
		return;
	}

	const leading = parseNodeSpace(ctx);

	/** @type {[string, string, ...unknown[]]=} */
	let name = _parseString(ctx);

	if (!name && ctx.current.value) {
		const location = ctx.current.value;
		if (parseLineSpace(ctx)) {
			ctx.errors.push(
				mkError(
					location,
					"This type of whitespace is not allowed inside a tag",
				),
			);
		}

		name = _parseString(ctx);
	}

	if (!name) {
		if (parseNonStringValue(ctx)) {
			ctx.errors.push(
				mkError(ctx, "Invalid tag, did you forget to quote a string?"),
			);
			name = ["error", "error"];
		}
	}

	if (!name) {
		throw mkError(ctx, "Invalid tag, did you forget to quote a string?");
	}

	const trailing = parseNodeSpace(ctx);

	let end = consume(ctx, T_CLOSE_PAREN);

	if (!end && ctx.current.value) {
		const location = ctx.current.value;
		if (parseLineSpace(ctx)) {
			ctx.errors.push(
				mkError(
					location,
					"This type of whitespace is not allowed inside a tag",
				),
			);
		}

		end = consume(ctx, T_CLOSE_PAREN);
	}

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
	const start = /** @type {Token} */ (ctx.current.value);

	{
		let tag = parseTag(ctx);
		if (tag) {
			// starts with tag -> must be an argument
			const betweenTagAndValue = parseNodeSpace(ctx);
			const value = parseValue(ctx);
			if (!value) {
				throw mkError(ctx, `Invalid argument`);
			}

			value.tag = tag;
			value.betweenTagAndValue = betweenTagAndValue;

			const entry = new Entry(value, null);

			storeLocation(ctx, value, start, ctx.lastToken);
			storeLocation(ctx, entry, start, ctx.lastToken);

			let trailing = parseNodeSpace(ctx);
			if (consume(ctx, T_EQUALS)) {
				ctx.errors.push(
					mkError(
						ctx.lastToken,
						typeof value.value === "string" ?
							"Unexpected equals sign, properties are name=(tag)value not (tag)name=value"
						:	"Unexpected equals sign",
					),
				);

				// Consume any space after the equals sign, and then drop the equals sign
				// whatever would come after the equals sign will then get picked up as argument
				// which is fine because we'll error out anyway.
				// As any value would get consumed as argument, ensure there always is whitespace,
				// even if in reality there isn't.
				trailing = concatenate(trailing, parseNodeSpace(ctx)) || " ";
			}

			return [entry, trailing];
		}
	}

	{
		let value = parseNonStringValue(ctx);
		if (value) {
			const entry = new Entry(value, null);
			storeLocation(ctx, entry, start, ctx.lastToken);

			let trailing = parseNodeSpace(ctx);
			if (consume(ctx, T_EQUALS)) {
				ctx.errors.push(
					mkError(
						ctx.lastToken,
						"Unexpected equals sign, did you forget to quote the property name?",
					),
				);

				// Consume any space after the equals sign, and then drop the equals sign
				// whatever would come after the equals sign will then get picked up as argument
				// which is fine because we'll error out anyway.
				// As any value would get consumed as argument, ensure there always is whitespace,
				// even if in reality there isn't.
				trailing = concatenate(trailing, parseNodeSpace(ctx)) || " ";
			}

			return [entry, trailing];
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

		return [entry, beforeEquals];
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

	if (tag) {
		value.tag = tag;
		value.betweenTagAndValue = afterTag;
	}

	const entry = new Entry(value, name);
	storeLocation(ctx, entry, start, ctx.lastToken);
	entry.equals = concatenate(beforeEquals, equals.text, afterEquals);

	return [entry, undefined];
}

/** @param {ParserCtx} ctx */
export function parseNodePropOrArgWithSpace(ctx) {
	let leading = parseNodeSpace(ctx) ?? "";

	let tmp;
	while ((tmp = parseSlashdash(ctx))) {
		const start = ctx.lastToken.end;
		const propOrArg = parseNodePropOrArg(ctx);
		if (!propOrArg) {
			throw mkError(ctx, `Expected a property or argument`);
		}

		const space = propOrArg[1] ?? parseNodeSpace(ctx);
		if (!space) {
			throw mkError(
				ctx,
				`Expected space after slashdashed property or argument`,
			);
		}

		leading =
			leading + tmp + ctx.text.slice(start.offset, ctx.lastToken.end.offset);
	}

	const _entry = parseNodePropOrArg(ctx);
	if (!_entry) {
		return;
	}

	let trailing = _entry[1] ?? parseNodeSpace(ctx) ?? "";

	while ((tmp = parseSlashdash(ctx))) {
		const start = ctx.lastToken.end;
		const propOrArg = parseNodePropOrArg(ctx);
		if (!propOrArg) {
			throw mkError(ctx, `Expected a property or argument`);
		}

		const space = propOrArg[1] ?? parseNodeSpace(ctx);
		if (!space) {
			break;
		}

		trailing =
			trailing + tmp + ctx.text.slice(start.offset, ctx.lastToken.end.offset);
	}

	const entry = _entry[0];

	entry.leading = leading;
	entry.trailing = trailing;

	return entry;
}

/** @param {ParserCtx} ctx */
function parseSlashdash(ctx) {
	let text = consume(ctx, T_SLASHDASH)?.text;
	if (!text) {
		return;
	}

	return concatenate(text, parseLineSpace(ctx));
}

/** @param {ParserCtx} ctx */
export function parseBaseNode(ctx) {
	const startOfNode = /** @type {Token} */ (ctx.current.value);

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
	let endsOnWhitespace = space != null;
	/** @type {string=} */
	let slashdash = parseSlashdash(ctx);
	/** @type {Entry[]} */
	const entries = [];

	while (space || slashdash) {
		const start = ctx.lastToken.end;

		const _entry = parseNodePropOrArg(ctx);
		if (!_entry) {
			break;
		}

		if (slashdash) {
			endsOnWhitespace = parseNodeSpace(ctx) != null;
			space = concatenate(
				space,
				slashdash,
				ctx.text.slice(start.offset, ctx.lastToken.end.offset),
			);

			slashdash = parseSlashdash(ctx);
		} else {
			const entry = _entry[0];
			entry.leading = space;
			entries.push(entry);

			space = _entry[1] || parseNodeSpace(ctx);
			endsOnWhitespace = space != null;
			slashdash = parseSlashdash(ctx);
		}
	}

	/** @type {Document=} */
	let possibleChildren;
	/** @type {string=} */
	let spaceBeforeChildren;

	while (true) {
		slashdash ??= parseSlashdash(ctx);
		const start = ctx.lastToken.end;

		const parsedChildren = parseNodeChildren(ctx);
		if (!parsedChildren) {
			if (slashdash) {
				throw mkError(ctx, `Unexpected slashdash`);
			}

			break;
		}

		if (slashdash) {
			space = concatenate(
				space,
				slashdash,
				ctx.text.slice(start.offset, ctx.lastToken.end.offset),
			);
			slashdash = undefined;
		} else {
			if (possibleChildren) {
				ctx.errors.push(
					mkError(ctx, `A node can only have one children block`),
				);
			}

			possibleChildren = parsedChildren;
			spaceBeforeChildren = space ?? "";
			space = undefined;
		}

		space = concatenate(space, parseNodeSpace(ctx));
	}

	const node = new Node(name, entries, possibleChildren);
	node.tag = tag ?? null;
	node.betweenTagAndName = betweenTagAndName;

	node.beforeChildren = spaceBeforeChildren;
	node.trailing = space ?? "";

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
	const trailing = concatenate(parseNodeTerminator(ctx), parseLineSpace(ctx));

	node.leading = concatenate(leading, node.leading);
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
	const startOfDocument = /** @type {Token} */ (ctx.current.value);

	/** @type {Node[]} */
	const nodes = [];

	let hasSeparator = true;

	let space = parseLineSpace(ctx);

	while (hasSeparator) {
		const start = ctx.lastToken.end;
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
			space =
				/** @type {string} */
				(
					concatenate(
						space,
						ctx.text.slice(start.offset, ctx.lastToken.end.offset),
						parseLineSpace(ctx),
					)
				);
		} else {
			node.trailing = concatenate(node.trailing, trailing, terminator) ?? "";
			nodes.push(node);

			node.leading = space ?? "";

			space = parseLineSpace(ctx);
		}

		hasSeparator = terminator != null;
	}

	const document = new Document(nodes);
	storeLocation(ctx, document, startOfDocument, ctx.lastToken);

	document.trailing = space ?? "";
	return document;
}
