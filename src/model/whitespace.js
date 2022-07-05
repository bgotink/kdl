export class Whitespace {
	/**
	 * The type of the content
	 *
	 * A `newline` is a character or character sequence that represents the end
	 * of a line.
	 *
	 * A `space` is any whitespace that isn't considered `newline`. This implies
	 * that a `space` Whitespace is always single-line.
	 *
	 * A `line-escape` is a single backslash, which makes the next `newline`
	 * (including at the end of a comment) count as a `space` when it comes to
	 * looking for the end of a node.
	 *
	 * @type {'newline' | 'space' | 'line-escape'}
	 * @readonly
	 */
	type;

	/**
	 * The raw content of the whitespace
	 *
	 * @type {string}
	 * @readonly
	 */
	content;

	/**
	 * @internal
	 * @param {'newline' | 'space' | 'line-escape'} type
	 * @param {string} content
	 */
	constructor(type, content) {
		this.type = type;
		this.content = content;
	}
}

export class Comment {
	/**
	 * The content of the comment, including any comment characters like `//`,
	 * `/*`, or `/-`
	 *
	 * @type {string}
	 * @readonly
	 */
	content;

	/**
	 * @internal
	 * @param {string} content
	 */
	constructor(content) {
		this.content = content;
	}

	/**
	 * The type of the content
	 *
	 * A multiline comment starts with `/*` and ends with an asterisk followed by
	 * a forward slash.
	 *
	 * A singleline comment starts with `//` and ends with a newline (which is
	 * included in the comment!) or the end of the file
	 *
	 * A slashdash comment starts with `/-` followed by a commented entry, node,
	 * or children block. In case of a commented node, the comment ends at the
	 * first newline, or the first `;`, or the end of the file; whichever comes
	 * first.
	 *
	 * @type {'multiline' | 'singleline' | 'slashdash'}
	 */
	get type() {
		switch (this.content[1]) {
			case '*':
				return 'multiline';
			case '/':
				return 'singleline';
			case '-':
				return 'slashdash';
			default:
				throw new Error('Invalid comment content');
		}
	}
}
