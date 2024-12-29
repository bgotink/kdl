export {clearFormat} from "./clear-format.js";
export {Document, Entry, Identifier, Node, Tag, Value} from "./model.js";
export {InvalidKdlError} from "./error.js";
export {format} from "./format.js";
export {getLocation} from "./locations.js";
export {parse} from "./parse.js";

/**
 * @typedef {import('./model.js').Primitive} Primitive
 */

/**
 * @typedef {import("./parser/token.js").Token} Token
 */

/**
 * @typedef {import("./parser/token.js").Location} Location
 */

/**
 * @typedef {import("./locations.js").StoredLocation} StoredLocation
 */

/** @typedef {import('./model/whitespace.js').BOM} BOM */
/** @typedef {import('./model/whitespace.js').EscLine} EscLine */
/** @typedef {import('./model/whitespace.js').InlineWhitespace} InlineWhitespace */
/** @typedef {import('./model/whitespace.js').LineSpace} LineSpace */
/** @typedef {import('./model/whitespace.js').SlashDashInDocument} SlashDashInDocument */
/** @typedef {import('./model/whitespace.js').MultilineComment} MultilineComment */
/** @typedef {import('./model/whitespace.js').Newline} Newline */
/** @typedef {import('./model/whitespace.js').NodeSpace} NodeSpace */
/** @typedef {import('./model/whitespace.js').SlashDashInNode} SlashDashInNode */
/** @typedef {import('./model/whitespace.js').WhitespaceInNode} WhitespaceInNode */
/** @typedef {import('./model/whitespace.js').WhitespaceInDocument} WhitespaceInDocument */
/** @typedef {import('./model/whitespace.js').SingleLineComment} SingleLineComment */
