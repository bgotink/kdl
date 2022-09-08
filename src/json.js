import {
	Node,
	Document,
	parse as parseKdl,
	format as formatKdl,
} from '@bgotink/kdl';

const arrayItemKey = '-';

export class InvalidJsonInKdlError extends Error {
	/** @param {string} message */
	constructor(message) {
		super(message);

		this.name = 'InvalidJsonInKdlError';
	}
}

/**
 * @typedef {object} ToJsonOptions
 * @prop {boolean} [ignoreValues]
 * @prop {string} [type]
 */

/**
 * @param {Node} node
 * @param {ToJsonOptions} [options]
 */
function nodeToJsonValue(
	node,
	{ignoreValues = false, type = node.getTag() ?? undefined} = {},
) {
	/** @type {unknown[]} */
	const args = ignoreValues ? [] : node.getArguments();
	/** @type {Map<string, unknown>} */
	const props = node.getProperties();

	if (
		type === 'object' ||
		(type !== 'array' &&
			(props.size > 0 ||
				node.children?.nodes.some(child => child.getName() !== arrayItemKey)))
	) {
		if (args.length > 0) {
			throw new InvalidJsonInKdlError('A JSON object cannot have arguments');
		}

		if (node.children) {
			for (const child of node.children.nodes) {
				const name = child.getName();
				if (props.has(name)) {
					throw new InvalidJsonInKdlError(
						`Duplicate key ${JSON.stringify(name)} in JSON object`,
					);
				}

				props.set(name, nodeToJsonValue(child));
			}
		}

		return Object.fromEntries(props);
	}

	if (type === 'array' || args.length > 1 || node.hasChildren()) {
		if (
			props.size > 0 ||
			node.children?.nodes.some(child => child.getName() !== arrayItemKey)
		) {
			throw new InvalidJsonInKdlError(
				'A JSON array cannot have properties or named children',
			);
		}

		if (node.children) {
			for (const child of node.children.nodes) {
				args.push(nodeToJsonValue(child));
			}
		}

		return args;
	}

	if (args.length === 0) {
		throw new InvalidJsonInKdlError(
			`No value found in node ${JSON.stringify(node.getName())}`,
		);
	}

	return args[0];
}

/**
 * @param {Node | Document} nodeOrDocument
 * @param {ToJsonOptions} [options]
 */
export function toJson(nodeOrDocument, options) {
	let node;
	if (nodeOrDocument.type === 'node') {
		node = nodeOrDocument;
	} else {
		if (nodeOrDocument.nodes.length !== 1) {
			throw new InvalidJsonInKdlError(
				'JSON-in-KDL requires a single node in the document',
			);
		}

		node = nodeOrDocument.nodes[0];
	}

	return nodeToJsonValue(node, options);
}

/**
 * @param {unknown} value
 * @param {object} [options]
 * @param {string} [options.nodeName]
 * @param {boolean} [options.allowEntries]
 * @param {boolean} [options.allowEntriesInArrays]
 * @param {boolean} [options.allowEntriesInObjects]
 * @param {boolean} [options.allowEntriesInRoot]
 */
export function fromJson(
	value,
	{
		nodeName = arrayItemKey,
		allowEntries = true,
		allowEntriesInArrays = allowEntries,
		allowEntriesInObjects = allowEntries,
		allowEntriesInRoot,
	} = {},
) {
	return fromJsonValue(
		value,
		{
			nodeName,
			allowEntriesInArrays,
			allowEntriesInObjects,
			allowEntriesInCurrent: allowEntriesInRoot,
		},
		new Set(),
	);
}

/**
 * @param {unknown} value
 * @return {value is string | null | number | boolean | undefined}
 */
function isLiteral(value) {
	switch (typeof value) {
		case 'boolean':
		case 'number':
		case 'string':
		case 'undefined':
			return true;
		case 'object':
			return value == null;
		default:
			return false;
	}
}

/**
 * @param {unknown} value
 * @param {object} options
 * @param {string} options.nodeName
 * @param {boolean} options.allowEntriesInArrays
 * @param {boolean} options.allowEntriesInObjects
 * @param {boolean} [options.allowEntriesInCurrent]
 * @param {Set<unknown>} parents
 * @returns {Node}
 */
function fromJsonValue(
	value,
	{
		nodeName,
		allowEntriesInArrays,
		allowEntriesInObjects,
		allowEntriesInCurrent,
	},
	parents,
) {
	if (isLiteral(value)) {
		const node = Node.create(nodeName);
		node.addArgument(value ?? null);
		return node;
	}

	if (parents.has(value)) {
		throw new InvalidJsonInKdlError(
			`Cyclic JSON cannot be transformed into KDL`,
		);
	}

	parents.add(value);
	try {
		const node = Node.create(nodeName);

		if (Array.isArray(value)) {
			let useChild = !(allowEntriesInCurrent ?? allowEntriesInArrays);

			if (value.length === 0) {
				node.setTag('array');
			} else if (!useChild && value.length === 1 && isLiteral(value[0])) {
				node.setTag('array');
				node.addArgument(value[0] ?? null);
			} else {
				for (const item of value) {
					if (!useChild && isLiteral(item)) {
						node.addArgument(item ?? null);
					} else {
						useChild = true;
						node.appendNode(
							fromJsonValue(
								item,
								{
									nodeName: arrayItemKey,
									allowEntriesInArrays,
									allowEntriesInObjects,
								},
								parents,
							),
						);
					}
				}
			}
		} else {
			const useChild = !(allowEntriesInCurrent ?? allowEntriesInObjects);
			const properties = Object.entries(
				/** @type {Record<string, unknown>} */ (value),
			);

			if (properties.length === 0) {
				node.setTag('object');
			} else if (
				properties.length === 1 &&
				properties[0][0] === arrayItemKey &&
				(useChild || !isLiteral(properties[0][1]))
			) {
				node.setTag('object');
				node.appendNode(
					fromJsonValue(
						properties[0][1],
						{
							nodeName: arrayItemKey,
							allowEntriesInArrays,
							allowEntriesInObjects,
						},
						parents,
					),
				);
			} else {
				for (const [name, property] of properties) {
					if (!useChild && isLiteral(property)) {
						node.setProperty(name, property ?? null);
					} else {
						node.appendNode(
							fromJsonValue(
								property,
								{
									nodeName: name,
									allowEntriesInArrays,
									allowEntriesInObjects,
								},
								parents,
							),
						);
					}
				}
			}
		}

		return node;
	} finally {
		parents.delete(value);
	}
}

/**
 * @param {string} string
 */
export function parse(string) {
	return toJson(parseKdl(string));
}

/**
 * @param {unknown} value
 */
export function stringify(value) {
	return formatKdl(fromJson(value));
}
