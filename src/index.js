export {clearFormat} from "./clear-format.js";
export {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";
export {InvalidKdlError} from "./error.js";
export {format} from "./format.js";
export {getLocation} from "./locations.js";
export {parse} from "./parse.js";

/**
 * @typedef {import('./locations.js').Location} Location
 */

/** @typedef {import('./model/whitespace.js').BOM} BOM */
/** @typedef {import('./model/whitespace.js').EscLine} EscLine */
/** @typedef {import('./model/whitespace.js').InlineWhitespace} InlineWhitespace */
/** @typedef {import('./model/whitespace.js').LineSpace} LineSpace */
/** @typedef {import('./model/whitespace.js').LineSpaceSlashDash} LineSpaceSlashDash */
/** @typedef {import('./model/whitespace.js').MultilineComment} MultilineComment */
/** @typedef {import('./model/whitespace.js').Newline} Newline */
/** @typedef {import('./model/whitespace.js').NodeSpace} NodeSpace */
/** @typedef {import('./model/whitespace.js').NodeSpaceSlashDash} NodeSpaceSlashDash */
/** @typedef {import('./model/whitespace.js').PlainLineSpace} PlainLineSpace */
/** @typedef {import('./model/whitespace.js').PlainNodeSpace} PlainNodeSpace */
/** @typedef {import('./model/whitespace.js').SingleLineComment} SingleLineComment */
