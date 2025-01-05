import {Document, Entry, Node, format as formatDocument} from "../../index.js";
import {serializeJson} from "../json.js";
import {getNodeForContext} from "../shared.js";

/** @import * as t from "./types.js" */

/**
 * @template {unknown[]} A
 * @template R
 * @param {(tag: string | null, ...args: NoInfer<A>) => R} fn
 * @returns {{ (...args: A): R; tagged(tag: string, ...args: A): R}}
 */
function tagged(fn) {
	const result =
		/** @type {{ (...args: A): R; tagged(tag: string, ...args: A): R}} */ (
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
	const isSerializingDocument = typeof name !== "string";

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

			existingArguments = sourceNode.getArgumentEntries();
			existingProperties = sourceNode.getPropertyEntryMap();
		},

		argument: tagged((tag, value) => {
			if (isSerializingDocument) {
				throw new TypeError(
					"The argument function on SerializationContext is not available when serializing to a Document",
				);
			}

			let argument = existingArguments.shift()?.clone();

			if (argument) {
				argument.setValue(value);
			} else {
				argument = Entry.createArgument(value);
			}

			argument.setTag(tag);
			node.entries.push(argument);
		}),

		property: tagged((tag, key, value) => {
			if (isSerializingDocument) {
				throw new TypeError(
					"The property function on SerializationContext is not available when serializing to a Document",
				);
			}

			let property = existingProperties.get(key)?.clone();

			if (property) {
				property.setValue(value);
			} else {
				property = Entry.createProperty(key, value);
			}

			property.setTag(tag);
			node.entries.push(property);
		}),

		child: /** @type {t.SerializationContext["child"]} */ (
			tagged((tag, n, serializer, ...parameters) => {
				if (typeof n !== "string") {
					throw new TypeError("Child name must be a string");
				}

				// @overload + rest parameters == boom, so we have to cast here
				const child = /** @type {Node} */ (
					serialize(n, serializer, ...parameters)
				);
				child.setTag(tag);

				node.appendNode(child);
			})
		),

		json(value) {
			serializeJson(
				!isSerializingDocument,
				value,
				node.getTag(),
				node,
				source && getNodeForContext(source),
				existingArguments,
				existingProperties,
			);
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
