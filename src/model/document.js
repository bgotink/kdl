import {Node} from "./node.js";
import {reverseIterate} from "./utils.js";
import {Value} from "./value.js";

/**
 * @param {Node | Document} node
 */
function* getNodes(node) {
	if (node instanceof Document) {
		yield* node.nodes;
	} else {
		yield node;
	}
}

/**
 * A document is a collection of zero or mode {@link Node}s
 */
export class Document {
	/**
	 * @readonly
	 * @hidden
	 */
	type = "document";

	/**
	 * @readonly
	 * @hidden
	 */
	static type = "document";

	/**
	 * The nodes in this document
	 *
	 * @type {Node[]}
	 */
	nodes;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 * @hidden
	 */
	trailing;

	/**
	 * @param {Node[]} [nodes]
	 */
	constructor(nodes = []) {
		this.nodes = nodes;
	}

	/**
	 * Create an identical copy of this document
	 *
	 * @returns {Document}
	 */
	clone() {
		const clone = new Document(this.nodes.map((node) => node.clone()));

		clone.trailing = this.trailing;

		return clone;
	}

	/**
	 * Add the given node at the end of this document
	 *
	 * @param {Node | Document} node
	 */
	appendNode(node) {
		this.nodes.push(...getNodes(node));
	}

	/**
	 * Insert the given node to the document before the referenceNode, or at the end if no reference is passed
	 *
	 * @param {Node | Document} newNode
	 * @param {Node | null} referenceNode
	 * @throws {Error} If the given referenceNode is not part of this document
	 */
	insertNodeBefore(newNode, referenceNode) {
		if (referenceNode == null) {
			this.nodes.push(...getNodes(newNode));
			return;
		}

		const index = this.nodes.indexOf(referenceNode);
		if (index === -1) {
			throw new Error("Reference node is not in document");
		}

		this.nodes.splice(index, 0, ...getNodes(newNode));
	}

	/**
	 * Insert the given node to the document after the referenceNode, or at the beginning if no reference is passed
	 *
	 * @param {Node | Document} newNode
	 * @param {Node | null} referenceNode
	 * @throws {Error} If the given referenceNode is not part of this document
	 */
	insertNodeAfter(newNode, referenceNode) {
		if (referenceNode == null) {
			this.nodes.unshift(...getNodes(newNode));
			return;
		}

		const index = this.nodes.indexOf(referenceNode);
		if (index === -1) {
			throw new Error("Reference node is not in document");
		}

		this.nodes.splice(index + 1, 0, ...getNodes(newNode));
	}

	/**
	 * Remove the given node from this document
	 *
	 * @param {Node} node
	 * @throws {Error} if the given node is not in this document
	 */
	removeNode(node) {
		const index = this.nodes.indexOf(node);
		if (index === -1) {
			throw new Error("Node to remove is not in document");
		}

		this.nodes.splice(index, 1);
	}

	/**
	 * Replace the old node with the new node in this document
	 *
	 * @param {Node} oldNode
	 * @param {Node | Document} newNode
	 * @throws {Error} if the oldNode is not in this document
	 */
	replaceNode(oldNode, newNode) {
		const index = this.nodes.indexOf(oldNode);
		if (index === -1) {
			throw new Error("Node to replace is not in document");
		}

		this.nodes.splice(index, 1, ...getNodes(newNode));
	}

	/**
	 * Return all nodes with the given node name
	 *
	 * Changes to the returned array are not reflected back onto this document
	 * itself, and updates to the document won't reflect in the returned array.
	 *
	 * @param {string} name
	 * @returns {Node[]}
	 */
	findNodesByName(name) {
		return this.nodes.filter((node) => node.name.name === name);
	}

	/**
	 * Return the last node in this document with the given name
	 *
	 * This function returns the last node instead of first to be in line with
	 * how properties are defined in the KDL specification where the last
	 * property with the given name is used and the rest is shadowed.
	 *
	 * @param {string} name
	 * @returns {Node | undefined}
	 */
	findNodeByName(name) {
		for (const node of reverseIterate(this.nodes)) {
			if (node.name.name === name) {
				return node;
			}
		}

		return undefined;
	}

	/**
	 * Return the last node in this document with the given name, matching the parameter
	 *
	 * If the parameter is `undefined`, this method looks for a node with any single
	 * arguments. If a parameter is passed, this method looks for a node with
	 * a single parameter, equal to the given parameter.
	 *
	 * @param {string} name
	 * @param {Value['value']} [parameter]
	 * @returns {Node | undefined}
	 */
	findParameterizedNode(name, parameter) {
		for (const node of reverseIterate(this.nodes)) {
			if (node.name.name !== name) {
				continue;
			}

			const args = node.getArguments();
			if (
				args.length !== 1 ||
				(parameter !== undefined && args[0] !== parameter)
			) {
				continue;
			}

			return node;
		}

		return undefined;
	}

	/**
	 * Remove all nodes with the given name from this document
	 *
	 * @param {string} name
	 * @returns {void}
	 */
	removeNodesByName(name) {
		this.nodes = this.nodes.filter((node) => node.name.name !== name);
	}

	/**
	 * Return whether the document is empty
	 *
	 * @returns {boolean}
	 */
	isEmpty() {
		return this.nodes.length === 0;
	}
}
