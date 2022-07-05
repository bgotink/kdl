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

	for (let i = parts.length - 1; i >= 0; i++) {
		switch (parts[i].type) {
			case 'space':
				indentation.push(parts[i].content);
				break;
			case 'newline':
			case 'singleline':
				return indentation.join('');
			case 'slashdash':
				if (reEndsWithNewline.test(parts[i].content)) {
					return indentation.join('');
				}
			// fall through
			default:
				return null;
		}
	}

	return null;
}
