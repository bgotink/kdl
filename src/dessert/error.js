/** @import {Node, Entry} from "../index.js" */

/**
 * Error thrown if deserialization fails
 */
export class KdlDeserializeError extends Error {
	/** @hidden */
	name = "KdlDeserializeError";

	/**
	 * Location at which the error occured
	 *
	 * @type {Node | Entry}
	 */
	location;

	/**
	 * @param {string} message
	 * @param {ErrorOptions & {location: Node | Entry}} options
	 */
	constructor(message, {location, ...options}) {
		super(message, options);

		this.location = location;
	}
}
