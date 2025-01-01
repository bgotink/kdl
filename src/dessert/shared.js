/** @import { Node } from "../model.js"; */

/** @import {DeserializationContext} from "./deserialization/types.js" */

const kNode = /** #__PURE__ */ Symbol.for("@bgotink/kdl/dessert:node");

/**
 * @param {DeserializationContext} ctx
 * @param {Node} node
 */
export function storeNodeForContext(ctx, node) {
	/** @type {any} */ (ctx)[kNode] = node;
}

/**
 * @param {DeserializationContext} ctx
 * @returns {Node}
 */
export function getNodeForContext(ctx) {
	return /** @type {any} */ (ctx)[kNode];
}
