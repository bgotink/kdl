import {InvalidKdlError} from "./index.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";

/**
 * @param {Value} value
 */
function clearFormatValue(value) {
	value.representation = undefined;
	value.betweenTagAndValue = undefined;

	if (value.tag) {
		clearFormatTag(value.tag);
	}
}

/**
 * @param {Identifier} identifier
 * @returns {void}
 */
function clearFormatIdentifier(identifier) {
	identifier.representation = undefined;
}

/**
 * @param {Tag} tag
 * @returns {void}
 */
function clearFormatTag(tag) {
	tag.leading = undefined;
	tag.trailing = undefined;

	tag.representation = undefined;
	tag.suffix = undefined;
}

/**
 * @param {Entry} entry
 * @returns {void}
 */
function clearFormatEntry(entry) {
	entry.leading = undefined;
	entry.equals = undefined;
	entry.trailing = undefined;

	clearFormatValue(entry.value);
	if (entry.name) {
		clearFormatIdentifier(entry.name);
	}
}

/**
 * @param {Node} node
 * @returns {void}
 */
function clearFormatNode(node) {
	node.leading = undefined;
	node.beforeChildren = undefined;
	node.betweenTagAndName = undefined;
	node.trailing = undefined;

	if (node.tag) {
		clearFormatTag(node.tag);
	}
	clearFormatIdentifier(node.name);

	/** @type {Entry[]} */
	const args = [];
	/** @type {Map<string, Entry>} */
	const properties = new Map();

	for (const entry of node.entries) {
		clearFormatEntry(entry);

		if (entry.name == null) {
			args.push(entry);
		} else {
			properties.set(entry.name.name, entry);
		}
	}

	node.entries = [
		...args,
		...Array.from(properties.keys())
			.sort()
			.map((key) => /** @type {Entry} */ (properties.get(key))),
	];

	if (node.children?.nodes.length) {
		clearFormatDocument(node.children);
	} else {
		node.children = null;
	}
}

/**
 * @param {Document} document
 * @returns {void}
 */
function clearFormatDocument(document) {
	document.trailing = undefined;

	for (const node of document.nodes) {
		clearFormatNode(node);
	}
}

const clearFormatters = new Map(
	/** @type {[string, (value: any) => void][]} */ ([
		[Value.type, clearFormatValue],
		[Identifier.type, clearFormatIdentifier],
		[Tag.type, clearFormatTag],
		[Entry.type, clearFormatEntry],
		[Node.type, clearFormatNode],
		[Document.type, clearFormatDocument],
	]),
);

/**
 * @template {Value | Identifier | Tag | Entry | Node | Document} T
 * @param {T} v
 * @returns {T}
 */
export function clearFormat(v) {
	const clearFormatter = clearFormatters.get(v.type);
	if (clearFormatter == null) {
		throw new InvalidKdlError(`Cannot clear formatting on non-KDL ${v}`);
	}

	clearFormatter(v);
	return v;
}
