import {Document, Entry, Node} from './model.js';

export class InvalidJsonInKdlError extends Error {
	constructor(message: string);
}

export interface JsonObject {
	[property: string]: JsonValue;
}

export type JsonValue =
	| null
	| number
	| boolean
	| string
	| JsonObject
	| JsonValue[];

interface ToJsonOptions {
	/**
	 * Whether to ignore values on the root node
	 *
	 * Turning this option on deviates from the JiK standard by ignoring all values on the root node.
	 * This makes it possible to encode parameterized nodes as JiK.
	 *
	 * For example, every `book` node in the following document is a JiK node:
	 *
	 * ```kdl
	 * book "The Fellowship of the Ring" {
	 *   author "J.R.R. Tolkien"
	 *   publicationYear 1954
	 * }
	 *
	 * book "Dune" publicationYear=1965 {
	 *   author "Frank Herbert"
	 * }
	 * ```
	 *
	 * Here's how this could be turned into an map containing all books:
	 *
	 * ```js
	 * const books = new Map(
	 *   document.findNodesByName('book').map(node => [
	 * 	   node.getArgument(0),
	 *     toJson(node, {ignoreValues: true}),
	 *   ]),
	 * )
	 * ```
	 */
	ignoreValues?: boolean;
}

interface ToJsonType<T> {
	/**
	 * Type to use for the node
	 *
	 * Possible values are:
	 *
	 * - `object`: The node must be a valid object, and nodes that are ambiguous
	 *   and could be objects or something else are assumed to be an object
	 * - `array`: The node must be a valid array, and nodes that are ambiguous
	 *   and could be arrays or something else are assumed to be an array
	 */
	type: T;
}

interface ToJsonReviver<T> {
	reviver: JiKReviver<T>;
}

/**
 * Extract the JSON value encoded into the given JiK node.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param node A valid JiK node
 * @throws If the given node is not a valid JiK node
 */
export function toJson(
	node: Node,
	options: ToJsonOptions & ToJsonType<'object'> & {reviver?: undefined},
): JsonObject;
/**
 * Extract the JSON value encoded into the given JiK document.
 *
 * The document must contain a single node, which acts as the root of the JiK value.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param document A document containing a single valid JiK node
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	document: Document,
	options: ToJsonOptions & ToJsonType<'object'> & {reviver?: undefined},
): JsonObject;
/**
 * Extract the JSON value encoded into the given JiK node or document.
 *
 * If passed a document, the document must contain a single node, which acts as the root of the JiK value.
 *
 * @param nodeOrDocument A valid JiK node or a document containing a single node which is a valid JiK node
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	nodeOrDocument: Node | Document,
	options: ToJsonOptions & ToJsonType<'object'> & {reviver?: undefined},
): JsonObject;
/**
 * Extract the JSON value encoded into the given JiK node.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param node A valid JiK node
 * @throws If the given node is not a valid JiK node
 */
export function toJson(
	node: Node,
	options: ToJsonOptions & ToJsonType<'document'> & {reviver?: undefined},
): JsonValue[];
/**
 * Extract the JSON value encoded into the given JiK document.
 *
 * The document must contain a single node, which acts as the root of the JiK value.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param document A document containing a single valid JiK node
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	document: Document,
	options: ToJsonOptions & ToJsonType<'document'> & {reviver?: undefined},
): JsonValue[];
/**
 * Extract the JSON value encoded into the given JiK node or document.
 *
 * If passed a document, the document must contain a single node, which acts as the root of the JiK value.
 *
 * @param nodeOrDocument A valid JiK node or a document containing a single node which is a valid JiK node
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	nodeOrDocument: Node | Document,
	options: ToJsonOptions & ToJsonType<'document'> & {reviver?: undefined},
): JsonValue[];
/**
 * Extract the JSON value encoded into the given JiK node.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param node A valid JiK node
 * @throws If the given node is not a valid JiK node
 */
export function toJson(
	node: Node,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<JsonValue>>,
): JsonValue;
/**
 * Extract the JSON value encoded into the given JiK document.
 *
 * The document must contain a single node, which acts as the root of the JiK value.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param document A document containing a single valid JiK node
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	document: Document,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<JsonValue>>,
): JsonValue;
/**
 * Extract the JSON value encoded into the given JiK node or document.
 *
 * If passed a document, the document must contain a single node, which acts as the root of the JiK value.
 *
 * @param nodeOrDocument A valid JiK node or a document containing a single node which is a valid JiK node
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	nodeOrDocument: Node | Document,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<JsonValue>>,
): JsonValue;
/**
 * Extract the JSON value encoded into the given JiK node.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param node A valid JiK node
 * @throws If the given node is not a valid JiK node
 */
export function toJson(
	node: Node,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<unknown>>,
): unknown;
/**
 * Extract the JSON value encoded into the given JiK document.
 *
 * The document must contain a single node, which acts as the root of the JiK value.
 *
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @param document A document containing a single valid JiK node
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	document: Document,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<unknown>>,
): unknown;
/**
 * Extract the JSON value encoded into the given JiK node or document.
 *
 * If passed a document, the document must contain a single node, which acts as the root of the JiK value.
 *
 * @param nodeOrDocument A valid JiK node or a document containing a single node which is a valid JiK node
 * @see https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
 * @throws If the given node is not a valid JiK node or if the given document doesn't contain exactly one node
 */
export function toJson(
	nodeOrDocument: Node | Document,
	options?: ToJsonOptions &
		Partial<ToJsonType<string>> &
		Partial<ToJsonReviver<unknown>>,
): unknown;

interface FromJsonOptions {
	/**
	 * Name of the root node to create
	 *
	 * If no name is passed, the node will be called "-".
	 */
	nodeName?: string;

	/**
	 * Whether to allow literal children to be encoded into values or properties
	 *
	 * Defaults to `true`.
	 * This value can be defined specifically for arrays, objects, or the root node.
	 */
	allowEntries?: boolean;

	/**
	 * Whether to allow literal items in the array to be encoded as values on a node
	 *
	 * If set to false, all array items will be encoded as children.
	 *
	 * If set to true, all leading literal values of arrays will be encoded as node values instead.
	 *
	 * The default value is the value of `allowEntries`, which in turn defaults to true.
	 */
	allowEntriesInArrays?: boolean;

	/**
	 * Whether to allow literal properties in the object to be encoded as property on a node
	 *
	 * If set to false, all node properties will be encoded as children.
	 *
	 * If set to true, all properties with literal values of objects will be encoded as node properties instead.
	 * Note that this changes the order of properties, which are assumed not to matter in JSON.
	 *
	 * The default value is the value of `allowEntries`, which in turn defaults to true.
	 */
	allowEntriesInObjects?: boolean;

	/**
	 * Whether to allow literal children to be encoded as values or properties on the root node
	 *
	 * This property only has effect if the given value is an object or an array.
	 * Literal values are always encoded as values on the root node.
	 *
	 * The default value of this option is the value of `allowEntriesInArrays` or `allowEntriesInObjects`, depending on the type of the value.
	 */
	allowEntriesInRoot?: boolean;
}

/**
 * Encode the given JSON value into a JiK node
 *
 * @param value The JSON value to encode
 * @throws If the given value contains cycles.
 */
export function fromJson(value: JsonValue, options?: FromJsonOptions): Node;

interface JiKReviver<T> {
	(value: JsonValue, key: string | number, data: {location: Node | Entry}):
		| T
		| undefined;
}

/**
 * Parse the given JiK text to its encoded JSON value
 *
 * @param text The JiK text to parse
 * @throws If the given text is not a valid JiK document
 */
export function parse(text: string, reviver?: JiKReviver<JsonValue>): JsonValue;
export function parse(text: string, reviver: JiKReviver<unknown>): unknown;

/**
 * Stringify the given JSON value into JiK text
 *
 * @param value The JSON value to encode
 * @throws If the given JSON value contains cycles.
 */
export function stringify(value: JsonValue): string;
