import {Entry, Node} from "../model.js";
import {KdlDeserializeError} from "./deserialization/error.js";
import {joinWithOr} from "./deserialization/utils.js";

/** @import {Primitive} from "../index.js" */
/** @import {JsonValue, JsonObject} from "../json.js" */
/** @import {JsonType} from "./deserialization/types.js" */

const arrayItemKey = "-";

/** @type {[]} */
const empty = [];

/** @type {WeakMap<JsonObject | JsonValue[], Node>} */
const valueToNodeMap = new WeakMap();

/**
 * @param {JsonValue} value
 * @returns {value is Primitive}
 */
function isPrimitive(value) {
	return value == null || typeof value !== "object";
}

/**
 * @param {readonly JsonType[]} types
 * @param {Node} node
 * @param {readonly Entry[]} args
 * @param {ReadonlyMap<string, Entry>} props
 * @param {readonly Node[]} children
 * @returns {JsonValue}
 */
export function deserializeJson(types, node, args, props, children) {
	let type = node.getTag();
	// We're only interested in types set to object or array
	if (type !== "object" && type !== "array") {
		type = null;
	}

	let allowedTypes = types.length ? new Set(types) : null;

	if (type != null && allowedTypes?.has(type) === false) {
		throw new KdlDeserializeError(
			`Cannot deserialize a node tagged with ${type} into a ${joinWithOr(types)}`,
			{location: node},
		);
	}

	if (type == null) {
		if (allowedTypes?.size === 1) {
			type = types[0];
		}
	} else {
		allowedTypes = new Set([type]);
	}

	if (
		type === "object" ||
		(type !== "array" &&
			(props.size > 0 ||
				children.some((child) => child.getName() !== arrayItemKey)))
	) {
		if (allowedTypes?.has("object") === false) {
			throw new KdlDeserializeError(
				`Encountered a JSON object but expected a ${joinWithOr(types)}`,
				{location: node},
			);
		}

		if (args.length > 0) {
			throw new KdlDeserializeError("A JSON object cannot have arguments", {
				location: args[0],
			});
		}

		/** @type {Map<string, JsonValue>} */
		const properties = new Map();
		for (const [name, prop] of props) {
			properties.set(name, prop.getValue());
		}

		if (children.length) {
			for (const child of children) {
				const name = child.getName();
				if (properties.has(name)) {
					throw new KdlDeserializeError(
						`Duplicate key ${JSON.stringify(name)} in JSON object`,
						{location: child},
					);
				}

				properties.set(name, deserializeJsonNode(child));
			}
		}

		return Object.fromEntries(properties);
	}

	if (type === "array" || args.length > 1 || children.length > 0) {
		if (allowedTypes?.has("array") === false) {
			throw new KdlDeserializeError(
				`Encountered a JSON array but expected a ${joinWithOr(types)}`,
				{location: node},
			);
		}

		if (
			props.size > 0 ||
			children.some((child) => child.getName() !== arrayItemKey)
		) {
			throw new KdlDeserializeError(
				"A JSON array cannot have properties or named children",
				{location: node},
			);
		}

		/** @type {JsonValue[]} */
		const items = [];

		for (const arg of args) {
			items.push(arg.getValue());
		}

		for (const child of children) {
			items.push(deserializeJsonNode(child));
		}

		return items;
	}

	if (args.length === 0) {
		throw new KdlDeserializeError(`No value found in node`, {location: node});
	}

	return args[0].getValue();
}

/**
 * @param {Node} node
 * @returns {JsonValue}
 */
function deserializeJsonNode(node) {
	/** @type {Entry[]} */
	const args = [];
	/** @type {Map<string, Entry>} */
	const props = new Map();
	/** @type {Node[]} */
	const children = node.children ? node.children.nodes : empty;

	for (const entry of node.entries) {
		const entryName = entry.getName();
		if (entryName == null) {
			args.push(entry);
		} else {
			props.set(entryName, entry);
		}
	}

	const value = deserializeJson(empty, node, args, props, children);

	if (value != null && typeof value === "object") {
		valueToNodeMap.set(value, node);
	}

	return value;
}

/**
 * @param {boolean} canAddEntries Whether adding entries is allowed
 * @param {JsonValue} value The value to serialize
 * @param {string | null} tag An explicit tag already set on the node
 * @param {Node} node The node to serialize into
 * @param {Node | null | undefined} source Source node which deserialized into the value
 * @param {Entry[]} existingArgs Existing arguments on the source node that can be cloned and re-used
 * @param {Map<string, Entry>} existingProps Existing properties on the source node that can be cloned and re-used
 * @param {Set<unknown>} parents
 */
export function serializeJson(
	canAddEntries,
	value,
	tag,
	node,
	source,
	existingArgs,
	existingProps,
	parents = new Set(),
) {
	if (isPrimitive(value)) {
		// primitive value -> add as a single argument

		if (!canAddEntries) {
			throw new Error(
				`Cannot serialize a primitive (non-object) JSON value into a document`,
			);
		}
		if (tag === "object" || tag === "array") {
			throw new Error(
				`Cannot serialize a primitive (non-object) JSON value to a node tagged with (${tag})`,
			);
		} else if (tag == null) {
			// If tag is null, then the tag is 100% in control of this function, so we can safely remove it
			node.setTag(null);
		}

		let arg = existingArgs.shift()?.clone();
		if (arg != null) {
			arg.setValue(value);
			arg.setTag(null);
		} else {
			arg = Entry.createArgument(value);
		}

		node.entries.push(arg);
		return;
	}

	if (parents.has(value)) {
		throw new Error("Detected cycle in JSON structure");
	}

	parents.add(value);
	try {
		if (Array.isArray(value)) {
			if (tag === "object") {
				throw new Error(
					`Cannot serialize a JSON array to a node tagged with (object)`,
				);
			}

			let i = 0,
				{length} = value;

			if (length === 0) {
				// This array is empt
				// -> we need to add an (array) tag to properly represent the empty array in JiK
				if (tag != null && tag !== "array") {
					throw new Error(
						`Cannot serialize an empty JSON array to a node tagged with (${JSON.stringify(tag)})`,
					);
				}

				node.setTag("array");
				return;
			}

			let sourceChildren = source?.findNodesByName(arrayItemKey) ?? [];

			// First try to assign items via arguments
			for (; canAddEntries && i < length; i++) {
				const item = value[i];
				if (!isPrimitive(item)) {
					break;
				}

				let arg = existingArgs.shift()?.clone();
				if (arg != null) {
					arg.setValue(item);
					arg.setTag(null);
				} else {
					// We've run out of existing arguments, check if we should switch to existing children instead
					// - if this is the first item and there are source children -> let's assume all items in the array are shown as children
					// - if there are enough source children left to represent the rest of the array, assume the document switches over to children now
					if (
						(i === 0 && sourceChildren.length > 0) ||
						i + sourceChildren.length >= length
					) {
						break;
					}

					arg = Entry.createArgument(item);
				}

				node.entries.push(arg);
			}

			if (length < 2 && i === length) {
				// This array has a single value which has been added as argument
				// -> we need to either add the tag or switch to using a child instead
				if (tag == null) {
					node.setTag("array");
				} else if (tag !== "array") {
					i--;
					node.entries.pop();
				}
			} else {
				// We don't need the array to be tagged as (array), but if it's there then let's keep it.
				// If we find another tag (i.e. (object)), then remove it.
				// Only remove it if the tag was not set explicitly, i.e. if tag is absent
				if (tag == null && node.getTag() != "array") {
					node.setTag(null);
				}
			}

			// Remove linked children from the source children
			//
			// In theory this loop is O(n^2), which is very slow, but in practice that is only
			// the case for arrays that get reversed. If the array remained in order, then
			// this should be O(n) as the indexOf keeps returning indices at the beginning of the array
			//
			// If this does turn out to become a bottleneck, we can switch to using a Set instead,
			// as Sets keep items in insertion order.
			for (let j = i; j < length; j++) {
				const item = value[i];
				const linkedChild =
					isPrimitive(item) ? undefined : valueToNodeMap.get(item);
				if (!linkedChild) {
					continue;
				}

				const index = sourceChildren.indexOf(linkedChild);
				if (index === -1) {
					continue;
				}

				sourceChildren.splice(index, 1);
			}

			// Then add children for the rest
			for (; i < length; i++) {
				const item = value[i];

				const childSource =
					isPrimitive(item) ? sourceChildren.shift() : valueToNodeMap.get(item);

				const child = serializeJsonNode(
					arrayItemKey,
					item,
					childSource,
					parents,
				);

				node.appendNode(child);
			}
		} else {
			// Not a primitive, not an array, must be an object

			if (tag === "array") {
				throw new Error(
					`Cannot serialize a JSON object to a node tagged with (array)`,
				);
			}

			const properties = Object.entries(value);

			if (properties.length === 0) {
				// This object is empt
				// -> we need to add an (object) tag to properly represent the empty object in JiK
				if (tag != null && tag !== "object") {
					throw new Error(
						`Cannot serialize an empty JSON object to a node tagged with (${JSON.stringify(tag)})`,
					);
				}

				node.setTag("object");
				return;
			}

			let canUseProperties = canAddEntries;

			if (
				canUseProperties &&
				properties.length === 1 &&
				properties[0][0] === arrayItemKey &&
				isPrimitive(properties[0][1])
			) {
				if (tag == null) {
					// Add the object tag
					node.setTag("object");
				} else if (tag !== "object") {
					canUseProperties = false;
				}
			} else {
				if (tag == null && node.getTag() !== "object") {
					node.setTag(null);
				}
			}

			const sourceChildren = new Map(
				source?.children?.nodes.map((c) => [c.getName(), c]),
			);

			for (const [name, value] of properties) {
				if (canUseProperties && isPrimitive(value)) {
					// We can use a property!

					if (!existingProps.has(name) && sourceChildren.has(name)) {
						// There's a child with this name, let's keep using the child shall we?
						// NOTE this could cause weird behaviour if a node with the same name was
						// present in the source but not part of the JSON.
						//
						// For example, the deserializer
						//   (ctx) => [ ctx.child("node", c => c.argument()), ctx.json() ]
						// will produce a [ "firstNode" {"node": "secondNode"} ] when given
						// the document
						//   parent { node firstNode; node secondNode }
						// If we then serialize this back, we'll re-use the find the first "node"
						// here, even though we should actually re-use the second...
					} else {
						let prop = existingProps.get(name)?.clone();

						if (prop) {
							prop.setValue(value);
							prop.setTag(null);
						} else {
							prop = Entry.createProperty(name, value);
						}

						node.entries.push(prop);
						continue;
					}
				}

				// Cannot be set as property -> must be a child

				const childSource =
					isPrimitive(value) ?
						sourceChildren.get(name)
					:	valueToNodeMap.get(value);

				const child = serializeJsonNode(name, value, childSource, parents);

				node.appendNode(child);
			}
		}
	} finally {
		parents.delete(value);
	}
}

/**
 * @param {string} name
 * @param {JsonValue} value
 * @param {Node | undefined} source
 * @param {Set<unknown>} parents
 * @returns {Node}
 */
function serializeJsonNode(name, value, source, parents) {
	let node;

	/** @type {Entry[]} */
	let existingArgs = [];
	/** @type {Map<string, Entry>} */
	let existingProps = new Map();

	if (source) {
		existingArgs = source.getArgumentEntries();
		existingProps = source.getPropertyEntryMap();

		node = source.clone({shallow: true});
		node.setName(name);
	} else {
		node = Node.create(name);
	}

	serializeJson(
		true,
		value,
		null,
		node,
		source,
		existingArgs,
		existingProps,
		parents,
	);

	return node;
}
