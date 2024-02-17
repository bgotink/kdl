import {KdlLexer, KdlParser} from "./parser.js";
import {
	InvalidKdlError,
	stringifyOffset,
	stringifyTokenOffset,
} from "./error.js";

const lexer = new KdlLexer();
const parser = new KdlParser();

const methods = /** @type {const} */ ({
	value: parser.value,
	identifier: parser.identifier,
	node: parser.nodeWithSpace,
	entry: parser.nodePropOrArgWithSpace,
	document: parser.document,
});

const illegalUnicodeCharacters =
	/[\x00-\x08\x0E-\x19\x7F\u2066-\u2069\u202A-\u202E\u200E\u200F]/;
const BOM = "\uFEFF";

/**
 * @param {string | ArrayBuffer | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | DataView} text
 * @param {object} [options]
 * @param {keyof typeof methods} [options.as]
 * @param {boolean} [options.storeLocations]
 */
export function parse(text, {as = "document", storeLocations = false} = {}) {
	/**
	 * @type {import('chevrotain').ParserMethod<[], import('./model.js').Value | import('./model.js').Identifier | import('./model.js').Entry | import('./model.js').Node | import('./model.js').Document>}
	 */
	const parserMethod = methods[as];
	if (parserMethod == null) {
		throw new TypeError(`Invalid "as" target passed: ${JSON.stringify(as)}`);
	}

	if (typeof text !== "string") {
		if (typeof "TextDecoder" !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	if (text.lastIndexOf(BOM) > (as === "document" ? 0 : -1)) {
		throw new InvalidKdlError(
			"BOM can only appear at the start of a KDL document",
		);
	}

	if (illegalUnicodeCharacters.test(text)) {
		throw new InvalidKdlError("Found UTF-8 characters not allowed in KDL");
	}

	const {tokens, errors} = lexer.tokenize(text);
	// console.log(tokens.map(token => [token.image, token.tokenType.name]));

	if (errors.length === 1) {
		const [error] = errors;
		throw new InvalidKdlError(
			`Failed to parse KDL ${as}, ${error.message} at ${stringifyOffset(
				error,
			)}`,
		);
	} else if (errors.length > 0) {
		throw new InvalidKdlError(
			`Failed to parse KDL ${as} due to multiple errors:\n${errors
				.map((error) => `- ${error.message} at ${stringifyOffset(error)}`)
				.join("\n")}`,
		);
	}

	// console.log(tokens.map(t => ({name: t.tokenType.name, content: t.image})));
	parser.input = tokens;
	parser.storeLocationInfo = storeLocations;

	let value;
	try {
		value = parserMethod.call(parser);
	} catch (e) {
		if (e && e instanceof InvalidKdlError) {
			// rethrow to clean up the stacktrace
			throw new InvalidKdlError(e.message);
		} else {
			throw e;
		}
	}

	if (parser.errors.length === 1) {
		const [error] = parser.errors;
		// console.log(error);
		throw new InvalidKdlError(
			`Failed to parse KDL ${as}, ${error.message} at ${stringifyTokenOffset(
				error.token,
			)}`,
		);
	} else if (parser.errors.length > 0) {
		throw new InvalidKdlError(
			`Failed to parse KDL ${as} due to multiple errors:\n${parser.errors
				.map(
					(error) =>
						`- ${error.message} at ${stringifyTokenOffset(error.token)}`,
				)
				.join("\n")}`,
		);
	}

	return value;
}
