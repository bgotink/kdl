import {InvalidKdlError} from "./index.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";
import {stringifyString} from "./string-utils.js";

const reStartsWithInlineWhitespace =
	/^[\uFEFF\u0009\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/;

/**
 * @param {Tag | null} tag
 * @returns {string}
 */
function formatTag(tag) {
	if (tag == null) {
		return "";
	}

	let representation;
	if (tag.representation?.[0] === "#") {
		// This was a suffix tag but is now used where a suffix is not allowed,
		// so force reformat
		representation = stringifyString(tag.name);
	} else {
		representation = formatIdentifier(tag);
	}

	return `(${tag.leading ?? ""}${representation}${tag.trailing ?? ""})`;
}

/**
 * @param {string} valueRepresentation
 * @param {Tag} tag
 * @returns {string?}
 */
function formatTagAsSuffix(valueRepresentation, tag) {
	let representation = tag.representation;
	if (!representation) {
		representation = stringifyString(tag.name);
	}

	if (
		representation[0] === '"' ||
		(representation.startsWith("#") && representation.endsWith("#"))
	) {
		// only bare identifiers are allowed as suffix
		return null;
	}

	let useHash = false;

	if (representation?.[0] === "#") {
		useHash = true;
		representation = representation.slice(1);
	}

	if (!useHash) {
		useHash =
			valueRepresentation.startsWith("0b") ||
			valueRepresentation.startsWith("0o") ||
			valueRepresentation.startsWith("0x") ||
			/^[,._]|^[a-zA-Z][0-9_]|^[eE][+-][0-9_]|[xX][a-fA-F]/.test(
				representation,
			);
	}

	return useHash ? "#" + representation : representation;
}

/**
 * @param {string=} text
 * @returns {string}
 */
function ensureStartsWithWhitespace(text) {
	if (text == null) {
		return " ";
	}

	return reStartsWithInlineWhitespace.test(text) || text.startsWith("\\") ?
			text
		:	` ${text}`;
}

/**
 * @param {Value} value
 * @returns {string}
 */
function formatValue(value) {
	let representation = value.representation;

	if (representation == null) {
		if (typeof value.value === "boolean" || value.value === null) {
			representation = `#${value.value}`;
		} else if (typeof value.value === "string") {
			representation = stringifyString(value.value);
		} else if (typeof value.value === "number") {
			if (Number.isNaN(value.value)) {
				representation = "#nan";
			} else if (!Number.isFinite(value.value)) {
				representation = value.value > 0 ? "#inf" : "#-inf";
			}
		}
	}

	if (representation == null) {
		representation = JSON.stringify(value.value);
	}

	if (
		value.tag?.suffix &&
		typeof value.value === "number" &&
		representation[0] !== "#"
	) {
		// A tag can be shown as suffix on numbers (but not on the few keyword numbers)
		const tagRepresentation = formatTagAsSuffix(representation, value.tag);
		if (tagRepresentation) {
			return representation + tagRepresentation;
		}
	}

	return (
		(value.tag ? formatTag(value.tag) + (value.betweenTagAndValue ?? "") : "") +
		representation
	);
}

/**
 * @param {Pick<Identifier, 'name' | 'representation'>} identifier
 * @returns {string}
 */
function formatIdentifier(identifier) {
	if (identifier.representation != null) {
		return identifier.representation;
	}

	return stringifyString(identifier.name);
}

/**
 * @param {Entry} entry
 * @returns {string}
 */
function formatEntry(entry) {
	return `${ensureStartsWithWhitespace(entry.leading)}${
		entry.name ? `${formatIdentifier(entry.name)}${entry.equals ?? "="}` : ""
	}${formatValue(entry.value)}${entry.trailing ?? ""}`;
}

/**
 * @param {Node} node
 * @param {number} indentation
 * @returns {string}
 */
function formatNode(node, indentation) {
	return `${node.leading ?? "\t".repeat(indentation)}${formatTag(node.tag)}${
		node.betweenTagAndName ?? ""
	}${formatIdentifier(node.name)}${node.entries
		.map((entry) => formatEntry(entry))
		.join("")}${
		node.children ?
			`${node.beforeChildren ?? " "}{${formatDocument(
				node.children,
				indentation + 1,
			)}}`
		:	""
	}${node.trailing ?? "\n"}`;
}

/**
 * @param {Document} document
 * @param {number} indentation
 * @returns {string}
 */
function formatDocument(document, indentation) {
	return `${
		(
			document.nodes[0] != null &&
			document.nodes[0].leading == null &&
			indentation
		) ?
			"\n"
		:	""
	}${document.nodes.map((node) => formatNode(node, indentation)).join("")}${
		document.trailing ?? "\t".repeat((indentation || 1) - 1)
	}`;
}

const formatters = new Map(
	/** @type {[string, (value: any, indentation: number) => string][]} */ ([
		[Value.type, formatValue],
		[Identifier.type, formatIdentifier],
		[Tag.type, formatTag],
		[Entry.type, formatEntry],
		[Node.type, formatNode],
		[Document.type, formatDocument],
	]),
);

/**
 * @param {Value | Identifier | Tag | Entry | Node | Document} v
 * @returns {string}
 */
export function format(v) {
	const formatter = formatters.get(v.type);
	if (formatter == null) {
		throw new InvalidKdlError(`Cannot format non-KDL ${v}`);
	}

	return formatter(v, 0);
}
