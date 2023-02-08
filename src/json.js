import {
	Document,
	Entry,
	Node,
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
 * @prop {(value: unknown, key: string | number, data: {location: Node | import('@bgotink/kdl').Entry}) => unknown} [reviver]
 */

/**
 * @param {Node} node
 * @param {ToJsonOptions} options
 */
function nodeToJsonValue(
	node,
	{ignoreValues = false, type = node.getTag() ?? undefined, reviver} = {},
) {
	const args = ignoreValues ? [] : node.getArgumentEntries();
	const props = new Map(
		node
			.getPropertyEntries()
			.map(node => [/** @type {string} */ (node.getName()), node]),
	);

	if (
		type === 'object' ||
		(type !== 'array' &&
			(props.size > 0 ||
				node.children?.nodes.some(child => child.getName() !== arrayItemKey)))
	) {
		if (args.length > 0) {
			throw new InvalidJsonInKdlError('A JSON object cannot have arguments');
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

		if (node.children) {
			for (const child of node.children.nodes) {
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

	if (type === 'array' || args.length > 1 || node.hasChildren()) {
		if (
			props.size > 0 ||
			node.children?.nodes.some(child => child.getName() !== arrayItemKey)
		) {
			throw new InvalidJsonInKdlError(
				'A JSON array cannot have properties or named children',
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

		if (node.children) {
			for (const child of node.children.nodes) {
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
		}

		return values;
	}

	if (args.length === 0) {
		throw new InvalidJsonInKdlError(
			`No value found in node ${JSON.stringify(node.getName())}`,
		);
	}

	return args[0].getValue();
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

	const value = nodeToJsonValue(node, options);
	if (options?.reviver != null) {
		return options.reviver(value, '', {location: node});
	}
	return value;
}

/**
 * @param {unknown} value
 * @param {object} options
 * @param {string} [options.nodeName]
 * @param {boolean} [options.allowEntries]
 * @param {boolean} [options.allowEntriesInArrays]
 * @param {boolean} [options.allowEntriesInObjects]
 * @param {boolean} [options.allowEntriesInRoot]
 * @param {string | number} [options.indentation]
 * @param {(key: string | number, value: unknown, originalValue: unknown) => unknown} [options.replaceJsonValue]
 * @param {(key: string | number, value: Entry | Node, jsonValue: unknown, originalJsonValue: unknown) => Entry | Node | undefined} [options.replaceKdlValue]
 */
export function fromJson(
	value,
	{
		nodeName = arrayItemKey,
		allowEntries = true,
		allowEntriesInArrays = allowEntries,
		allowEntriesInObjects = allowEntries,
		allowEntriesInRoot,
		indentation: indentationStep,
		replaceJsonValue,
		replaceKdlValue,
	} = {},
) {
	if (typeof indentationStep === 'string') {
		indentationStep = indentationStep;
	} else if (typeof indentationStep === 'number' && indentationStep > 0) {
		indentationStep = ' '.repeat(indentationStep);
	} else {
		indentationStep = '';
	}

	const result = /** @type {Node} */ (
		fromJsonValue(
			value,
			'',
			true,
			{
				nodeName,
				allowEntriesInArrays,
				allowEntriesInObjects,
				allowEntriesInCurrent: allowEntriesInRoot,
				replaceJsonValue,
				replaceKdlValue,
			},
			new Set(),
		)
	);

	applyIndentation(result, indentationStep);

	return result;
}

/**
 * @param {unknown} value
 * @return {value is string | null | number | boolean}
 */
function isLiteral(value) {
	switch (typeof value) {
		case 'boolean':
		case 'number':
		case 'string':
			return true;
		case 'object':
			return value == null;
		default:
			return false;
	}
}

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
 * @param {Set<unknown>} parents
 * @returns {Node | Entry | undefined}
 */
function fromJsonValue(
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
	parents,
) {
	const originalValue = value;
	if (
		value != null &&
		typeof value === 'object' &&
		typeof (/** @type {{toJSON: Function}} */ (value).toJSON) === 'function'
	) {
		value = /** @type {{toJSON: Function}} */ (value).toJSON();
	}
	if (replaceJsonValue) {
		value = replaceJsonValue(name, value, originalValue);
	}

	if (
		value === undefined ||
		typeof value === 'function' ||
		typeof value === 'symbol'
	) {
		return undefined;
	}

	if (!alwaysReturnNode && isLiteral(value)) {
		const entry =
			typeof name === 'number'
				? Entry.createArgument(value)
				: Entry.createProperty(nodeName, value);

		return replaceKdlValue != null
			? replaceKdlValue(name, entry, value, originalValue)
			: entry;
	}

	const node = Node.create(nodeName);

	if (isLiteral(value)) {
		node.addArgument(value);
		return replaceKdlValue != null
			? replaceKdlValue(name, node, value, originalValue)
			: node;
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

				if (toAppend.type === 'node') {
					useChild = true;
				}

				append(node, toAppend);
			}

			if (!node.hasChildren() && node.entries.length < 2) {
				node.setTag('array');
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

				if (toAppend.type === 'node') {
					appendedChildren.add(name);
				}

				append(node, toAppend);
			}

			if (
				!node.hasProperties() &&
				(appendedChildren.size === 0 ||
					(appendedChildren.size === 1 && appendedChildren.has(arrayItemKey)))
			) {
				node.setTag('object');
			}
		}
	} finally {
		parents.delete(value);
	}

	return replaceKdlValue != null
		? replaceKdlValue(name, node, value, originalValue)
		: node;

	/**
	 * @param {Node} node
	 * @param {Node | Entry | undefined} value
	 */
	function append(node, value) {
		if (value == null) {
			return;
		}

		if (value.type === 'entry') {
			if (
				allowEntriesInCurrent !== false &&
				(value.name != null || !node.hasChildren())
			) {
				node.entries.push(value);
				return;
			}

			const newNode = value.name
				? new Node(value.name)
				: Node.create(arrayItemKey);

			newNode.tag = value.tag;
			newNode.entries = [new Entry(value.value, null)];

			value = newNode;
		}

		node.appendNode(value);
	}
}

/**
 * @param {Node} root
 * @param {string} indentationStep
 */
function applyIndentation(root, indentationStep) {
	root.leading = '';
	root.trailing = '';

	let indentation = '';
	const trailing = indentationStep ? '\n' : ';';
	let documents = root.children ? [root.children] : [];

	while (documents.length > 0) {
		/** @type {Document[]} */
		let newDocuments = [];
		const nextIndentation = indentation + indentationStep;

		for (const document of documents) {
			document.trailing = indentation;

			for (const node of document.nodes) {
				node.leading = nextIndentation;
				node.trailing = trailing;

				if (node.children) {
					newDocuments.push(node.children);
				}
			}

			if (indentationStep) {
				const first = document.nodes[0];
				if (first) {
					first.leading = `\n${first.leading}`;
				}
			}
		}

		documents = newDocuments;
		indentation = nextIndentation;
	}
}

/**
 * @param {string} string
 * @param {(value: unknown, key: string | number, data: {location: Node | import('@bgotink/kdl').Entry}) => unknown} [reviver]
 */
export function parse(string, reviver) {
	return toJson(parseKdl(string), {reviver});
}

/**
 * @typedef {object} StringifyOptions
 * @prop {string | number} [indentation]
 * @prop {(key: string | number, value: unknown, originalValue: unknown) => unknown} [replaceJsonValue]
 * @prop {(key: string | number, value: Entry | Node, jsonValue: unknown, originalJsonValue: unknown) => Entry | Node | undefined} [replaceKdlValue]
 */

/**
 * @param {unknown} value
 * @param {StringifyOptions | StringifyOptions['replaceJsonValue']} [replacer]
 * @param {string | number} [indentation]
 */
export function stringify(value, replacer = {}, indentation) {
	let replaceJsonValue, replaceKdlValue;

	if (typeof replacer === 'function') {
		replaceJsonValue = replacer;
	} else if (typeof replacer === 'object' && replacer != null) {
		({replaceJsonValue, replaceKdlValue, indentation} = replacer);
	}

	return formatKdl(
		fromJson(value, {indentation, replaceJsonValue, replaceKdlValue}),
	);
}
