import {InvalidKdlError} from './index.js';
import {Document, Entry, Identifier, kKind, Node, Value} from './model.js';
import {plainIdentifierRe} from './tokens/identifier.js';
import {reInlineWhitespace} from './tokens/whitespace.js';

/**
 * @param {Identifier | null} tag
 * @returns {string}
 */
function formatTag(tag) {
	if (tag == null) {
		return '';
	}

	return `(${formatIdentifier(tag)})`;
}

/**
 * @param {string=} text
 * @returns {string}
 */
function ensureStartsWithWhitespace(text) {
	if (text == null) {
		return ' ';
	}

	return reInlineWhitespace.exec(text)?.index === 0 ? text : ` ${text}`;
}

/**
 * @param {Value} value
 * @returns {string}
 */
function formatValue(value) {
	return value.representation ?? JSON.stringify(value.value);
}

/**
 * @param {Identifier} identifier
 * @returns {string}
 */
function formatIdentifier(identifier) {
	if (identifier.representation != null) {
		return identifier.representation;
	}

	const plainMatch = plainIdentifierRe.exec(identifier.name);
	if (plainMatch && plainMatch[0].length === plainMatch.input.length) {
		return identifier.name;
	}

	return JSON.stringify(identifier.name);
}

/**
 * @param {Entry} entry
 * @returns {string}
 */
function formatEntry(entry) {
	return `${ensureStartsWithWhitespace(entry.leading)}${
		entry.name ? `${formatIdentifier(entry.name)}=` : ''
	}${formatTag(entry.tag)}${formatValue(entry.value)}${entry.trailing ?? ''}`;
}

/**
 * @param {Node} node
 * @param {number} indentation
 * @returns {string}
 */
function formatNode(node, indentation) {
	return `${node.leading ?? '\t'.repeat(indentation)}${formatTag(
		node.tag,
	)}${formatIdentifier(node.name)}${node.entries
		.map(entry => formatEntry(entry))
		.join('')}${
		node.children
			? `${ensureStartsWithWhitespace(node.beforeChildren)}{${formatDocument(
					node.children,
					indentation + 1,
			  )}}`
			: ''
	}${node.trailing ?? '\n'}`;
}

/**
 * @param {Document} document
 * @param {number} indentation
 * @returns {string}
 */
function formatDocument(document, indentation) {
	return `${document.leading ?? (indentation ? '\n' : '')}${document.nodes
		.map(node => formatNode(node, indentation))
		.join('')}${document.trailing ?? '\t'.repeat((indentation || 1) - 1)}`;
}

const formatters = new Map(
	/** @type {[string, (value: any, indentation: number) => string][]} */ ([
		[Value[kKind], formatValue],
		[Identifier[kKind], formatIdentifier],
		[Entry[kKind], formatEntry],
		[Node[kKind], formatNode],
		[Document[kKind], formatDocument],
	]),
);

/**
 * @param {Value | Identifier | Entry | Node | Document} v
 * @returns {string}
 */
export function format(v) {
	const formatter = formatters.get(v[kKind]);
	if (formatter == null) {
		throw new InvalidKdlError(`Cannot format non-KDL ${v}`);
	}

	return formatter(v, 0);
}
