/**
 * @typedef {object} Location
 * Location inside source text
 *
 * @property {number} startOffset Offset of the first character. 0-indexed.
 * @property {number} startLine Line of the first character. 1-indexed.
 * @property {number} startColumn Column of the first character of the Token. 1-indexed.
 * @property {number} endOffset Offset behind the last character. 0-indexed.
 * @property {number} endLine Line of the last character. 1-indexed.
 * @property {number} endColumn Column of the last character of the Token. 1-indexed.
 */

/**
 * @type {WeakMap<import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document, Location>}
 */
const locations = new WeakMap();

/**
 * Get location information of the given parsed element
 *
 * If the element was not created by the parser, or if the parser option `storeLocations`
 * was not set to `true`, the result will be undefined.
 *
 * @param {import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document} element
 * @returns {Location=}
 */
export function getLocation(element) {
	return locations.get(element);
}

/**
 * @param {import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document} element
 * @param {import('./parser/token.js').Token} start
 * @param {import('./parser/token.js').Token} end
 */
export function storeLocation(element, {start}, {end}) {
	locations.set(element, {
		startOffset: start.offset,
		startLine: start.line,
		startColumn: start.column,
		endOffset: end.offset,
		endLine: end.line,
		endColumn: end.column,
	});
}
