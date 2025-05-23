import {Document, Entry, Node} from "./index.js";

/**
 * Error thrown when encountering invalid JSON-in-KDL
 */
export class InvalidJsonInKdlError extends Error {
	constructor(message: string);
}

/**
 * A JSON object
 */
export interface JsonObject {
	[property: string]: JsonValue;
}

/**
 * A JSON value
 */
export type JsonValue =
	| null
	| number
	| boolean
	| string
	| JsonObject
	| JsonValue[];

/**
 * Options for the {@link toJson} function
 */
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

/**
 * Extra option for providing a type hint to the {@link toJson} function
 */
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

/**
 * Extra option to modify the return value of the {@link toJson} function
 */
interface ToJsonReviver<T> {
	/**
	 * Reviver to use
	 */
	reviver: JiKReviver<T>;
}

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
	options: ToJsonOptions & ToJsonType<"object"> & {reviver?: undefined},
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
	options: ToJsonOptions & ToJsonType<"array"> & {reviver?: undefined},
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
		Partial<ToJsonReviver<unknown>>,
): unknown;

/**
 * Options for the {@link fromJson} function
 */
interface FromJsonOptions extends StringifyOptions {
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

/**
 * Reviver function that can be passed into {@link parse} or {@link toJson}
 *
 * The function is called for every JSON value while it's being serialized.
 * These values are replaced by the return value of this function.
 */
interface JiKReviver<T> {
	/**
	 * @param value The JSON value
	 * @param key The key of the value, empty string for the root value
	 * @param data The node or entry where the value was defined
	 * @returns The value to use, if the value is `undefined` then the property is removed from the result
	 */
	(
		value: JsonValue,
		key: string | number,
		data: {location: Node | Entry},
	): T | undefined;
}

/**
 * Parse the given JiK text to its encoded JSON value
 *
 * @param text The JiK text to parse
 * @throws If the given text is not a valid JiK document
 */
export function parse(text: string, reviver?: JiKReviver<JsonValue>): JsonValue;
/**
 * Parse the given JiK text to its encoded JSON value
 *
 * @param text The JiK text to parse
 * @throws If the given text is not a valid JiK document
 */
export function parse(text: string, reviver: JiKReviver<unknown>): unknown;

/**
 * Options for the {@link stringify} function
 */
interface StringifyOptions {
	/**
	 * The indentation to give each nested level of node
	 *
	 * If a string is passed, that string is used as indentation.
	 * If a number higher than zero is passed, the indentation is set to the whitespace character repeated for that number of times.
	 * If zero is passed or no indentation is given, no newlines with indentation will be inserted into the output.
	 */
	indentation?: string | number;

	/**
	 * Replacer function called for every JSON value in the data being transformed
	 *
	 * The replacer can return any JSON value, which will be used instead of the
	 * original value. If `undefined` is returned, the value will be discarded.
	 *
	 * If the `originalValue` had a `toJSON` method, it will be called and the
	 * result will be the `value` parameter. In all other cases `value` and
	 * `originalValue` will be the same value.
	 *
	 * @param key The name of the property or the index inside an array
	 * @param value The value being handled
	 * @param originalValue The original value
	 */
	replaceJsonValue?: (
		key: string | number,
		value: unknown,
		originalValue: unknown,
	) => unknown;

	/**
	 * Replacer function called for every KDL node or entry created
	 *
	 * The replacer can return an entry or node. If an entry is returned but an
	 * entry would not be valid in the given location, it will be transformed into
	 * a node. If `undefined` is returned, the value will be discarded.
	 *
	 * @param key The name of the property or the index inside an array
	 * @param value The entry or node that was created
	 * @param jsonValue The JSON value that was transformed into the KDL `value`
	 * @param originalJsonValue
	 */
	replaceKdlValue?: (
		key: string | number,
		value: Entry | Node,
		jsonValue: unknown,
		originalJsonValue: unknown,
	) => Entry | Node | undefined;
}

/**
 * Stringify the given JSON value into JiK text
 *
 * @param value The JSON value to encode
 * @param options Optional options
 * @throws If the given JSON value contains cycles.
 */
export function stringify(value: unknown, options?: StringifyOptions): string;
/**
 * Stringify the given JSON value into JiK text
 *
 * This function's signrature is explicitly kept similar to `JSON.stringify`.
 *
 * @param value The JSON value to encode
 * @param indentation The indentation to give each nested level of node, either the actual indentation string or the number of spaces
 * @throws If the given JSON value contains cycles.
 */
export function stringify(
	value: unknown,
	replacer?: StringifyOptions["replaceJsonValue"],
	indentation?: string | number,
): string;
