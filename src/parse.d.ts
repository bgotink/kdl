import type {Value, Identifier, Entry, Node, Document} from './model.js';

export class InvalidKdlError extends Error {}

interface ParserResult {
	value: Value;
	identifier: Identifier;
	entry: Entry;
	node: Node;
	document: Document;
	['whitespace in node']: string[];
	['whitespace in document']: string[];
}

type ParserTarget = keyof ParserResult;

/**
 * Parse the given text as a value.
 *
 * The text should not contain anything other than the value, i.e. no leading
 * or trailing whitespace, no comments, no tags.
 */
export function parse(
	text: string,
	options: {as: 'value'; storeLocations?: boolean},
): Value;
/**
 * Parse the given text as a identifier.
 *
 * The text should not contain anything other than the identifier, i.e. no leading
 * or trailing whitespace, no comments, no tags.
 */
export function parse(
	text: string,
	options: {as: 'identifier'; storeLocations?: boolean},
): Identifier;
/**
 * Parse the given text as an entry.
 *
 * The text can contain extra whitespace, tags, and comments (though no slashdash
 * comments of entire nodes)
 */
export function parse(
	text: string,
	options: {as: 'entry'; storeLocations?: boolean},
): Entry;
/**
 * Parse the given text as a node.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(
	text: string,
	options: {as: 'node'; storeLocations?: boolean},
): Node;
/**
 * Parse the given text as a document.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(
	text: string,
	options?: {as?: 'document'; storeLocations?: boolean},
): Document;
/**
 * Split the given whitespace within a node (e.g. between the node name and its first value) text into parts
 *
 * This function splits the whitespace into its constituent parts:
 * - inline space
 * - a newline
 * - an escaped newline (backslash)
 * - a multiline comment (starts with `/*`)
 * - a single line comment (starts with `//`, includes the trailing newline)
 * - a slashdash comment (starts with `/-`, ends at the end of the commented value or property)
 */
export function parse(
	text: string,
	options?: {as: 'whitespace in node'},
): string[];
/**
 * Split the given whitespace text outside of a node (e.g. between two nodes) into parts
 *
 * This function splits the whitespace into its constituent parts:
 * - inline space
 * - a newline
 * - an escaped newline (backslash)
 * - a multiline comment (starts with `/*`)
 * - a single line comment (starts with `//`, includes the trailing newline)
 * - a slashdash comment (starts with `/-`, ends at the end of the commented node, which is a newline, semicolon or the end of the string)
 */
export function parse(
	text: string,
	options?: {as: 'whitespace in document'},
): string[];
export function parse<T extends ParserTarget>(
	text: string,
	options: {as: T; storeLocations?: boolean},
): ParserResult[T];
