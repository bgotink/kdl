import {Document, Entry, Node, format as formatDocument} from "../../index.js";
import {fromJsonValue} from "../../json-impl.js";
import {getNodeForContext} from "../shared.js";
import {concat} from "./public-utils.js";

/** @import * as t from "./types.js" */

/**
 * @template {unknown[]} A
 * @template R
 * @param {(tag: string | null, ...args: NoInfer<A>) => R} fn
 * @returns {t.Tagged<(...args: A) => R>}
 */
function tagged(fn) {
	const result = /** @type {t.Tagged<(...args: A) => R>} */ (
		(...args) => fn(null, ...args)
	);

	result.tagged = (tag, ...args) => fn(tag, ...args);

	return result;
}

/**
 * Create a node with the given name using the given serializer
 *
 * @template {unknown[]} P
 * @param {string | null | typeof Document} name
 * @param {t.Serializer<P> | t.DocumentSerializer<P>} serializer
 * @param {P} parameters
 * @returns {Node | Document}
 */
export function serialize(name, serializer, ...parameters) {
	if ("serializeToNode" in serializer) {
		if (typeof name !== "string")
			throw new TypeError(
				"An object with serializeToNode can only be serialized to a node, not to a document, pass a node name",
			);
		return serializer.serializeToNode(name, ...parameters);
	}

	let node = Node.create(typeof name === "string" ? name : "-");

	/**
	 * @template {unknown[]} P
	 * @param {t.SerializerFromContext<P>} serializer
	 * @param {P} parameters
	 * @returns {void}
	 */
	function run(serializer, ...parameters) {
		if ("serialize" in serializer) {
			serializer.serialize(ctx, ...parameters);
		} else {
			serializer(ctx, ...parameters);
		}
	}

	/** @type {import("../deserialization/types.js").DeserializationContext | null | undefined} */
	let source;

	/** @type {Entry[]} */
	let existingArguments = [];
	/** @type {Map<string, Entry>} */
	let existingProperties = new Map();
	// No need to track children, they are handled via their own context which can be linked via the source() function.

	/** @type {t.SerializationContext} */
	const ctx = {
		target: /** @type {"node"} */ (
			typeof name === "string" ? "node" : "document"
		),

		source(dectx) {
			if (source != null) {
				throw new Error("The source function can only be called once");
			}

			if (node.entries.length || node.hasChildren()) {
				throw new Error(
					"The source function can only be called at the start of a serialize function",
				);
			}

			source = dectx;
			const sourceNode = dectx && getNodeForContext(dectx);
			if (!sourceNode) {
				return;
			}

			node = sourceNode.clone({shallow: true});
			node.setName(typeof name === "string" ? name : "-");

			existingArguments = node.getArgumentEntries();
			existingProperties = new Map(
				node
					.getPropertyEntries()
					.map((entry) => [/** @type {string} */ (entry.getName()), entry]),
			);

			// Clear out the children, existing children can get updated if their SerializationContext.source function is called
			if (node.children) {
				node.children.nodes = [];
			}
		},

		argument: tagged((tag, value) => {
			if (typeof name !== "string")
				throw new TypeError(
					"The argument function on SerializationContext is not available when serializing to a Document",
				);

			const existingArgument = existingArguments.shift();

			if (existingArgument) {
				existingArgument.setValue(value);
				existingArgument.setTag(tag);
			} else {
				node.addArgument(value, tag);
			}
		}),

		property: tagged((tag, key, value) => {
			if (typeof name !== "string")
				throw new TypeError(
					"The property function on SerializationContext is not available when serializing to a Document",
				);

			const existingProperty = existingProperties.get(key);

			if (existingProperty) {
				existingProperty.setValue(value);
				existingProperty.setTag(tag);
			} else {
				node.setProperty(key, value, tag);
			}
		}),

		child: /** @type {t.SerializationContext["child"]} */ (
			tagged((tag, n, serializer, ...parameters) => {
				if (typeof n !== "string")
					throw new TypeError("Child name must be a string");
				// @overload + rest parameters == boom, so we have to cast here
				const child = /** @type {Node} */ (
					serialize(n, serializer, ...parameters)
				);
				child.setTag(tag);

				node.appendNode(child);
			})
		),

		json(value) {
			const {entries, children} =
				fromJsonValue(value, "", true, {
					nodeName: "-",
					allowEntriesInArrays: true,
					allowEntriesInObjects: true,
					allowEntriesInCurrent: false,
				}) ?? {};

			// Only happens if the value is a primitive
			if (entries?.length) {
				if (typeof name !== "string")
					throw new TypeError(
						"The json function on SerializationContext can only be passed an object or array when serializing to a Document",
					);

				node.entries.push(...entries);
			}

			if (children) {
				node.children =
					node.children ? concat(node.children, children) : children;
			}
		},

		run,
	};

	// @ts-expect-error If only typescript supported @overload with rest parameters
	run(serializer, ...parameters);

	return typeof name !== "string" ? (node.children ?? new Document()) : node;
}

/**
 * Serialize a KDL document and format it to a string
 *
 * @template {unknown[]} P
 * @param {t.DocumentSerializer<P>} serializer
 * @param  {P} parameters
 * @returns
 */
export function format(serializer, ...parameters) {
	return formatDocument(serialize(null, serializer, ...parameters));
}
