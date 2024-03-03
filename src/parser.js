import {
	defaultLexerErrorProvider,
	defaultParserErrorProvider,
	EmbeddedActionsParser,
	EOF,
	Lexer,
} from "chevrotain";

import {format} from "./format.js";
import {storeLocation} from "./locations.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";
import {
	removeEscapedWhitespace,
	removeLeadingWhitespace,
	replaceEscapes,
} from "./string-utils.js";

import {plainIdentifier} from "./tokens/identifier.js";
import {
	binaryNumber,
	decimalNumber,
	hexadecimalNumber,
	octalNumber,
	sign,
} from "./tokens/numbers.js";
import {keyword, invalidKeyword} from "./tokens/other-values.js";
import {
	closeBrace,
	closeParenthesis,
	equals,
	escLine,
	openBrace,
	openParenthesis,
	semicolon,
} from "./tokens/punctuation.js";
import {quotedString, rawString} from "./tokens/strings.js";
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
	newlineCharacters,
	reAllNewlines,
} from "./tokens/whitespace.js";

const defaultMode = "default";

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

			keyword,
			invalidKeyword,
			rawString,
			quotedString,
			sign,
			binaryNumber,
			hexadecimalNumber,
			octalNumber,
			decimalNumber,

			semicolon,
			equals,

			openBrace,
			closeBrace,

			openParenthesis,
			closeParenthesis,

			escLine,

			plainIdentifier,
		],
		[multiLineCommentMode]: [
			closeMultiLineComment,
			openMultiLineComment,
			multiLineCommentContent,
		],
	},
};

export class KdlLexer extends Lexer {
	constructor() {
		super(tokens, {
			lineTerminatorCharacters: newlineCharacters,
			lineTerminatorsPattern: reAllNewlines,

			errorMessageProvider: {
				...defaultLexerErrorProvider,

				buildUnexpectedCharactersMessage(fullText, startOffset, length) {
					const unexpectedText = fullText.slice(
						startOffset,
						startOffset + length,
					);

					switch (unexpectedText) {
						case "=":
							return 'encountered unexpected "=", did you add a tag to the property name instead of the value?';
						default:
							return `encountered unexpected ${JSON.stringify(
								unexpectedText,
							)}, did you forget to quote an identifier?`;
					}
				},
			},
		});
	}
}

/** @type {import('chevrotain').IParserErrorMessageProvider} */
const errorMessageProvider = {
	...defaultParserErrorProvider,

	buildMismatchTokenMessage(options) {
		if (options.expected === equals && options.ruleName === "entry") {
			return 'missing ";" or newline between two sibling nodes, or missing "=" to define a property';
		}

		return defaultParserErrorProvider.buildMismatchTokenMessage(options);
	},

	buildNoViableAltMessage(options) {
		if (options.actual[0]?.tokenType === equals) {
			switch (options.previous.tokenType) {
				case quotedString:
				case rawString:
				case plainIdentifier:
					break;
				default:
					return 'encountered unexpected "=", did you forget to quote a property name that isn\'t a valid identifier?';
			}
		}

		return defaultParserErrorProvider.buildNoViableAltMessage(options);
	},

	buildNotAllInputParsedMessage(options) {
		if (options.firstRedundant.tokenType === invalidKeyword) {
			return `Keywords must start with '#', if you want to use keyword ${options.firstRedundant.image}, write #${options.firstRedundant.image} instead`;
		}

		if (options.firstRedundant.tokenType === equals) {
			return 'encountered unexpected "=", did you forget to quote a property name that isn\'t a valid identifier?';
		}

		return defaultParserErrorProvider.buildNotAllInputParsedMessage(options);
	},
};

export class KdlParser extends EmbeddedActionsParser {
	storeLocationInfo = false;

	/**
	 * @param {Value | Identifier | Tag | Entry | Node | Document} el
	 * @param {import('chevrotain').IToken} [start]
	 */
	#storeLocation(el, start) {
		if (!this.storeLocationInfo) {
			return;
		}

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

	constructor() {
		super(tokens, {
			errorMessageProvider,
			maxLookahead: 1,
		});

		const $ = this;

		/** @type {import("chevrotain").ParserMethod<[], Document>} */
		this.document;
		const rDocument = $.RULE("document", () => {
			const startOfDocument = $.LA(1);

			/** @type {Node[]} */
			const nodes = [];

			let hasSeparator = true;

			let space = $.SUBRULE(rLineSpace);

			$.MANY1({
				GATE: () => hasSeparator,
				DEF: () => {
					const node = $.SUBRULE(rBaseNode);
					const trailing = $.SUBRULE(rOptionalNodeSpace)[0];
					const terminator = $.OPTION(() => $.SUBRULE(rNodeTerminator));

					$.ACTION(() => {
						node.trailing =
							(node.trailing ?? "") + trailing + (terminator ?? "");
						nodes.push(node);

						node.leading = space;
					});

					space = $.SUBRULE1(rLineSpace);

					hasSeparator = terminator != null;
				},
			});

			const document = new Document(nodes);
			this.#storeLocation(document, startOfDocument);

			document.trailing = space;
			return document;
		});

		const rPlainLineSpace = $.RULE("plainLineSpace", () =>
			$.OR([
				{
					ALT: () => $.CONSUME(newLine).image,
				},
				{
					ALT: () => $.CONSUME(inlineWhitespace).image,
				},
				{
					ALT: () => $.SUBRULE(rMultilineComment),
				},
				{
					ALT: () => $.SUBRULE(rSingleLineComment),
				},
			]),
		);
		const rPlainNodeSpace = $.RULE("plainNodeSpace", () =>
			$.OR({
				DEF: [
					{
						ALT: () => $.SUBRULE(rEscLine),
					},
					{
						ALT: () => $.CONSUME(inlineWhitespace).image,
					},
					{
						ALT: () => $.SUBRULE(rMultilineComment),
					},
				],
			}),
		);

		const rLineSpace = $.RULE("lineSpace", () => {
			/** @type {string[]} */
			const result = [];

			$.MANY(() =>
				$.OR([
					{
						ALT: () => result.push($.SUBRULE1(rPlainLineSpace)),
					},
					{
						ALT: () => {
							result.push($.CONSUME(slashDash).image);

							$.MANY1(() => result.push($.SUBRULE(rPlainNodeSpace)));

							const node = $.SUBRULE(rNode);

							$.ACTION(() => result.push(format(node)));
						},
					},
				]),
			);

			return result.join("");
		});
		const rNodeSpaceSlashDash = $.RULE("nodeSpaceSlashDash", () => {
			const result = [$.CONSUME(slashDash).image];

			$.MANY1(() => result.push($.SUBRULE(rPlainNodeSpace)));

			$.OR([
				{
					ALT: () => {
						const entry = $.SUBRULE(rNodePropOrArg);

						$.ACTION(() => {
							result.push(format(entry).slice(1));
						});
					},
				},
				{
					ALT: () => {
						const document = $.SUBRULE(rNodeChildren);

						$.ACTION(() => {
							result.push(`{${format(document)}}`);
						});
					},
				},
			]);

			return result.join("");
		});
		// const rRequiredNodeSpace = not defined,
		// use optionalNodeSpace and check whether it ends with inline whitespace or newline instead
		const rOptionalNodeSpace = $.RULE("optionalNodeSpace", () => {
			/** @type {string[]} */
			const result = [];
			let endsWithPlainSpace = false;

			$.MANY({
				DEF: () => {
					endsWithPlainSpace = true;
					result.push($.SUBRULE(rPlainNodeSpace));
					$.MANY1(() => result.push($.SUBRULE1(rPlainNodeSpace)));

					$.OPTION({
						DEF: () => {
							result.push($.SUBRULE(rNodeSpaceSlashDash));
							endsWithPlainSpace = false;
						},
					});
				},
			});

			return /** @type {[String, boolean]} */ ([
				result.join(""),
				endsWithPlainSpace,
			]);
		});

		const rBaseNode = $.RULE("baseNode", () => {
			const startOfNode = $.LA(1);

			const tag = $.OPTION(() => $.SUBRULE(rTag));
			const betweenTagAndName = $.SUBRULE(rOptionalNodeSpace)[0];

			const name = $.SUBRULE(rIdentifier);

			/** @type {Entry[]} */
			let entries = [];

			let space = $.SUBRULE1(rOptionalNodeSpace);

			$.OPTION1({
				GATE: () => space[1],
				DEF: () => {
					const tmp = $.SUBRULE(rNodePropsAndArgs);

					$.ACTION(() => {
						if (tmp[0].length === 0) {
							return;
						}

						entries = tmp[0];
						entries[0].leading = space[0] + (entries[0].leading ?? "");

						space = tmp[1];
					});
				},
			});

			const possibleChildren = $.OPTION2({
				GATE: () => space[1],
				DEF: () => $.SUBRULE(rNodeChildren),
			});

			return $.ACTION(() => {
				const node = new Node(name, entries, possibleChildren);
				node.tag = tag ?? null;
				node.betweenTagAndName = betweenTagAndName;
				if (node.children) {
					node.beforeChildren = space[0];
				} else {
					node.trailing = space[0];
				}

				this.#storeLocation(node, startOfNode);

				return node;
			});
		});
		const rNode = $.RULE("node", () => {
			const baseNode = $.SUBRULE(rBaseNode);
			const trailing = $.SUBRULE(rOptionalNodeSpace)[0];
			const terminator = $.SUBRULE(rNodeTerminator);

			return $.ACTION(() => {
				baseNode.trailing = (baseNode.trailing ?? "") + trailing + terminator;
				return baseNode;
			});
		});
		this.nodeWithSpace = $.RULE("nodeWithSpace", () => {
			const leading = $.SUBRULE(rLineSpace);
			const node = $.SUBRULE(rBaseNode);
			const trailing =
				$.SUBRULE(rOptionalNodeSpace)[0] +
				($.OPTION(() => $.SUBRULE(rNodeTerminator) + +$.SUBRULE1(rLineSpace)) ??
					"");

			return $.ACTION(() => {
				node.leading = leading;
				node.trailing = trailing;

				return node;
			});
		});
		// Instead of having a rule per entry, find all entries at the same time
		// This is the only way to prevent from having to backtrack because the number
		// of tokens between the name of a property and the equals token is unlimited.
		const rNodePropsAndArgs = $.RULE("nodePropsAndArgs", () => {
			let start = $.LA(1);
			/** @type {Entry[]} */
			const entries = [];

			/** @type {[string, import("chevrotain").IToken, string, string, import("chevrotain").IToken]=} */
			let entryName;

			const mkPreviousEntry = () =>
				$.ACTION(() => {
					if (entryName == null) {
						return;
					}

					const previousValue = new Value(entryName[2]);
					previousValue.representation = entryName[3];
					$.#storeLocation(previousValue, entryName[4]);

					const previousEntry = new Entry(previousValue, null);
					previousEntry.leading = entryName[0];
					$.#storeLocation(previousEntry, entryName[1]);

					entries.push(previousEntry);

					entryName = undefined;
				});

			let space = /** @type {readonly [string, boolean]} */ (["", true]);

			$.MANY({
				DEF: () => {
					$.OR([
						// start with tag -> must be a value
						{
							GATE: () => space[1],
							ALT: () => {
								const tag = $.SUBRULE(rTag);
								const betweenTagAndValue = $.SUBRULE(rOptionalNodeSpace)[0];
								const value = $.SUBRULE(rValue);

								mkPreviousEntry();

								const entry = new Entry(value, null);
								entry.leading = space[0];
								entry.tag = tag;
								entry.betweenTagAndValue = betweenTagAndValue;

								this.#storeLocation(entry, start);
								entries.push(entry);
							},
						},
						// non-string -> must be a value
						{
							GATE: () => space[1],
							ALT: () => {
								const rawValue =
									/** @type {[Value['value'], string, import('chevrotain').IToken?]} */ (
										$.OR1([
											{ALT: () => $.SUBRULE(rKeyword)},
											{ALT: () => $.SUBRULE(rNumber)},
										])
									);

								mkPreviousEntry();

								const value = new Value(rawValue[0]);
								value.representation = rawValue[1];
								this.#storeLocation(value, rawValue[2]);

								const entry = new Entry(value, null);
								entry.leading = space[0];

								this.#storeLocation(entry, start);
								entries.push(entry);
							},
						},

						// equals -> must be a value, but can only happen if we already have a property name
						{
							GATE: () => entryName != null,
							ALT: () => {
								const equalsString =
									space[0] +
									$.CONSUME(equals).image +
									$.SUBRULE1(rOptionalNodeSpace)[0];

								const tagAndSpace = $.OPTION2(
									() =>
										/** @type {const} */ ([
											$.SUBRULE1(rTag),
											$.SUBRULE2(rOptionalNodeSpace)[0],
										]),
								);

								const value = $.SUBRULE1(rValue);

								$.ACTION(() => {
									const [
										leading,
										startOfEntry,
										nameString,
										nameRepresentation,
										startOfName,
									] = /** @type {NonNullable<typeof entryName>} */ (entryName);
									entryName = undefined;

									const name = new Identifier(nameString);
									name.representation = nameRepresentation;
									this.#storeLocation(name, startOfName);

									const entry = new Entry(value, name);
									entry.leading = leading;
									entry.equals = equalsString;

									if (tagAndSpace) {
										entry.tag = tagAndSpace[0];
										entry.betweenTagAndValue = tagAndSpace[1];
									}

									this.#storeLocation(entry, startOfEntry);
									entries.push(entry);
								});
							},
						},

						// string -> could be argument or property, we don't know yet
						{
							GATE: () => space[1],
							ALT: () => {
								const nameOrValue = $.SUBRULE(rString);

								mkPreviousEntry();

								$.ACTION(() => {
									entryName = [space[0], start, ...nameOrValue];
								});
							},
						},
					]);

					space = $.SUBRULE3(rOptionalNodeSpace);
				},
			});

			mkPreviousEntry();

			return /** @type {[Entry[], [string, boolean]]} */ ([entries, space]);
		});
		const rNodePropOrArg = $.RULE("nodePropOrArg", () => {
			const start = $.LA(1);

			const entry = $.OR({
				DEF: [
					// start with tag -> must be argument
					{
						ALT: () => {
							const tag = $.SUBRULE(rTag);
							const betweenTagAndValue = $.SUBRULE(rOptionalNodeSpace)[0];
							const value = $.SUBRULE(rValue);

							const entry = new Entry(value, null);
							entry.tag = tag;
							entry.betweenTagAndValue = betweenTagAndValue;

							return entry;
						},
					},
					// non-string -> must be argument
					{
						ALT: () => {
							const rawValue =
								/** @type {[Value['value'], string, import('chevrotain').IToken?]} */ (
									$.OR1([
										{ALT: () => $.SUBRULE(rKeyword)},
										{ALT: () => $.SUBRULE(rNumber)},
									])
								);

							const value = new Value(rawValue[0]);
							value.representation = rawValue[1];
							this.#storeLocation(value, rawValue[2]);

							return new Entry(value, null);
						},
					},
					// string -> could be argument or property
					{
						ALT: () => {
							const nameOrValue = $.SUBRULE(rString);

							/** @type {Entry=} */
							let entry;

							$.OPTION({
								GATE: $.BACKTRACK(() => {
									$.SUBRULE9(rOptionalNodeSpace)[0];
									$.CONSUME9(equals);
								}),
								DEF: () => {
									const equalsString =
										$.SUBRULE1(rOptionalNodeSpace)[0] +
										$.CONSUME(equals).image +
										$.SUBRULE2(rOptionalNodeSpace)[0];

									const tagAndSpace = $.OPTION2(
										() =>
											/** @type {const} */ ([
												$.SUBRULE1(rTag),
												$.SUBRULE3(rOptionalNodeSpace)[0],
											]),
									);

									const value = $.SUBRULE1(rValue);

									const name = new Identifier(nameOrValue[0]);
									name.representation = nameOrValue[1];
									this.#storeLocation(name, nameOrValue[2]);

									entry = new Entry(value, name);
									entry.equals = equalsString;

									if (tagAndSpace) {
										entry.tag = tagAndSpace[0];
										entry.betweenTagAndValue = tagAndSpace[1];
									}
								},
							});

							if (!entry) {
								const value = new Value(nameOrValue[0]);
								value.representation = nameOrValue[1];
								this.#storeLocation(value, nameOrValue[2]);

								entry = new Entry(value, null);
							}

							return entry;
						},
					},
				],
			});

			this.#storeLocation(entry, start);
			return entry;
		});
		this.nodePropOrArgWithSpace = $.RULE("nodePropOrArgWithSpace", () => {
			const leading =
				($.OPTION(() => $.SUBRULE(rNodeSpaceSlashDash)) ?? "") +
				$.SUBRULE(rOptionalNodeSpace)[0];
			const entry = $.SUBRULE(rNodePropOrArg);
			const trailing = $.SUBRULE1(rOptionalNodeSpace)[0];

			return $.ACTION(() => {
				entry.leading = leading;
				entry.trailing = trailing;

				return entry;
			});
		});
		const rNodeChildren = $.RULE("nodeChildren", () => {
			$.CONSUME(openBrace);

			const document = $.SUBRULE(rDocument);

			$.CONSUME(closeBrace);

			return document;
		});
		const rNodeTerminator = $.RULE("nodeTerminator", () =>
			$.OR({
				DEF: [
					{
						ALT: () => $.SUBRULE(rSingleLineComment),
					},
					{
						ALT: () => $.CONSUME(newLine).image,
					},
					{
						ALT: () => $.CONSUME(semicolon).image,
					},
					{
						ALT: () => $.CONSUME(EOF).image,
					},
				],
			}),
		);

		const rTag = $.RULE("tag", () => {
			const start = $.CONSUME(openParenthesis);
			const leading = $.SUBRULE(rOptionalNodeSpace)[0];
			const name = $.SUBRULE(rString);
			const trailing = $.SUBRULE2(rOptionalNodeSpace)[0];
			$.CONSUME(closeParenthesis);

			const result = new Tag(name[0]);
			result.representation = name[1];

			result.leading = leading;
			result.trailing = trailing;

			this.#storeLocation(result, start);
			return result;
		});

		const rEscLine = $.RULE("escline", () => {
			const parts = [$.CONSUME(escLine).image];

			$.MANY({
				DEF: () =>
					parts.push(
						$.OR([
							{ALT: () => $.CONSUME(inlineWhitespace).image},
							{ALT: () => $.SUBRULE(rMultilineComment)},
						]),
					),
			});

			parts.push(
				$.OR1({
					DEF: [
						{ALT: () => $.SUBRULE(rSingleLineComment)},
						{ALT: () => $.CONSUME(newLine).image},
					],
				}),
			);

			return parts.join("");
		});

		// ws is inlined for a 12-13% speedup

		const rMultilineComment = $.RULE("multilineComment", () => {
			const parts = [$.CONSUME(openMultiLineComment).image];

			$.MANY(() => {
				parts.push(
					$.OR({
						DEF: [
							{ALT: () => $.CONSUME(multiLineCommentContent).image},
							{ALT: () => $.SUBRULE(rMultilineComment)},
						],
					}),
				);
			});

			parts.push($.CONSUME(closeMultiLineComment).image);

			return parts.join("");
		});

		const rSingleLineComment = $.RULE("singleLineComment", () => {
			return (
				$.CONSUME(singleLineComment).image +
				$.OR([
					{ALT: () => $.CONSUME(newLine).image},
					{ALT: () => $.CONSUME(EOF).image},
				])
			);
		});

		/**
		 * @type {import('chevrotain').ParserMethod<[], Value>}
		 */
		this.value;
		const rValue = $.RULE("value", () => {
			const value =
				/** @type {[Value['value'], string, import('chevrotain').IToken?]} */ (
					$.OR([
						{ALT: () => $.SUBRULE(rKeyword)},
						{ALT: () => $.SUBRULE(rNumber)},
						{ALT: () => $.SUBRULE(rString)},
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
		const rIdentifier = $.RULE("identifier", () => {
			const name = $.SUBRULE(rString);

			const result = new Identifier(name[0]);
			result.representation = name[1];
			this.#storeLocation(result, name[2]);
			return result;
		});

		const rKeyword = $.RULE("keyword", () => {
			const token = $.CONSUME(keyword);

			let value;
			switch (token.image) {
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
					return $.ACTION(() => {
						throw new Error("impossible");
					});
			}

			return /** @type {const} */ ([value, token.image, token]);
		});

		const rNumber = $.RULE("number", () => {
			const start = $.OPTION(() => $.CONSUME(sign));
			const s = start?.image ?? "";

			/** @type {[number, string]} */
			const number = $.OR([
				{
					ALT: () => {
						const raw = $.CONSUME(binaryNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ""), 2), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(octalNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ""), 8), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(hexadecimalNumber).image;
						return [parseInt(raw.slice(2).replace(/_/g, ""), 16), raw];
					},
				},
				{
					ALT: () => {
						const raw = $.CONSUME(decimalNumber).image;
						return [parseFloat(raw.replace(/_/g, "")), raw];
					},
				},
			]);

			return /** @type {const} */ ([
				(s === "-" ? -1 : 1) * number[0],
				s + number[1],
				start,
			]);
		});

		const rString = $.RULE("string", () =>
			$.OR([
				{
					ALT: () => {
						const token = $.CONSUME(plainIdentifier);

						return /** @type {const} */ ([token.image, token.image, token]);
					},
				},
				{
					ALT: () => {
						const token = $.CONSUME(rawString);
						const raw = token.image;
						const quoteIndex = raw.indexOf('"');

						return $.ACTION(
							() =>
								/** @type {const} */ ([
									removeLeadingWhitespace(
										raw.slice(quoteIndex + 1, -(quoteIndex + 1)),
										token,
									),
									raw,
									token,
								]),
						);
					},
				},
				{
					ALT: () => {
						const token = $.CONSUME(quotedString);
						const raw = token.image;

						return $.ACTION(
							() =>
								/** @type {const} */ ([
									replaceEscapes(
										removeLeadingWhitespace(
											removeEscapedWhitespace(raw.slice(1, -1)),
											token,
										),
									),
									raw,
									token,
								]),
						);
					},
				},
			]),
		);

		this.performSelfAnalysis();
	}
}
