import {Document, Identifier, Node} from './model.js';

const arrayItemKey = '-';

export class InvalidJsonInKdlError extends Error {
	/** @param {string} message */
	constructor(message) {
		super(message);

		this.name = 'InvalidJsonInKdlError';
	}
}

/**
 * @param {Node} node
 */
function nodeToJsonValue(node) {
	/** @type {unknown[]} */
	const args = node.getArguments();
	/** @type {Map<string, unknown>} */
	const props = node.getProperties();

	if (
		node.getTag() === 'object' ||
		(node.getTag() !== 'array' &&
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

	if (node.getTag() === 'array' || args.length > 1 || node.hasChildren()) {
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
 */
export function toJson(nodeOrDocument) {
	if (nodeOrDocument.type === 'document') {
		nodeOrDocument = new Node(new Identifier(''), undefined, nodeOrDocument);
	}

	return nodeToJsonValue(nodeOrDocument);
}
