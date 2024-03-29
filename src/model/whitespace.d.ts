import {Document} from "./document.js";
import {Entry} from "./entry.js";
import {Node} from "./node.js";

export interface BOM {
	type: "bom";
	text: string;
}

export interface InlineWhitespace {
	type: "space";
	text: string;
}

export interface Newline {
	type: "newline";
	text: string;
}

export interface EscLine {
	type: "line-escape";
	text: string;
}

export interface MultilineComment {
	type: "multiline";
	text: string;
}

export interface SingleLineComment {
	type: "singleline";
	text: string;
}

export type PlainNodeSpace = InlineWhitespace | EscLine | MultilineComment;

export interface NodeSpaceSlashDash {
	type: "slashdash";
	preface: PlainNodeSpace[];
	value: Entry | Document;
}

export type NodeSpace = (PlainNodeSpace | NodeSpaceSlashDash)[];

export type PlainLineSpace =
	| BOM
	| InlineWhitespace
	| Newline
	| SingleLineComment
	| MultilineComment;

export interface LineSpaceSlashDash {
	type: "slashdash";
	preface: PlainNodeSpace[];
	value: Node;
}

export type LineSpace = (PlainLineSpace | LineSpaceSlashDash)[];
