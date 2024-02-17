/**
 * Location inside source text
 *
 * @typedef {object} Location
 * @property {number} startOffset Offset of the first character. 0-indexed.
 * @property {number=} startLine Line of the first character. 1-indexed.
 * @property {number=} startColumn Column of the first character of the Token. 1-indexed.
 * @property {number} endOffset Offset behind the last character. 0-indexed.
 * @property {number=} endLine Line of the last character. 1-indexed.
 * @property {number=} endColumn Column of the last character of the Token. 1-indexed.
 */

/**
 * @type {WeakMap<import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document, Location>}
 */
const locations = new WeakMap();

/**
 * @param {import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document} element
 * @returns {Location=}
 */
export function getLocation(element) {
	return locations.get(element);
}

/**
 * @param {import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Tag | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document} element
 * @param {Location} location
 */
export function storeLocation(element, location) {
	locations.set(element, location);
}
