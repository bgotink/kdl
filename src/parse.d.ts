import type {Document, Entry, Identifier, Node, Value} from "./model.js";
import type {LineSpace, NodeSpace} from "./model/whitespace.js";

export class InvalidKdlError extends Error {}

export interface ParserResult {
	value: Value;
	identifier: Identifier;
	entry: Entry;
	node: Node;
	document: Document;

	"whitespace in document": LineSpace;
	"whitespace in node": NodeSpace;
}

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
	options: {
		as: "value";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
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
	options: {
		as: "identifier";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
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
	options: {
		as: "entry";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
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
	options: {
		as: "node";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
): Node;
/**
 * Parse the given text as a whitespace in a document.
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
	options: {
		as: "whitespace in document";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
): LineSpace;
/**
 * Parse the given text as a whitespace in a node.
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
	options: {
		as: "whitespace in node";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
): NodeSpace;
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
	options?: {
		as?: "document";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
	},
): Document;
/**
 * Parse the given text as document, node, entry, identifier, or value
 *
 * @hidden
 */
export function parse<T extends keyof ParserResult>(
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
	options: {as: T; storeLocations?: boolean; graphemeLocations?: boolean},
): ParserResult[T];
