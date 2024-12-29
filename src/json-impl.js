import {Node, Entry} from "./index.js";

const arrayItemKey = "-";

export class InvalidJsonInKdlError extends Error {
	name = "InvalidJsonInKdlError";
}

/**
 * @typedef {object} ToJsonOptions
 * @prop {boolean} [ignoreValues]
 * @prop {string} [type]
 * @prop {(value: unknown, key: string | number, data: {location: Node | import('@bgotink/kdl').Entry}) => unknown} [reviver]
 */

/**
 * @overload
 * @param {Node} node
 * @param {ToJsonOptions & {reviver?: undefined}} [options]
 * @returns {import('./json.js').JsonValue}
 */
/**
 * @overload
 * @param {Node} node
 * @param {ToJsonOptions} [options]
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
/**
 * @param {Node} node
 * @param {ToJsonOptions} options
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
export function nodeToJsonValue(
	node,
	{ignoreValues = false, type = node.getTag() ?? undefined, reviver} = {},
) {
	return nodePartsToJsonValue(
		node.getName(),
		ignoreValues ? [] : node.getArgumentEntries(),
		new Map(
			node
				.getPropertyEntries()
				.map((entry) => [/** @type {string} */ (entry.getName()), entry]),
		),
		node.children?.nodes ?? [],
		{type, reviver},
	);
}

/**
 * @overload
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'> & {reviver?: undefined}} [options]
 * @returns {import('./json.js').JsonValue}
 */
/**
 * @overload
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'>} [options]
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
/**
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'>} options
 * @returns A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
export function nodePartsToJsonValue(
	name,
	args,
	props,
	children,
	{type, reviver} = {},
) {
	if (
		type === "object" ||
		(type !== "array" &&
			(props.size > 0 ||
				children.some((child) => child.getName() !== arrayItemKey)))
	) {
		if (args.length > 0) {
			throw new InvalidJsonInKdlError("A JSON object cannot have arguments");
		}

		/** @type {Map<string, unknown>} */
		const properties = new Map();
		for (const [name, prop] of props) {
			/** @type {unknown} */
			let property = prop.getValue();
			if (reviver != null) {
				property = reviver(property, name, {location: prop});
				if (property === undefined) {
					continue;
				}
			}
			properties.set(name, property);
		}

		if (children.length) {
			for (const child of children) {
				const name = child.getName();
				if (properties.has(name)) {
					throw new InvalidJsonInKdlError(
						`Duplicate key ${JSON.stringify(name)} in JSON object`,
					);
				}

				/** @type {unknown} */
				let property = nodeToJsonValue(child, {reviver});
				if (reviver != null) {
					property = reviver(property, name, {location: child});
					if (property === undefined) {
						continue;
					}
				}
				properties.set(name, property);
			}
		}

		return Object.fromEntries(properties);
	}

	if (type === "array" || args.length > 1 || children.length > 0) {
		if (
			props.size > 0 ||
			children.some((child) => child.getName() !== arrayItemKey)
		) {
			throw new InvalidJsonInKdlError(
				"A JSON array cannot have properties or named children",
			);
		}

		/** @type {unknown[]} */
		const values = [];
		let index = 0;

		for (const arg of args) {
			/** @type {unknown} */
			let value = arg.getValue();
			if (reviver != null) {
				value = reviver(value, index, {location: arg});
				index++;
				if (value === undefined) {
					continue;
				}
			}
			values.push(value);
		}

		for (const child of children) {
			/** @type {unknown} */
			let value = nodeToJsonValue(child, {reviver});
			if (reviver != null) {
				value = reviver(value, index, {location: child});
				index++;
				if (value === undefined) {
					continue;
				}
			}
			values.push(value);
		}

		return values;
	}

	if (args.length === 0) {
		throw new InvalidJsonInKdlError(
			`No value found in node ${JSON.stringify(name)}`,
		);
	}

	return args[0].getValue();
}

/**
 * @param {unknown} value
 * @return {value is string | null | number | boolean}
 */
function isLiteral(value) {
	switch (typeof value) {
		case "boolean":
		case "number":
		case "string":
			return true;
		case "object":
			return value == null;
		default:
			return false;
	}
}

/**
 * @overload
 * @param {unknown} value
 * @param {string | number} name
 * @param {true} alwaysReturnNode
 * @param {object} options
 * @param {string} options.nodeName
 * @param {boolean} options.allowEntriesInArrays
 * @param {boolean} options.allowEntriesInObjects
 * @param {boolean} [options.allowEntriesInCurrent]
 * @param {(key: string | number, value: unknown, originalValue: unknown) => unknown} [options.replaceJsonValue]
 * @param {(key: string | number, value: Entry | Node, jsonValue: unknown, originalJsonValue: unknown) => Entry | Node | undefined} [options.replaceKdlValue]
 * @param {Set<unknown>} [parents]
 * @returns {Node | undefined}
 */
/**
 * @overload
 * @param {unknown} value
 * @param {string | number} name
 * @param {boolean} alwaysReturnNode
 * @param {object} options
 * @param {string} options.nodeName
 * @param {boolean} options.allowEntriesInArrays
 * @param {boolean} options.allowEntriesInObjects
 * @param {boolean} [options.allowEntriesInCurrent]
 * @param {(key: string | number, value: unknown, originalValue: unknown) => unknown} [options.replaceJsonValue]
 * @param {(key: string | number, value: Entry | Node, jsonValue: unknown, originalJsonValue: unknown) => Entry | Node | undefined} [options.replaceKdlValue]
 * @param {Set<unknown>} [parents]
 * @returns {Node | Entry | undefined}
 */
/**
 * @param {unknown} value
 * @param {string | number} name
 * @param {boolean} alwaysReturnNode
 * @param {object} options
 * @param {string} options.nodeName
 * @param {boolean} options.allowEntriesInArrays
 * @param {boolean} options.allowEntriesInObjects
 * @param {boolean} [options.allowEntriesInCurrent]
 * @param {(key: string | number, value: unknown, originalValue: unknown) => unknown} [options.replaceJsonValue]
 * @param {(key: string | number, value: Entry | Node, jsonValue: unknown, originalJsonValue: unknown) => Entry | Node | undefined} [options.replaceKdlValue]
 * @param {Set<unknown>} [parents]
 * @returns {Node | Entry | undefined}
 */
export function fromJsonValue(
	value,
	name,
	alwaysReturnNode,
	{
		nodeName,
		allowEntriesInArrays,
		allowEntriesInObjects,
		allowEntriesInCurrent,
		replaceJsonValue,
		replaceKdlValue,
	},
	parents = new Set(),
) {
	const originalValue = value;
	if (
		value != null &&
		typeof value === "object" &&
		typeof (/** @type {{toJSON: Function}} */ (value).toJSON) === "function"
	) {
		value = /** @type {{toJSON: Function}} */ (value).toJSON();
	}
	if (replaceJsonValue) {
		value = replaceJsonValue(name, value, originalValue);
	}

	if (
		value === undefined ||
		typeof value === "function" ||
		typeof value === "symbol"
	) {
		return undefined;
	}

	if (!alwaysReturnNode && isLiteral(value)) {
		const entry =
			typeof name === "number" ?
				Entry.createArgument(value)
			:	Entry.createProperty(nodeName, value);

		return replaceKdlValue != null ?
				replaceKdlValue(name, entry, value, originalValue)
			:	entry;
	}

	const node = Node.create(nodeName);

	if (isLiteral(value)) {
		node.addArgument(value);
		return replaceKdlValue != null ?
				replaceKdlValue(name, node, value, originalValue)
			:	node;
	}

	if (parents.has(value)) {
		throw new InvalidJsonInKdlError(
			`Cyclic JSON cannot be transformed into KDL`,
		);
	}

	parents.add(value);
	try {
		if (Array.isArray(value)) {
			let useChild = !(allowEntriesInCurrent ?? allowEntriesInArrays);

			for (const [i, item] of value.entries()) {
				const toAppend = fromJsonValue(
					item,
					i,
					useChild,
					{
						nodeName: arrayItemKey,
						allowEntriesInArrays,
						allowEntriesInObjects,
						replaceJsonValue,
						replaceKdlValue,
					},
					parents,
				);

				if (toAppend == null) {
					continue;
				}

				if (toAppend.type === "node") {
					useChild = true;
				}

				append(node, toAppend, allowEntriesInCurrent);
			}

			if (!node.hasChildren() && node.entries.length < 2) {
				node.setTag("array");
			}
		} else {
			const useChild = !(allowEntriesInCurrent ?? allowEntriesInObjects);
			const properties = Object.entries(
				/** @type {Record<string, unknown>} */ (value),
			);

			/** @type {Set<string>} */
			const appendedChildren = new Set();

			for (const [name, property] of properties) {
				const toAppend = fromJsonValue(
					property,
					name,
					useChild,
					{
						nodeName: name,
						allowEntriesInArrays,
						allowEntriesInObjects,
						replaceJsonValue,
						replaceKdlValue,
					},
					parents,
				);

				if (toAppend == null) {
					continue;
				}

				if (toAppend.type === "node") {
					appendedChildren.add(name);
				}

				append(node, toAppend, allowEntriesInCurrent);
			}

			if (
				!node.hasProperties() &&
				(appendedChildren.size === 0 ||
					(appendedChildren.size === 1 && appendedChildren.has(arrayItemKey)))
			) {
				node.setTag("object");
			}
		}
	} finally {
		parents.delete(value);
	}

	return replaceKdlValue != null ?
			replaceKdlValue(name, node, value, originalValue)
		:	node;
}

/**
 * @param {Node} node
 * @param {Node | Entry | undefined} value
 * @param {boolean | undefined} allowEntriesInCurrent
 */
function append(node, value, allowEntriesInCurrent) {
	if (value == null) {
		return;
	}

	if (value.type === "entry") {
		if (
			allowEntriesInCurrent !== false &&
			(value.name != null || !node.hasChildren())
		) {
			node.entries.push(value);
			return;
		}

		const newNode =
			value.name ? new Node(value.name) : Node.create(arrayItemKey);

		newNode.tag = value.value.tag;
		newNode.entries = [new Entry(value.value, null)];

		value = newNode;
	}

	node.appendNode(value);
}
