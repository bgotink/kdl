import {
	Document,
	Entry,
	Node,
	parse as parseKdl,
	format as formatKdl,
} from "./index.js";
import {
	InvalidJsonInKdlError,
	nodeToJsonValue,
	fromJsonValue,
} from "./json-impl.js";
/** @import { ToJsonOptions } from './json-impl.js'; */

const arrayItemKey = "-";

export {InvalidJsonInKdlError};

/**
 * @param {Node | Document} nodeOrDocument
 * @param {ToJsonOptions} [options]
 */
export function toJson(nodeOrDocument, options) {
	let node;
	if (nodeOrDocument.type === "node") {
		node = nodeOrDocument;
	} else {
		if (nodeOrDocument.nodes.length !== 1) {
			throw new InvalidJsonInKdlError(
				"JSON-in-KDL requires a single node in the document",
			);
		}

		node = nodeOrDocument.nodes[0];
	}

	const value = nodeToJsonValue(node, options);
	if (options?.reviver != null) {
		return options.reviver(value, "", {location: node});
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
	if (typeof indentationStep === "string") {
		indentationStep = indentationStep;
	} else if (typeof indentationStep === "number" && indentationStep > 0) {
		indentationStep = " ".repeat(indentationStep);
	} else {
		indentationStep = "";
	}

	const result = /** @type {Node} */ (
		fromJsonValue(value, "", true, {
			nodeName,
			allowEntriesInArrays,
			allowEntriesInObjects,
			allowEntriesInCurrent: allowEntriesInRoot,
			replaceJsonValue,
			replaceKdlValue,
		})
	);

	applyIndentation(result, indentationStep);

	return result;
}

/**
 * @param {Node} root
 * @param {string} indentationStep
 */
function applyIndentation(root, indentationStep) {
	root.leading = "";
	root.trailing = "";

	let indentation = "";
	const trailing = indentationStep ? "\n" : ";";
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
 * @param {(value: unknown, key: string | number, data: {location: Node | Entry}) => unknown} [reviver]
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

	if (typeof replacer === "function") {
		replaceJsonValue = replacer;
	} else if (typeof replacer === "object" && replacer != null) {
		({replaceJsonValue, replaceKdlValue, indentation} = replacer);
	}

	return formatKdl(
		fromJson(value, {indentation, replaceJsonValue, replaceKdlValue}),
	);
}
