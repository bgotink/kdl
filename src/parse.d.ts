import type {Document, Entry, Identifier, Node, Value} from "./model.js";

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
export function parse(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options: {as: "value"; storeLocations?: boolean},
): Value;
/**
 * Parse the given text as a identifier.
 *
 * The text should not contain anything other than the identifier, i.e. no leading
 * or trailing whitespace, no comments, no tags.
 */
export function parse(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options: {as: "identifier"; storeLocations?: boolean},
): Identifier;
/**
 * Parse the given text as an entry.
 *
 * The text can contain extra whitespace, tags, and comments (though no slashdash
 * comments of entire nodes)
 */
export function parse(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options: {as: "entry"; storeLocations?: boolean},
): Entry;
/**
 * Parse the given text as a node.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options: {as: "node"; storeLocations?: boolean},
): Node;
/**
 * Parse the given text as a document.
 *
 * The text can contain extra whitespace, tags, and comments.
 */
export function parse(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options?: {as?: "document"; storeLocations?: boolean},
): Document;
export function parse<T extends ParserTarget>(
	text:
		| string
		| ArrayBuffer
		| Uint8Array
		| Int8Array
		| Uint16Array
		| Int16Array
		| Uint32Array
		| Int32Array
		| DataView,
	options: {as: T; storeLocations?: boolean},
): ParserResult[T];
