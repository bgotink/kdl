import {Node} from "../../index.js";
import {fromJsonValue} from "../../json-impl.js";
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
 * @param {string} name
 * @param {t.Serializer<P>} serializer
 * @param {P} parameters
 * @returns {Node}
 */
export function serialize(name, serializer, ...parameters) {
	if ("serializeToNode" in serializer) {
		return serializer.serializeToNode(name, ...parameters);
	}

	const node = Node.create(name);

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

	/** @type {t.SerializationContext} */
	const ctx = {
		argument: tagged((tag, value) => {
			node.addArgument(value, tag);
		}),

		property: tagged((tag, key, value) => {
			node.setProperty(key, value, tag);
		}),

		child: /** @type {t.SerializationContext["child"]} */ (
			tagged((tag, name, serializer, ...parameters) => {
				const child = serialize(name, serializer, ...parameters);
				child.setTag(tag);

				node.appendNode(child);
			})
		),

		json(value) {
			const {entries, children} =
				fromJsonValue(value, "", true, {
					nodeName: name,
					allowEntriesInArrays: true,
					allowEntriesInObjects: true,
					allowEntriesInCurrent: false,
				}) ?? {};

			if (entries) {
				node.entries.push(...entries);
			}
			if (children) {
				node.children =
					node.children ? concat(node.children, children) : children;
			}
		},

		run,
	};

	run(serializer, ...parameters);

	return node;
}
