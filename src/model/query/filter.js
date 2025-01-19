/** @import { Node } from "../node.js"; */

/** @import { Matcher } from "./matcher.js"; */

export class Filter {
	/**
	 * @param {[Matcher, ...Matcher[]]} matchers
	 */
	constructor(matchers) {
		/**
		 * @type {[Matcher, ...Matcher[]]}
		 */
		this.matchers = matchers;
	}

	/** @param {Node} node */
	matches(node) {
		for (const matcher of this.matchers) {
			if (!matcher.matches(node)) {
				return false;
			}
		}

		return true;
	}
}
