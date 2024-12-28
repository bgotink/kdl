/** @import {Document, Entry, Identifier, Node, Tag, Value} from "./model.js" */
/** @import {Token, Location} from "./parser/token.js" */

/**
 * @typedef {object} StoredLocation
 * Stored location of a {@link Document}, {@link Entry}, {@link Identifier}, {@link Node}, {@link Tag}, or {@link Value}.
 *
 * @prop {Location} start The location of the first character
 * @prop {Location} end The location after the last character
 */

/**
 * @type {WeakMap<Value | Identifier | Tag | Entry | Node | Document, StoredLocation>}
 */
const locations = new WeakMap();

/**
 * Get location information of the given parsed element
 *
 * If the element was not created by the parser, or if the parser option `storeLocations`
 * was not set to `true`, the result will be undefined.
 *
 * @param {Value | Identifier | Tag | Entry | Node | Document} element
 * @returns {StoredLocation=}
 */
export function getLocation(element) {
	return locations.get(element);
}

/**
 * @param {Value | Identifier | Tag | Entry | Node | Document} element
 * @param {Token} start
 * @param {Token} end
 */
export function storeLocation(element, {start}, {end}) {
	locations.set(element, {start, end});
}
