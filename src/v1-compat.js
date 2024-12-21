import {parse as parseV1} from "#v1";

import {
	Document,
	Entry,
	Identifier,
	Node,
	Tag,
	Value,
	format,
} from "./index.js";
import {reNewline, isValidBareIdentifier} from "./string-utils.js";

/**
 * @param {string | undefined} representation
 * @param {string} value
 */
function _mapStringRepresentation(representation, value) {
	if (!representation || representation === value) {
		// Currently a ident string, check if the string can still be an ident string in v2
		return isValidBareIdentifier(value) ? value : JSON.stringify(value);
	}

	if (representation.startsWith("r#")) {
		// Raw strings no longer have an r prefix, so r#"test"# becomes #"test"#
		representation = representation.slice(1);
	} else if (representation.startsWith('r"')) {
		// Raw strings no longer have an r prefix, so r"test" becomes #"test"#
		representation = `#${representation.slice(1)}#`;
	} else {
		representation = representation.replaceAll("\\/", "/");
	}

	// One edge case that's no longer supported in v2 with the introduction of triple-quote multiline strings
	if (representation === '#"""#') {
		return '"\\""';
	}

	if (!reNewline.test(representation)) {
		// Single line string -> we're done here!
		return representation;
	}

	// Multiline string, that's no longer allowed without triple-quotes.
	const numberOfHashes = representation.indexOf('"');
	const hashes = "#".repeat(numberOfHashes);
	return (
		hashes +
		'"""\n' +
		representation.slice(numberOfHashes + 1, -(numberOfHashes + 1)) +
		'\n"""' +
		hashes
	);
}

/**
 * @param {import("#v1").Identifier} identifier
 * @returns {Identifier}
 */
function mapIdentifierWithFormatting(identifier) {
	const result = new Identifier(identifier.name);

	result.representation = _mapStringRepresentation(
		identifier.representation,
		identifier.name,
	);

	return result;
}

/**
 * @param {import("#v1").Identifier} identifier
 * @returns {Identifier}
 */
function mapIdentifier(identifier) {
	return new Identifier(identifier.name);
}

/**
 * @param {import("#v1").Identifier} identifier
 * @returns {Tag}
 */
function mapTagWithFormatting(identifier) {
	const result = new Tag(identifier.name);

	result.representation = _mapStringRepresentation(
		identifier.representation,
		identifier.name,
	);

	return result;
}

/**
 * @param {import("#v1").Identifier} identifier
 * @returns {Tag}
 */
function mapTag(identifier) {
	return new Tag(identifier.name);
}

/**
 * @param {import("#v1").Value} value
 * @returns {Value}
 */
function mapValueWithFormatting(value) {
	const result = new Value(value.value);

	if (typeof result.value === "boolean" || result.value === null) {
		result.representation = `#${result.value}`;
	} else if (typeof value.value === "string") {
		result.representation = _mapStringRepresentation(
			value.representation,
			value.value,
		);
	} else {
		result.representation = value.representation;
	}

	return result;
}

/**
 * @param {import("#v1").Value} value
 * @returns {Value}
 */
function mapValue(value) {
	return new Value(value.value);
}

/**
 * @param {import("#v1").Entry} entry
 * @returns {Entry}
 */
function mapEntryWithFormatting(entry) {
	const result = new Entry(
		mapValueWithFormatting(entry.value),
		entry.name && mapIdentifierWithFormatting(entry.name),
	);

	result.tag = entry.tag && mapTagWithFormatting(entry.tag);

	result.equals = entry.name ? "=" : undefined;

	result.leading = mapWhitespaceInNode(entry.leading);
	result.trailing = mapWhitespaceInNode(entry.trailing);

	return result;
}

/**
 * @param {import("#v1").Entry} entry
 * @returns {Entry}
 */
function mapEntry(entry) {
	const result = new Entry(
		mapValue(entry.value),
		entry.name && mapIdentifier(entry.name),
	);

	result.tag = entry.tag && mapTag(entry.tag);

	return result;
}

/**
 * @param {import("#v1").Node} node
 * @returns {Node}
 */
function mapNodeWithFormatting(node) {
	const result = new Node(mapIdentifierWithFormatting(node.name));

	result.tag = node.tag && mapTagWithFormatting(node.tag);

	result.entries = node.entries.map((entry) => mapEntryWithFormatting(entry));

	result.leading = mapWhitespaceInDocument(node.leading);
	result.beforeChildren = mapWhitespaceInNode(node.beforeChildren);
	result.children = node.children && mapDocumentWithFormatting(node.children);

	// node.trailing contains not just trailing whitespace but also the node terminator

	let trailing = node.trailing;
	if (trailing != null) {
		let terminator = "";

		if (trailing?.endsWith(";")) {
			terminator = ";";
			trailing = trailing.slice(0, -1);
		} else if (reNewline.test(trailing.slice(-1))) {
			// \r\n is a single newline
			if (trailing.slice(-2) === "\r\n") {
				terminator = "\r\n";
				trailing = trailing.slice(0, -2);
			} else {
				terminator = trailing.slice(-1);
				trailing = trailing.slice(0, -1);
			}
		}

		result.trailing = (trailing && mapWhitespaceInNode(trailing)) + terminator;
	}

	return result;
}

/**
 * @param {import("#v1").Node} node
 * @returns {Node}
 */
function mapNode(node) {
	const result = new Node(mapIdentifier(node.name));

	result.tag = node.tag && mapTag(node.tag);

	result.entries = node.entries.map((entry) => mapEntry(entry));
	result.children =
		node.children?.nodes.length ? mapDocument(node.children) : null;

	return result;
}

/**
 * @param {import("#v1").Document} document
 * @returns {Document}
 */
function mapDocumentWithFormatting(document) {
	const result = new Document(
		document.nodes.map((node) => mapNodeWithFormatting(node)),
	);

	result.trailing = mapWhitespaceInDocument(document.trailing);

	return result;
}

/**
 * @param {import("#v1").Document} document
 * @returns {Document}
 */
function mapDocument(document) {
	return new Document(document.nodes.map((node) => mapNode(node)));
}

/**
 * @param {string=} whitespace
 * @returns {string=}
 */
function mapWhitespaceInNode(whitespace) {
	if (!whitespace?.includes("/-")) {
		return whitespace;
	}

	return parseV1(whitespace, {as: "whitespace in node"})
		.map((part) => {
			if (part.type !== "slashdash") {
				return part.content;
			}

			if (!part.content.endsWith("}")) {
				return `/-${format(mapEntryWithFormatting(parseV1(part.content.slice(2), {as: "entry"})))}`;
			}

			const startOfChildren = part.content.indexOf("{") + 1;

			return (
				part.content.slice(0, startOfChildren) +
				format(parseAndTransform(part.content.slice(startOfChildren, -1))) +
				"}"
			);
		})
		.join("");
}
/**
 * @param {string=} whitespace
 * @returns {string=}
 */
function mapWhitespaceInDocument(whitespace) {
	if (!whitespace?.includes("/-")) {
		return whitespace;
	}

	return parseV1(whitespace, {as: "whitespace in document"})
		.map((part) => {
			if (part.type !== "slashdash") {
				return part.content;
			}

			const node = parseV1(part.content.slice(2), {as: "node"});
			return `/-${format(mapNodeWithFormatting(node))}`;
		})
		.join("");
}

/**
 * Parse the given KDL v1 text as document without storing any formatting information
 *
 * {@link format Formatting} the given document will result in a KDL v2 text
 * which represents the same document as the original KDL v1 text but where all
 * comments, whitespace, etc. is removed and standardized.
 * If you want to format the document to transform the given KDL v1 text into
 * KDL v2 text, use {@link parseAndTransform} instead.
 *
 * This function incurs significant overhead, as it loads a parser for KDL v1.
 * This parser is an order of magnitude larger and slower than the v2 parser,
 * so programs implementing compatibility with both KDL v2 and v1 are
 * encouraged to lazy load this compat function only when the KDL document
 * fails to parse as KDL v2.
 *
 * @see {@link parseAndTransform}
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @returns {Document}
 */
export function parseWithoutFormatting(text) {
	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	return mapDocument(parseV1(text));
}

/**
 * Parse the given KDL v1 text and turn it into a KDL v2 document
 *
 * {@link format Formatting} the given document will result in a KDL v2 text
 * equivalent to the original KDL v1 text.
 *
 * This function is designed to be used to transform a KDL v1 document into an
 * equivalent KDL v2 document. If that's not the intention, callers are
 * encouraged to use {@link parseWithoutFormatting} instead
 *
 * This function incurs significant overhead, as it loads a parser for KDL v1.
 * This parser is an order of magnitude larger and slower than the v2 parser,
 * so programs implementing compatibility with both KDL v2 and v1 are
 * encouraged to lazy load this compat function only when the KDL document
 * fails to parse as KDL v2.
 *
 * @see {@link parseWithoutFormatting}
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @returns {Document}
 */
export function parseAndTransform(text) {
	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	return mapDocumentWithFormatting(parseV1(text));
}
