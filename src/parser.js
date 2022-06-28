import {EmbeddedActionsParser, EOF, Lexer} from 'chevrotain';
import {format} from './format.js';
import {storeLocation} from './locations.js';

import {Document, Entry, Identifier, Node, Value} from './model.js';

import {plainIdentifier} from './tokens/identifier.js';
import {
	binaryNumber,
	float,
	hexadecimalNumber,
	integer,
	octalNumber,
	sign,
} from './tokens/numbers.js';
import {_null, boolean} from './tokens/other-values.js';
import {
	closeBrace,
	closeParenthesis,
	equals,
	escLine,
	openBrace,
	openParenthesis,
	semicolon,
} from './tokens/punctuation.js';
import {
	closeQuote,
	escape,
	escapedValues,
	openQuote,
	rawString,
	stringMode,
	unicode,
	unicodeEscape,
} from './tokens/strings.js';
import {
	closeMultiLineComment,
	multiLineCommentContent,
	multiLineCommentMode,
	newLine,
	openMultiLineComment,
	singleLineComment,
	slashDash,
	inlineWhitespace,
	reContainsNewLine,
} from './tokens/whitespace.js';

const defaultMode = 'default';

/** @type {import('chevrotain').IMultiModeLexerDefinition} */
const tokens = {
	defaultMode,
	modes: {
		[defaultMode]: [
			inlineWhitespace,
			newLine,
			slashDash,
			singleLineComment,
			openMultiLineComment,

			boolean,
			_null,
			rawString,
			sign,
			binaryNumber,
			hexadecimalNumber,
			octalNumber,
			float,
			integer,

			semicolon,
			equals,

			openBrace,
			closeBrace,

			openParenthesis,
			closeParenthesis,

			escLine,
			openQuote,

			plainIdentifier,
		],
		[stringMode]: [unicode, escape, unicodeEscape, closeQuote],
		[multiLineCommentMode]: [
			closeMultiLineComment,
			openMultiLineComment,
			multiLineCommentContent,
		],
	},
};

export class KdlLexer extends Lexer {
	constructor() {
		super(tokens);
	}
}

export class KdlParser extends EmbeddedActionsParser {
	storeLocationInfo = false;

	/**
	 * @param {Value | Identifier | Entry | Node | Document} el
	 * @param {import('chevrotain').IToken} [start]
	 */
	#storeLocation(el, start) {
		if (this.storeLocationInfo) {
			const end = this.LA(0);
			if (start == null) {
				start = end;
			}

			if (isNaN(end.startOffset)) {
				// startOffset is NaN if we reached the end of our file
				const beforeEnd = this.LA(-1);
				const singleLine = !reContainsNewLine.test(beforeEnd.image);

				storeLocation(el, {
					startOffset: start.startOffset,
					startLine: start.startLine,
					startColumn: start.startColumn,

					endOffset: beforeEnd.startOffset + beforeEnd.image.length,
					endLine: singleLine ? beforeEnd.startLine : undefined,
					endColumn:
						singleLine && beforeEnd.startColumn != null
							? beforeEnd.startColumn + beforeEnd.image.length - 1
							: undefined,
				});
				return;
			}

			storeLocation(el, {
				startOffset: start.startOffset,
				startLine: start.startLine,
				startColumn: start.startColumn,

				endOffset: end.startOffset + end.image.length,
				endLine: end.endLine,
				endColumn: end.endColumn,
			});
		}
	}

	constructor() {
		super(tokens);

		const $ = this;

		const rNull = $.RULE(
			'null',
			() => /** @type {const} */ ([null, $.CONSUME(_null).image]),
		);
		const rBoolean = $.RULE('boolean', () => {
			const raw = $.CONSUME(boolean).image;
			return /** @type {const} */ ([raw === 'true', raw]);
		});

		const rNumber = $.RULE('number', () => {
			const start = $.OPTION(() => $.CONSUME(sign));
			const s = start?.image ?? '';

			/** @type {[number, string]} */
			const number = $.OR([
				{
					ALT: () => {
						const raw = $.CONSUME(binaryNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ''), 2), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(octalNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ''), 8), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(hexadecimalNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ''), 16), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(float).image;
						return [parseFloat(raw.replace(/_/g, '')), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(integer).image;
						return [parseInt(raw.replace(/_/g, ''), 10), raw];
					},
				},
			]);

			return /** @type {const} */ ([
				(s === '-' ? -1 : 1) * number[0],
				s + number[1],
				start,
			]);
		});

		const rString = $.RULE('string', () => {
			/** @type {string[]} */
			const string = [];
			const start = $.CONSUME(openQuote);
			const raw = [start.image];

			$.MANY(() => {
				/** @type {[string, string]} */
				const tmp = $.OR([
					{
						ALT: /** @return {[string, string]} */ () => {
							const raw = this.CONSUME(escape).image;

							return [/** @type {string} */ (escapedValues.get(raw)), raw];
						},
					},
					{
						ALT: () => {
							const raw = this.CONSUME(unicodeEscape).image;

							return [String.fromCharCode(parseInt(raw.slice(3, -1), 16)), raw];
						},
					},
					{
						ALT: () => {
							const raw = $.CONSUME(unicode).image;

							return [raw, raw];
						},
					},
				]);

				string.push(tmp[0]);
				raw.push(tmp[1]);
			});

			raw.push($.CONSUME(closeQuote).image);

			return /** @type {const} */ ([string.join(''), raw.join(''), start]);
		});

		const rRawString = $.RULE('rawString', () => {
			const raw = $.CONSUME(rawString).image;
			const quoteIndex = raw.indexOf('"');

			return /** @type {const} */ ([
				raw.slice(quoteIndex + 1, -quoteIndex),
				raw,
			]);
		});

		const rSinglelineComment = $.RULE('singlelineComment', () => {
			return (
				$.CONSUME(singleLineComment).image +
				$.OR([
					{ALT: () => $.CONSUME(newLine).image},
					{ALT: () => $.CONSUME(EOF).image},
				])
			);
		});

		const rMultilineComment = $.RULE('multilineComment', () => {
			const parts = [$.CONSUME(openMultiLineComment).image];

			$.MANY(() => {
				parts.push(
					$.OR([
						{ALT: () => $.CONSUME(multiLineCommentContent).image},
						{ALT: () => $.SUBRULE(rMultilineComment)},
					]),
				);
			});

			parts.push($.CONSUME(closeMultiLineComment).image);

			return parts.join('');
		});

		const rWhitespace = $.RULE('whitespace', () =>
			$.OR([
				{ALT: () => $.CONSUME(inlineWhitespace).image},
				{ALT: () => $.SUBRULE(rMultilineComment)},
			]),
		);

		const rInlineWhitespace = $.RULE('inlineWhitespace', () =>
			$.OR({
				DEF: [
					{
						ALT: () => {
							/** @type {string[]} */
							const parts = [];

							$.AT_LEAST_ONE(() => parts.push($.SUBRULE(rWhitespace)));

							return parts.join('');
						},
					},
					{
						ALT: () => {
							/** @type {string[]} */
							const parts = [];

							$.AT_LEAST_ONE1(() => {
								parts.push($.SUBRULE(rEscLine));
								parts.push($.SUBRULE1(rWhitespace));
							});

							return parts.join('');
						},
					},
				],
				MAX_LOOKAHEAD: 1,
			}),
		);

		const rLinespace = $.RULE('linespace', () =>
			$.OR([
				{ALT: () => $.CONSUME(inlineWhitespace).image},
				{ALT: () => $.CONSUME(newLine).image},
				{ALT: () => $.SUBRULE(rSinglelineComment)},
			]),
		);

		const rAllWhitespace = $.RULE('allWhitespace', () => {
			/** @type {string[]} */
			const parts = [];

			$.MANY(() =>
				parts.push(
					$.OR([
						{ALT: () => $.SUBRULE(rComment)},
						{ALT: () => $.CONSUME(inlineWhitespace).image},
						{ALT: () => $.CONSUME(newLine).image},
					]),
				),
			);

			return parts.join('');
		});

		const rEscLine = $.RULE('escline', () => {
			const parts = [$.CONSUME(escLine).image];

			$.MANY(() => parts.push($.SUBRULE(rWhitespace)));

			parts.push(
				$.OR([
					{ALT: () => $.SUBRULE(rSinglelineComment)},
					{ALT: () => $.CONSUME(newLine).image},
				]),
			);

			return parts.join('');
		});

		const rSlashdashNode = $.RULE('slashdashNode', () => {
			$.CONSUME(slashDash);
			const node = $.SUBRULE(rNode);
			return `/-${$.ACTION(() => format(node))}`;
		});

		const rComment = $.RULE('comment', () =>
			$.OR({
				DEF: [
					{ALT: () => $.SUBRULE(rSinglelineComment)},
					{ALT: () => $.SUBRULE(rMultilineComment)},
					{ALT: () => $.SUBRULE(rSlashdashNode)},
				],
				MAX_LOOKAHEAD: 1,
			}),
		);

		const rNodeSpace = $.RULE('nodeSpace', () =>
			$.OR({
				DEF: [
					{
						ALT: () => $.SUBRULE(rInlineWhitespace),
					},
					{
						ALT: () => $.SUBRULE(rSlashdashInNode),
					},
				],
				MAX_LOOKAHEAD: 1,
			}),
		);

		const rSlashdashInNode = $.RULE('slashdashInNode', () => {
			const leading = [$.CONSUME(slashDash).image];

			$.MANY(() => leading.push($.SUBRULE(rInlineWhitespace)));

			/** @type {Entry | Document} */
			const el = $.OR([
				{ALT: () => $.SUBRULE(rEntry)},
				{ALT: () => $.SUBRULE(rChildren)},
			]);

			// a leading whitespace is added to entry and children if none are set,
			// remove it here
			return $.ACTION(() => leading.join('') + format(el).slice(1));
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Value>}
		 */
		this.value;
		const rValue = $.RULE('value', () => {
			const value =
				/** @type {[Value['value'], string, import('chevrotain').IToken?]} */ (
					$.OR([
						{ALT: () => $.SUBRULE(rBoolean)},
						{ALT: () => $.SUBRULE(rNull)},
						{ALT: () => $.SUBRULE(rNumber)},
						{ALT: () => $.SUBRULE(rString)},
						{ALT: () => $.SUBRULE(rRawString)},
					])
				);

			const result = new Value(value[0]);
			result.representation = value[1];
			this.#storeLocation(result, value[2]);
			return result;
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Identifier>}
		 */
		this.identifier;
		const rIdentifier = $.RULE('identifier', () =>
			$.OR([
				{
					ALT: () => {
						const name = $.CONSUME(plainIdentifier).image;
						const result = new Identifier(name);
						result.representation = name;
						this.#storeLocation(result);
						return result;
					},
				},
				{
					ALT: () => {
						const name =
							/** @type {[string, string, import('chevrotain').IToken?]} */ (
								$.OR1([
									{ALT: () => $.SUBRULE(rString)},
									{ALT: () => $.SUBRULE(rRawString)},
								])
							);

						const result = new Identifier(name[0]);
						result.representation = name[1];
						this.#storeLocation(result, name[2]);
						return result;
					},
				},
			]),
		);

		const rTag = $.RULE('tag', () => {
			$.CONSUME(openParenthesis);
			const identifier = $.SUBRULE(rIdentifier);
			$.CONSUME(closeParenthesis);

			return identifier;
		});

		const rArgument = $.RULE('argument', () => {
			const tag = $.OPTION(() => $.SUBRULE(rTag));
			const value = $.SUBRULE(rValue);

			const entry = new Entry(value, null);
			entry.tag = tag ?? null;
			return entry;
		});

		const rProperty = $.RULE('property', () => {
			const name = $.SUBRULE(rIdentifier);
			$.CONSUME(equals);

			const tag = $.OPTION(() => $.SUBRULE(rTag));
			const value = $.SUBRULE(rValue);

			const entry = new Entry(value, name);
			entry.tag = tag ?? null;
			return entry;
		});

		const rEntry = $.RULE('entry', () =>
			$.OR([
				{
					GATE: $.BACKTRACK(rProperty),
					ALT: () => $.SUBRULE(rProperty),
				},
				{GATE: $.BACKTRACK(rArgument), ALT: () => $.SUBRULE(rArgument)},
			]),
		);

		this.entryWithOptionalLeading = $.RULE('entryWithOptionalLeading', () => {
			/** @type {string[]} */
			const leading = [];
			const start = $.LA(1);

			$.MANY(() => leading.push($.SUBRULE(rNodeSpace)));

			const entry = $.SUBRULE(rEntry);
			this.#storeLocation(entry, start);

			return $.ACTION(() => {
				entry.leading = leading.join('');
				return entry;
			});
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Node>}
		 */
		this.node;
		const rNode = $.RULE('node', () => {
			const start = $.LA(1);
			const leading = $.SUBRULE(rAllWhitespace);

			const tag = $.OPTION(() => $.SUBRULE(rTag));
			const name = $.SUBRULE(rIdentifier);

			/** @type {Entry[]} */
			const entries = [];

			let startOfTrailing = $.LA(1);
			/** @type {string[]} */
			let trailing = [];

			$.MANY1(() => trailing.push($.SUBRULE(rNodeSpace)));

			$.MANY({
				GATE: () => trailing.length > 0,
				DEF: () => {
					const entry = $.SUBRULE(rEntry);
					$.ACTION(() => (entry.leading = trailing.join('')));
					this.#storeLocation(entry, startOfTrailing);
					entries.push(entry);

					startOfTrailing = $.LA(1);
					trailing = [];

					$.MANY2(() => trailing.push($.SUBRULE1(rNodeSpace)));
				},
			});

			const children = $.OPTION1({
				GATE: () => trailing.length > 0,
				DEF: () => {
					const children = $.SUBRULE(rChildren);
					this.#storeLocation(children, startOfTrailing);

					const beforeChildren = trailing.join('');
					trailing = [];

					$.MANY3(() => trailing.push($.SUBRULE2(rNodeSpace)));

					return /** @type {const} */ ([beforeChildren, children]);
				},
			});

			trailing.push(
				$.OR([
					{
						ALT: () =>
							$.CONSUME(semicolon).image +
								$.OPTION2(() =>
									$.OR1([
										{ALT: () => $.SUBRULE(rLinespace)},
										{ALT: () => $.CONSUME(EOF).image},
									]),
								) ?? '',
					},
					{ALT: () => $.CONSUME(newLine).image},
					{ALT: () => $.SUBRULE(rSinglelineComment)},
					{ALT: () => $.CONSUME1(EOF).image},
				]),
			);

			const node = new Node(name, entries);
			node.leading = leading;
			node.trailing = trailing.join('');
			node.tag = tag ?? null;
			this.#storeLocation(node, start);

			return $.ACTION(() => {
				if (children) {
					[node.beforeChildren, node.children] = children;
				}

				return node;
			});
		});

		const rChildren = $.RULE('children', () => {
			$.CONSUME(openBrace);
			const children = $.SUBRULE(rDocument);
			$.CONSUME(closeBrace);

			return children;
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Document>}
		 */
		this.document;
		const rDocument = $.RULE('document', () => {
			const start = $.LA(1);
			const leading = $.SUBRULE(rAllWhitespace);

			/** @type {Node[]} */
			const nodes = [];
			$.MANY(() => nodes.push($.SUBRULE(rNode)));

			const trailing = $.SUBRULE1(rAllWhitespace);

			const document = new Document(nodes);
			document.leading = leading;
			document.trailing = trailing;
			this.#storeLocation(document, start);

			return document;
		});

		this.whiteSpacePartsInDocument = $.RULE('whiteSpacePartsInDocument', () => {
			/** @type {string[]} */
			const parts = [];

			$.MANY(() =>
				parts.push(
					$.OR([
						{ALT: () => $.CONSUME(inlineWhitespace).image},
						{ALT: () => $.CONSUME(escLine).image},
						{ALT: () => $.SUBRULE(rMultilineComment)},
						{ALT: () => $.SUBRULE(rSinglelineComment)},
						{
							ALT: () => {
								const content = [$.CONSUME(slashDash).image];

								$.MANY1(() => content.push($.SUBRULE(rInlineWhitespace)));
								const value = $.SUBRULE(rNode);

								return $.ACTION(() => content.join('') + format(value));
							},
						},
					]),
				),
			);

			return parts;
		});

		this.whiteSpacePartsInNode = $.RULE('whiteSpacePartsInNode', () => {
			/** @type {string[]} */
			const parts = [];

			$.MANY(() =>
				parts.push(
					$.OR([
						{ALT: () => $.CONSUME(inlineWhitespace).image},
						{ALT: () => $.CONSUME(escLine).image},
						{ALT: () => $.CONSUME(newLine).image},
						{ALT: () => $.SUBRULE(rMultilineComment)},
						{ALT: () => $.SUBRULE(rSinglelineComment)},
						{
							ALT: () => {
								const content = [$.CONSUME(slashDash).image];

								$.MANY1(() => content.push($.SUBRULE(rInlineWhitespace)));

								return (
									content.join('') +
									$.OR1([
										{
											ALT: () => {
												const entry = $.SUBRULE(rEntry);
												// slice(1) to cut off the leading space added by format
												return $.ACTION(() => format(entry).slice(1));
											},
										},
										{
											ALT: () => {
												const children = $.SUBRULE(rChildren);
												// slice(1) to cut off the leading space added by format
												return $.ACTION(() => `{${format(children).slice(1)}}`);
											},
										},
									])
								);
							},
						},
					]),
				),
			);

			return parts;
		});

		this.performSelfAnalysis();
	}
}
