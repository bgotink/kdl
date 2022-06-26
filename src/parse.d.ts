import type {Value, Identifier, Entry, Node, Document} from './model.js';

export class InvalidKdlError extends Error {}

interface ParserResult {
	value: Value;
	identifier: Identifier;
	entry: Entry;
	node: Node;
	document: Document;
}

type ParserTarget = keyof ParserResult;

/**
 * Parse the given text as a value.
 *
 * The text should not contain anything other than the value, i.e. no leading
 * or trailing whitespace, no comments, no tags.
 */
export function parse(text: string, options: {as: 'value'}): Value;
/**
 * Parse the given text as a identifier.
 *
 * The text should not contain anything other than the identifier, i.e. no leading
 * or trailing whitespace, no comments, no tags.
 */
export function parse(text: string, options: {as: 'identifier'}): Identifier;
/**
 * Parse the given text as an entry.
 *
 * The text can contain extra whitespace, tags, and comments (though no slashdash
 * comments of entire nodes)
 */
export function parse(text: string, options: {as: 'entry'}): Entry;
/**
 * Parse the given text as a node.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(text: string, options: {as: 'node'}): Node;
/**
 * Parse the given text as a document.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(text: string, options?: {as?: 'document'}): Document;
export function parse<T extends ParserTarget>(
	text: string,
	options: {as: T},
): ParserResult[T];
