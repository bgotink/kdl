import {tokenize} from "./parser/tokenize.js";
import {
	assertAtEOF,
	createParserCtx,
	parseDocument,
	parseIdentifier,
	parseNodePropOrArgWithSpace,
	parseNodeWithSpace,
	parseValue,
} from "./parser/parse.js";
import {parseLineSpace, parseNodeSpace} from "./parser/parse-whitespace.js";
import {InvalidKdlError} from "./error.js";

const methods = /** @type {const} */ ({
	value: parseValue,
	identifier: parseIdentifier,
	node: parseNodeWithSpace,
	entry: parseNodePropOrArgWithSpace,
	document: parseDocument,

	"whitespace in document": parseLineSpace,
	"whitespace in node": parseNodeSpace,
});

const illegalUnicodeCharacters =
	/[\x00-\x08\x0E-\x19\x7F\u2066-\u2069\u202A-\u202E\u200E\u200F]/;
const BOM = "\uFEFF";

/**
 * @param {string | ArrayBuffer | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | DataView} text
 * @param {object} [options]
 * @param {keyof typeof methods} [options.as]
 * @param {boolean} [options.storeLocations]
 * @param {boolean} [options.graphemeLocations]
 */
export function parse(text, {as = "document", ...parserOptions} = {}) {
	const parserMethod = methods[as];
	if (parserMethod == null) {
		throw new TypeError(`Invalid "as" target passed: ${JSON.stringify(as)}`);
	}

	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	if (
		text.lastIndexOf(BOM) >
		(as === "document" || as === "whitespace in document" ? 0 : -1)
	) {
		throw new InvalidKdlError(
			"BOM can only appear at the start of a KDL document",
		);
	}

	if (illegalUnicodeCharacters.test(text)) {
		throw new InvalidKdlError("Found UTF-8 characters not allowed in KDL");
	}

	const tokens = tokenize(text, parserOptions);
	// console.log(Array.from(tokens));

	const ctx = createParserCtx(tokens, parserOptions);

	let value;
	try {
		value = parserMethod(ctx);
	} catch (e) {
		if (e && e instanceof InvalidKdlError) {
			// rethrow to clean up the stacktrace
			throw new InvalidKdlError(e.message);
		} else {
			throw e;
		}
	}

	if (!value) {
		throw new InvalidKdlError(`Expected a ${as}`);
	}

	assertAtEOF(ctx);

	return value;
}
