import type {ParserFlags} from "./flags.js";
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
 * @internal
 */
export function textToString(text: Parameters<typeof parse>[0]): string;

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
	options: Readonly<{
		as: "value";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
	options: Readonly<{
		as: "identifier";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
	options: Readonly<{
		as: "entry";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
	options: Readonly<{
		as: "node";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
	options: Readonly<{
		as: "whitespace in document";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
	options: Readonly<{
		as: "whitespace in node";
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
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
		flags?: Partial<Readonly<ParserFlags>>;
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
	options: Readonly<{
		as: T;
		storeLocations?: boolean;
		graphemeLocations?: boolean;
		flags?: Partial<Readonly<ParserFlags>>;
	}>,
): ParserResult[T];
