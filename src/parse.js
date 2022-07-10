import {KdlLexer, KdlParser} from './parser.js';

const lexer = new KdlLexer();
const parser = new KdlParser();

export class InvalidKdlError extends Error {
	/** @param {string} message */
	constructor(message) {
		super(message);

		this.name = 'InvalidKdlError';
	}
}

/**
 * @param {object} offset
 * @param {number} [offset.line]
 * @param {number} [offset.column]
 * @param {number} offset.offset
 */
function stringifyOffset(offset) {
	if (offset.line != null && offset.column != null) {
		return `${offset.line}:${offset.column}`;
	} else if (offset.line != null) {
		return `${offset.line}`;
	}

	return `${offset.offset}`;
}

/**
 * @param {object} offset
 * @param {number} [offset.startLine]
 * @param {number} [offset.startColumn]
 * @param {number} offset.startOffset
 */
function stringifyTokenOffset(offset) {
	if (offset.startLine != null && offset.startColumn != null) {
		return `${offset.startLine}:${offset.startColumn}`;
	} else if (offset.startLine != null) {
		return `${offset.startLine}`;
	}

	return `${offset.startOffset}`;
}

const methods = /** @type {const} */ ({
	value: parser.value,
	identifier: parser.identifier,
	node: parser.nodeWithSpace,
	entry: parser.entryWithSpace,
	document: parser.document,
	['whitespace in node']: parser.whiteSpacePartsInNode,
	['whitespace in document']: parser.whiteSpacePartsInDocument,
});

/**
 * @param {string} text
 * @param {object} [options]
 * @param {keyof typeof methods} [options.as]
 * @param {boolean} [options.storeLocations]
 */
export function parse(text, {as = 'document', storeLocations = false} = {}) {
	/**
	 * @type {import('chevrotain').ParserMethod<[], import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document | (import('./model.js').Comment | import('./model.js').Whitespace)[]>}
	 */
	const parserMethod = methods[as];
	if (parserMethod == null) {
		throw new TypeError(`Invalid "as" target passed: ${JSON.stringify(as)}`);
	}

	const {tokens, errors} = lexer.tokenize(text);

	if (errors.length === 1) {
		const [error] = errors;
		throw new InvalidKdlError(
			`Failed to parse KDL ${as}, ${error.message} at ${stringifyOffset(
				error,
			)}`,
		);
	} else if (errors.length > 0) {
		throw new InvalidKdlError(
			`Failed to parse KDL ${as} due to multiple errors:\n${errors
				.map(error => `- ${error.message} at ${stringifyOffset(error)}`)
				.join('\n')}`,
		);
	}

	// console.log(tokens.map(t => ({name: t.tokenType.name, content: t.image})));
	parser.input = tokens;
	parser.storeLocationInfo = storeLocations;
	const document = parserMethod.call(parser);

	if (parser.errors.length === 1) {
		const [error] = parser.errors;
		// console.log(error);
		throw new InvalidKdlError(
			`Failed to parse KDL ${as}, ${error.message} at ${stringifyTokenOffset(
				error.token,
			)}`,
		);
	} else if (parser.errors.length > 0) {
		throw new InvalidKdlError(
			`Failed to parse KDL ${as} due to multiple errors:\n${parser.errors
				.map(
					error => `- ${error.message} at ${stringifyTokenOffset(error.token)}`,
				)
				.join('\n')}`,
		);
	}

	return document;
}
