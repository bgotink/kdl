import {EmbeddedActionsParser, EOF, Lexer} from 'chevrotain';
import {format} from './format.js';
import {storeLocation} from './locations.js';

import {
	Comment,
	Document,
	Entry,
	Identifier,
	Node,
	Value,
	Whitespace,
} from './model.js';

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

		const rLinespace = $.RULE('linespace', () =>
			$.OR([
				{ALT: () => $.SUBRULE(rWhitespace)},
				{ALT: () => $.CONSUME(newLine).image},
				{ALT: () => $.SUBRULE(rSinglelineComment)},
			]),
		);

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

		const rTag = $.RULE('tag', () => {
			$.CONSUME(openParenthesis);
			const identifier = $.SUBRULE(rIdentifier);
			$.CONSUME(closeParenthesis);

			return identifier;
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

		this.entryWithSpace = $.RULE('entryWithOptionalLeadingTrailing', () => {
			/** @type {string[]} */
			const leading = [];
			/** @type {string[]} */
			const trailing = [];
			const start = $.LA(1);

			$.MANY(() => {
				$.OPTION(() => {
					leading.push($.SUBRULE(rSlashDash));
					const commentedEntry = $.SUBRULE(rEntry);
					leading.push($.ACTION(() => format(commentedEntry).slice(1)));
				});

				leading.push($.SUBRULE(rNodeSpace));
			});

			const entry = $.SUBRULE1(rEntry);

			$.MANY1(() => trailing.push($.SUBRULE1(rNodeSpace)));

			this.#storeLocation(entry, start);

			return $.ACTION(() => {
				entry.leading = leading.join('');
				entry.trailing = trailing.join('');
				return entry;
			});
		});

		const rNodeSpace = $.RULE('nodeSpace', () =>
			$.OR([
				{ALT: () => $.SUBRULE(rWhitespace)},
				{ALT: () => $.SUBRULE(rEscLine)},
			]),
		);

		const rSlashDash = $.RULE('slashDash', () => {
			const parts = [$.CONSUME(slashDash).image];

			$.MANY(() => parts.push($.SUBRULE(rNodeSpace)));

			return parts.join('');
		});

		const rNode = $.RULE('node', () => {
			const start = $.LA(1);

			const tag = $.OPTION(() => $.SUBRULE(rTag));
			const name = $.SUBRULE(rIdentifier);

			/** @type {Entry[]} */
			const entries = [];

			let startOfTrailing = $.LA(1);
			/** @type {string[]} */
			let trailing = [];

			let hasTrailing = false;
			let slashDash = false;

			$.MANY(() => {
				trailing.push($.SUBRULE(rNodeSpace));
				hasTrailing = true;
			});
			$.OPTION1(() => {
				trailing.push($.SUBRULE(rSlashDash));
				slashDash = true;
			});

			$.MANY1({
				GATE: () => hasTrailing,
				DEF: () => {
					const entry = $.SUBRULE(rEntry);

					$.ACTION(() => {
						if (slashDash) {
							trailing.push(format(entry).slice(1));
							slashDash = false;
							return;
						}

						entry.leading = trailing.join('');
						trailing = [];

						this.#storeLocation(entry, startOfTrailing);
						entries.push(entry);
					});

					startOfTrailing = $.LA(1);

					hasTrailing = false;
					$.MANY2(() => {
						trailing.push($.SUBRULE1(rNodeSpace));
						hasTrailing = true;
					});
					$.OPTION2(() => {
						trailing.push($.SUBRULE1(rSlashDash));
						slashDash = true;
					});
				},
			});

			const children = $.OPTION3(() => {
				$.CONSUME(openBrace);
				const children = $.SUBRULE(rDocument);
				$.CONSUME(closeBrace);

				/** @type {string[]} */
				const afterChildren = [];
				$.MANY3(() => afterChildren.push($.SUBRULE2(rNodeSpace)));

				return $.ACTION(() => {
					if (slashDash) {
						trailing.push(`{${format(children)}}`, afterChildren.join(''));

						return undefined;
					} else {
						this.#storeLocation(children, startOfTrailing);

						const beforeChildren = trailing.join('');
						trailing = afterChildren;

						return /** @type {const} */ ([beforeChildren, children]);
					}
				});
			});

			trailing.push(
				$.OR([
					{
						ALT: () => $.CONSUME(semicolon).image,
					},
					{ALT: () => $.CONSUME(newLine).image},
					{ALT: () => $.SUBRULE(rSinglelineComment)},
					{ALT: () => $.CONSUME1(EOF).image},
				]),
			);

			const node = new Node(name, entries);
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

		/**
		 * @type {import('chevrotain').ParserMethod<[], Node>}
		 */
		this.nodeWithSpace = $.RULE('nodeWithSpace', () => {
			/** @type {string[]} */
			const leading = [];
			$.MANY(() => leading.push($.SUBRULE(rLinespace)));

			const node = $.SUBRULE(rNode);

			/** @type {string[]} */
			const trailing = [];
			$.MANY1(() => trailing.push($.SUBRULE1(rLinespace)));

			return $.ACTION(() => {
				node.leading = `${leading.join('')}${node.leading ?? ''}`;
				node.trailing = `${node.trailing ?? ''}${trailing.join('')}`;
				return node;
			});
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Document>}
		 */
		this.document;
		const rDocument = $.RULE('document', () => {
			const start = $.LA(1);
			/** @type {string[]} */
			let leading = [];

			$.MANY(() => leading.push($.SUBRULE(rLinespace)));

			/** @type {Node[]} */
			const nodes = [];

			$.MANY1(() => {
				$.MANY2(() => leading.push($.SUBRULE1(rLinespace)));

				const slashDash = $.OPTION(() => $.SUBRULE(rSlashDash));

				const node = $.SUBRULE(rNode);

				$.ACTION(() => {
					if (slashDash) {
						leading.push(slashDash, format(node));
					} else {
						node.leading = leading.join('');
						leading = [];
						nodes.push(node);
					}
				});
			});

			/** @type {string[]} */
			const trailing = [];
			$.MANY3(() => trailing.push($.SUBRULE2(rLinespace)));

			return $.ACTION(() => {
				const document = new Document(nodes);
				this.#storeLocation(document, start);

				if (nodes.length === 0) {
					document.trailing = leading + trailing.join('');
				} else {
					nodes[0].leading = leading + (nodes[0].leading ?? '');
					document.trailing = trailing.join('');
				}

				return document;
			});
		});

		this.whiteSpacePartsInDocument = $.RULE('whiteSpacePartsInDocument', () => {
			/** @type {(Comment | Whitespace)[]} */
			const parts = [];

			$.MANY(() =>
				parts.push(
					$.OR([
						{
							ALT: () =>
								new Whitespace('space', $.CONSUME(inlineWhitespace).image),
						},
						{
							ALT: () =>
								new Whitespace('line-escape', $.CONSUME(escLine).image),
						},
						{ALT: () => new Whitespace('newline', $.CONSUME(newLine).image)},
						{ALT: () => new Comment($.SUBRULE(rMultilineComment))},
						{ALT: () => new Comment($.SUBRULE(rSinglelineComment))},
						{
							ALT: () => {
								const content = [$.CONSUME(slashDash).image];

								$.MANY1(() => content.push($.SUBRULE(rWhitespace)));
								const value = $.SUBRULE(rNode);

								return $.ACTION(
									() => new Comment(content.join('') + format(value)),
								);
							},
						},
					]),
				),
			);

			return parts;
		});

		this.whiteSpacePartsInNode = $.RULE('whiteSpacePartsInNode', () => {
			/** @type {(Comment | Whitespace)[]} */
			const parts = [];

			$.MANY(() =>
				parts.push(
					$.OR([
						{
							ALT: () =>
								new Whitespace('space', $.CONSUME(inlineWhitespace).image),
						},
						{
							ALT: () => {
								const content = [$.CONSUME(escLine).image];

								$.OPTION(() => {
									$.OPTION1(() =>
										content.push($.CONSUME1(inlineWhitespace).image),
									);

									content.push($.CONSUME(newLine).image);
								});

								return new Whitespace('line-escape', content.join(''));
							},
						},
						{ALT: () => new Comment($.SUBRULE(rMultilineComment))},
						{ALT: () => new Comment($.SUBRULE(rSinglelineComment))},
						{
							ALT: () => {
								const content = [$.CONSUME(slashDash).image];

								$.MANY1(() => content.push($.SUBRULE(rWhitespace)));

								return new Comment(
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
													$.CONSUME(openBrace);
													const children = $.SUBRULE(rDocument);
													$.CONSUME(closeBrace);

													// slice(1) to cut off the leading space added by format
													return $.ACTION(
														() => `{${format(children).slice(1)}}`,
													);
												},
											},
										]),
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
