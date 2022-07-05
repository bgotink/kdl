import {reverseIterate} from './model/utils.js';
import {parse} from './parse.js';
import {reEndsWithNewline} from './tokens/whitespace.js';

/**
 * Get the indentation of this node
 *
 * @param {import('./model.js').Node} node
 * @returns {string | null} The indentation, or null if it cannot be found
 */
export function getIndentation(node) {
	if (node.leading == null) {
		return null;
	}

	if (node.leading === '') {
		return node.leading;
	}

	const parts = parse(node.leading, {as: 'whitespace in document'});
	/** @type {string[]} */
	const indentation = [];

	for (const part of reverseIterate(parts)) {
		switch (part.type) {
			case 'space':
				indentation.push(part.content);
				break;
			case 'newline':
			case 'singleline':
				return indentation.join('');
			case 'slashdash':
				if (reEndsWithNewline.test(part.content)) {
					return indentation.join('');
				}
			// fall through
			default:
				return null;
		}
	}

	return null;
}
