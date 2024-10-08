import {Document} from "./document.js";
import {Entry} from "./entry.js";
import {Node} from "./node.js";

/**
 * A Byte-Order Mark at the start of a document
 */
export interface BOM {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "bom";

	/**
	 * The BOM text, i.e. `'\ufeff'`.
	 */
	text: string;
}

/**
 * Regular plain old whitespace characters
 */
export interface InlineWhitespace {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "space";

	/**
	 * The whitespace's text
	 */
	text: string;
}

/**
 * A single newline
 *
 * Note a newline can consist of multiple characters: `\r\n` is a single newline.
 */
export interface Newline {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "newline";

	/**
	 * The newline
	 */
	text: string;
}

/**
 * An escaped newline
 */
export interface EscLine {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "line-escape";

	/**
	 * The escaped newline
	 */
	text: string;
}

/**
 * A multiline comment
 */
export interface MultilineComment {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "multiline";

	/**
	 * The comment text, including the comment tokens themselves
	 */
	text: string;
}

/**
 * A single-line comment
 */
export interface SingleLineComment {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "singleline";

	/**
	 * The comment's text, starting at the `//` and ending with a newline unless the comment ended at the end of the file
	 */
	text: string;
}

/**
 * A single plain whitespace item inside of a node, e.g. between two arguments in a node.
 */
export type PlainNodeSpace = InlineWhitespace | EscLine | MultilineComment;

/**
 * A slashdash comment inside a node, i.e. a slashdash commented argument, property, or child block
 */
export interface NodeSpaceSlashDash {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "slashdash";

	/**
	 * Any whitespace between the slashdash token and the value
	 */
	preface: PlainNodeSpace[];

	/**
	 * The escaped value
	 */
	value: Entry | Document;
}

/**
 * Whitespace inside of a node, e.g. between two arguments in a node.
 */
export type NodeSpace = (PlainNodeSpace | NodeSpaceSlashDash)[];

/**
 * A single plain whitespace item in a document, i.e. before/after/between nodes
 */
export type PlainLineSpace =
	| BOM
	| InlineWhitespace
	| Newline
	| SingleLineComment
	| MultilineComment;

/**
 * A slashdash comment in a document, i.e. a slashdash commented node
 */
export interface LineSpaceSlashDash {
	/**
	 * A property to differentiate the different types of whitespace
	 */
	type: "slashdash";

	/**
	 * Any whitespace between the slashdash token and the value
	 */
	preface: PlainNodeSpace[];

	/**
	 * The escaped value
	 */
	value: Node;
}

/**
 * Whitespace in a document, i.e. before/after/between nodes
 */
export type LineSpace = (PlainLineSpace | LineSpaceSlashDash)[];
