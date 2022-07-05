import {Document} from './document.js';
import {Entry} from './entry.js';
import {Identifier} from './identifier.js';
import {reverseIterate} from './utils.js';
import {Value} from './value.js';

/**
 * @param {Node} node
 */
function getOrCreateDocument(node) {
	return (node.children ??= new Document());
}

export class Node {
	/**
	 * Create a new node with the given name
	 *
	 * @param {string} name
	 * @returns {Node}
	 */
	static create(name) {
		return new Node(new Identifier(name));
	}

	/**
	 * @readonly
	 */
	type = 'node';

	/**
	 * @readonly
	 */
	static type = 'node';

	/**
	 * The name (also known as "tag name") of this node
	 *
	 * @type {Identifier}
	 */
	name;

	/**
	 * Tag attached to this value, if any
	 *
	 * @type {Identifier | null}
	 */
	tag = null;

	/**
	 * Entries of the node
	 *
	 * @type {Entry[]}
	 */
	entries;

	/**
	 * Children of the node
	 *
	 * An empty array means the children block is present but empty,
	 * if the value is `null` then there is no children block.
	 *
	 * @type {Document | null}
	 */
	children;

	/**
	 * Leading whitespace
	 *
	 * @type {string=}
	 */
	leading;

	/**
	 * Trailing whitespace
	 *
	 * @type {string=}
	 */
	trailing;

	/**
	 * Whitespace between the last entry and the children
	 *
	 * @type {string=}
	 */
	beforeChildren;

	/**
	 * @param {Identifier} name
	 * @param {Entry[]} [entries]
	 * @param {Document | null} [children]
	 */
	constructor(name, entries = [], children = null) {
		this.name = name;
		this.entries = entries;
		this.children = children;
	}

	/**
	 * Create an identical copy of this node
	 *
	 * @returns {Node}
	 */
	clone() {
		const clone = new Node(
			this.name.clone(),
			this.entries.map(entry => entry.clone()),
			this.children?.clone(),
		);
		clone.tag = this.tag?.clone() ?? null;

		clone.leading = this.leading;
		clone.beforeChildren = this.beforeChildren;
		clone.trailing = this.trailing;

		return clone;
	}

	/**
	 * Return the tag of this node, if any
	 *
	 * @returns {string | null}
	 */
	getTag() {
		return this.tag ? this.tag.name : null;
	}

	/**
	 * Set the tag of this node to the given tag
	 *
	 * @param {string | null | undefined} tag
	 */
	setTag(tag) {
		this.tag = tag != null ? new Identifier(tag) : null;
	}

	/**
	 * Return the name of this node
	 *
	 * @returns {string}
	 */
	getName() {
		return this.name.name;
	}

	/**
	 * Set the name of this node to the given name
	 *
	 * @param {string} name
	 */
	setName(name) {
		this.name = new Identifier(name);
	}

	/**
	 * Return whether this node has arguments
	 *
	 * @returns {boolean}
	 */
	hasArguments() {
		return this.entries.some(entry => entry.isArgument());
	}

	/**
	 * Return a snapshot of all arguments of this node
	 *
	 * Changes to the returned array are not reflected back onto this node
	 * itself, and updates to the node won't reflect in the returned array.
	 *
	 * @returns {Value['value'][]}
	 */
	getArguments() {
		return this.getArgumentEntries().map(entry => entry.getValue());
	}

	/**
	 * Return a snapshot of all arguments of this node
	 *
	 * Changes to the returned array are not reflected back onto this node
	 * itself, and updates to the node won't reflect in the returned array.
	 *
	 * @returns {Entry[]}
	 */
	getArgumentEntries() {
		return this.entries.filter(entry => entry.isArgument());
	}

	/**
	 * Return the value at the given index, if present
	 *
	 * This index counts towards the arguments only, i.e. if the node has five
	 * entries, three of which are arguments then passing `1` returns the second
	 * argument, regardless of the whether properties and arguments are
	 * interspersed or not.
	 *
	 * @param {number} index
	 * @returns {boolean}
	 */
	hasArgument(index) {
		for (const entry of this.entries) {
			if (!entry.isArgument()) {
				continue;
			}

			if (index === 0) {
				return true;
			}

			index--;
		}

		return false;
	}

	/**
	 * Return the argument at the given index, if present
	 *
	 * This index counts towards the arguments only, i.e. if the node has five
	 * entries, three of which are arguments then passing `1` returns the second
	 * argument, regardless of the whether properties and arguments are
	 * interspersed or not.
	 *
	 * @param {number} index
	 * @returns {Value['value'] | undefined}
	 */
	getArgument(index) {
		return this.getArgumentEntry(index)?.getValue();
	}

	/**
	 * Return the argument entry at the given index, if present
	 *
	 * This index counts towards the arguments only, i.e. if the node has five
	 * entries, three of which are arguments then passing `1` returns the second
	 * argument, regardless of the whether properties and arguments are
	 * interspersed or not.
	 *
	 * @param {number} index
	 * @returns {Entry | undefined}
	 */
	getArgumentEntry(index) {
		for (const entry of this.entries) {
			if (!entry.isArgument()) {
				continue;
			}

			if (index === 0) {
				return entry;
			}

			index--;
		}
	}

	/**
	 * Add the given value as argument to this node
	 *
	 * The argument is added at the given index, or at the end.
	 * This index counts towards the arguments only, i.e. if the node has five
	 * entries, three of which are arguments then inserting an argument between
	 * the second and third can be achieved by passing `2` regardless of the
	 * whether properties and arguments are interspersed or not.
	 *
	 * @param {Value['value']} value The value to insert as argument
	 * @param {string | null} [tag] The tag to attach to the argument, if any
	 * @param {number} [index] The index
	 */
	addArgument(value, tag, index) {
		const entry = Entry.createArgument(value);
		entry.setTag(tag);

		if (index != null) {
			for (const [i, entry] of this.entries.entries()) {
				if (!entry.isArgument()) {
					continue;
				}

				if (index === 0) {
					this.entries.splice(i, 0, entry);
					return;
				}

				index--;
			}
		}

		this.entries.push(entry);
	}

	/**
	 * Remove the argument at the given index
	 *
	 * The index counts towards the arguments only, i.e. if the node has five
	 * entries, three of which are arguments then the last argument can be
	 * removed by passing `2`, regardless of whether the third argument is also
	 * the third entry.
	 *
	 * @param {number} index
	 */
	removeArgument(index) {
		for (const [i, entry] of this.entries.entries()) {
			if (!entry.isArgument()) {
				continue;
			}

			if (index === 0) {
				this.entries.splice(i, 1);
				return;
			}

			index--;
		}
	}

	/**
	 * Return whether this node has properties
	 *
	 * @returns {boolean}
	 */
	hasProperties() {
		return this.entries.some(entry => entry.isProperty());
	}

	/**
	 * Return a snapshot of all properties of this node
	 *
	 * Changes to the returned array are not reflected back onto this node
	 * itself, and updates to the node won't reflect in the returned array.
	 *
	 * @returns {Map<string, Value['value']>}
	 */
	getProperties() {
		return new Map(
			this.getPropertyEntries().map(entry => [
				/** @type {string} */ (entry.getValue()),
				entry.getValue(),
			]),
		);
	}

	/**
	 * Return a snapshot of all properties of this node
	 *
	 * Changes to the returned array are not reflected back onto this node
	 * itself, and updates to the node won't reflect in the returned array.
	 *
	 * @returns {Entry[]}
	 */
	getPropertyEntries() {
		return this.entries.filter(entry => entry.isProperty());
	}

	/**
	 * Return whether this node has the given property
	 *
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasProperty(name) {
		return this.getPropertyEntry(name) != null;
	}

	/**
	 * Return the value of the property with the given name, or undefined
	 * if it doesn't exist.
	 *
	 * @param {string} name
	 * @returns {Value['value'] | undefined}
	 */
	getProperty(name) {
		return this.getPropertyEntry(name)?.getValue();
	}

	/**
	 * Return the property entry with the given name, or undefined if it doesn't
	 * exist.
	 *
	 * @param {string} name
	 * @returns {Entry | undefined}
	 */
	getPropertyEntry(name) {
		for (const entry of reverseIterate(this.entries)) {
			if (entry.getName() === name) {
				return entry;
			}
		}

		return undefined;
	}

	/**
	 * Set the given property on this node
	 *
	 * This function updates the property entry with the given name,
	 * if it exists.
	 *
	 * @param {string} name
	 * @param {Value['value']} value
	 * @param {string | null} [tag]
	 */
	setProperty(name, value, tag) {
		for (const entry of reverseIterate(this.entries)) {
			if (entry.getName() === name) {
				entry.setValue(value);
				entry.setTag(tag);
				return;
			}
		}

		const entry = Entry.createProperty(name, value);
		entry.setTag(tag);
		this.entries.push(entry);
	}

	/**
	 * Delete the property with the given name
	 *
	 * @param {string} name
	 */
	deleteProperty(name) {
		this.entries = this.entries.filter(entry => entry.getName() !== name);
	}

	/**
	 * Return whether this node has child nodes
	 *
	 * @returns {boolean}
	 */
	hasChildren() {
		return !this.children?.isEmpty();
	}

	/**
	 * Add the given node at the end of this node's children
	 *
	 * @param {Node | Document} node
	 */
	appendNode(node) {
		getOrCreateDocument(this).appendNode(node);
	}

	/**
	 * Insert the given node to the node's children before the referenceNode, or at the end if no reference is passed
	 *
	 * @param {Node | Document} newNode
	 * @param {Node | null} referenceNode
	 * @throws {Error} If the given referenceNode is not part of this node's children
	 */
	insertNodeBefore(newNode, referenceNode) {
		getOrCreateDocument(this).insertNodeBefore(newNode, referenceNode);
	}

	/**
	 * Insert the given node to the node's children after the referenceNode, or at the beginning if no reference is passed
	 *
	 * @param {Node | Document} newNode
	 * @param {Node | null} referenceNode
	 * @throws {Error} If the given referenceNode is not part of this document
	 */
	insertNodeAfter(newNode, referenceNode) {
		getOrCreateDocument(this).insertNodeAfter(newNode, referenceNode);
	}

	/**
	 * Remove the given node from this node's children
	 *
	 * @param {Node} node
	 * @throws {Error} if the given node is not in this node's children
	 */
	removeNode(node) {
		if (this.children == null) {
			throw new Error('Node to remove is not in document');
		}

		this.children.removeNode(node);
	}

	/**
	 * Replace the old node with the new node in this node's children
	 *
	 * @param {Node} oldNode
	 * @param {Node | Document} newNode
	 * @throws {Error} if the oldNode is not in this node's children
	 */
	replaceNode(oldNode, newNode) {
		if (this.children == null) {
			throw new Error('Node to remove is not in document');
		}

		this.children.replaceNode(oldNode, newNode);
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
		return this.children != null ? this.children.findNodesByName(name) : [];
	}

	/**
	 * Return the last node in this node's children with the given name
	 *
	 * This function returns the last node instead of first to be in line with
	 * how properties are defined in the KDL specification where the last
	 * property with the given name is used and the rest is shadowed.
	 *
	 * @param {string} name
	 * @returns {Node | undefined}
	 */
	findNodeByName(name) {
		return this.children?.findNodeByName(name);
	}

	/**
	 * Return the last node in this node's children with the given name, matching the parameter
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
		return this.children?.findParameterizedNode(name, parameter);
	}

	/**
	 * Remove all nodes with the given name from this document
	 *
	 * @param {string} name
	 * @returns {void}
	 */
	removeNodesByName(name) {
		this.children?.removeNodesByName(name);
	}
}
