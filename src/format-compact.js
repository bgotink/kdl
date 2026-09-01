import {InvalidKdlError} from "./index.js";
import {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";
import {stringifyString} from "./string-utils.js";

/**
 * @param {Tag | null} tag
 * @returns {string}
 */
function formatTag(tag) {
	if (tag == null) {
		return "";
	}

	return `(${stringifyString(tag.name)})`;
}

/**
 * @param {Value} value
 * @returns {string}
 */
function formatValue(value) {
	let representation;
	if (typeof value.value === "boolean" || value.value === null) {
		representation = `#${value.value}`;
	} else if (typeof value.value === "string") {
		representation = stringifyString(value.value);
	} else {
		if (Number.isNaN(value.value)) {
			representation = "#nan";
		} else if (!Number.isFinite(value.value)) {
			representation = value.value > 0 ? "#inf" : "#-inf";
		} else {
			representation = String(value.value);
			const indexE = representation.indexOf("e");
			if (indexE !== -1) {
				const exponent = Number.parseInt(representation.slice(indexE + 1), 10);
				if (exponent < 0) {
					// We need to shift the dot `-exponent` times to the left, and we know
					// the dot is after the first digit so we need `-exponent - 1` zeros.
					// - All comments are removed
					// - All whitespace is removed except for a single space before every entry, nNodes in a document are separated using `;`
					// - Empty children `{}` are removed
					// We don't need to check if the part before the exponent is longer
					// than 1 character, since .slice(2, 1) will return an empty string.
					representation =
						"0." +
						"0".repeat(-exponent - 1) +
						representation[0] +
						representation.slice(2, indexE);
				} else {
					// If we accepted any exponential notation numbers we'd need to check
					// whether the exponent is large enough to result in an integer, i.e.
					// is the number of digits after the decimal point larger or smaller
					// than the exponent?
					// We don't have to consider ALL exponential notation numbers though,
					// the JS spec only uses exponential notation for exponents 21 and up
					// and IEEE 752 64-bit floating points aren't specific enough for this
					// to ever lead to a decimal number.
					// In other words: we know exponent > (indexE - 2)
					representation =
						representation[0] +
						representation.slice(2, indexE) +
						"0".repeat(exponent - (indexE >= 2 ? indexE - 2 : 0));
				}
			}
		}
	}

	return formatTag(value.tag) + representation;
}

/**
 * @param {Pick<Identifier, 'name'>} identifier
 * @returns {string}
 */
function formatIdentifier(identifier) {
	return stringifyString(identifier.name);
}

/**
 * @param {Entry} entry
 * @returns {string}
 */
function formatEntry(entry) {
	return ` ${
		entry.name ? `${formatIdentifier(entry.name)}=` : ""
	}${formatValue(entry.value)}`;
}

/**
 * @param {Node} node
 * @returns {string}
 */
function formatNode(node) {
	const properties = node.getPropertyEntryMap();
	const args = node.getArgumentEntries();

	const entries = [
		...Array.from(properties)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, entry]) => entry),
		...args,
	];

	return `${formatTag(node.tag)}${formatIdentifier(node.name)}${entries
		.map((entry) => formatEntry(entry))
		.join("")}${
		node.children?.nodes.length ? `{${formatDocument(node.children)}}` : ""
	}`;
}

/**
 * @param {Document} document
 * @returns {string}
 */
function formatDocument(document) {
	return document.nodes.map(formatNode).join(";");
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
 * Returns a compact formatting of the given KDL value.
 *
 * Compact values are defined as follows:
 *
 * - All strings and identifiers are normalized to identifier notation, falling back to single-line regular (i.e. non-raw) strings for strings that cannot be represented as identifier
 * - Numbers are normalized to decimal notation with leading zeros and trailing decimal zeros removed
 * - All comments are removed
 * - All whitespace is removed except for a single space before every entry, nodes in a document are separated using `;`
 * - Empty children `{}` are removed
 * - Entries are sorted: properties before arguments, properties are sorted alphabetically by key
 *
 * @param {Value | Identifier | Tag | Entry | Node | Document} v
 * @returns {string}
 */
export function formatCompact(v) {
	const formatter = formatters.get(v.type);
	if (formatter == null) {
		throw new InvalidKdlError(`Cannot format non-KDL ${v}`);
	}

	return formatter(v, 0);
}
