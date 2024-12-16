import {tokenize} from "./parser/tokenize.js";
import {
	finalize,
	createParserCtx,
	parseDocument,
	parseIdentifier,
	parseNodePropOrArgWithSpace,
	parseNodeWithSpace,
	parseValue,
} from "./parser/parse.js";
import {
	parseWhitespaceInDocument,
	parseWhitespaceInNode,
} from "./parser/parse-whitespace.js";
import {InvalidKdlError} from "./error.js";

const methods = /** @type {const} */ ({
	value: parseValue,
	identifier: parseIdentifier,
	node: parseNodeWithSpace,
	entry: parseNodePropOrArgWithSpace,
	document: parseDocument,

	"whitespace in document": parseWhitespaceInDocument,
	"whitespace in node": parseWhitespaceInNode,
});

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

	const tokens = tokenize(text, parserOptions);
	// console.log(Array.from(tokens));

	const ctx = createParserCtx(tokens, parserOptions);

	let value;
	try {
		value = parserMethod(ctx);

		if (!value) {
			throw new InvalidKdlError(
				`Expected ${/^[aeiouy]/.exec(as) ? "an" : "a"} ${as}`,
			);
		}

		finalize(ctx);
	} catch (e) {
		// rethrow to clean up the stacktrace
		if (e instanceof InvalidKdlError) {
			throw new InvalidKdlError(e.message, {cause: e.cause});
		} else if (e instanceof AggregateError) {
			const errors = [];
			for (const err of e.errors) {
				if (err instanceof InvalidKdlError) {
					errors.push(new InvalidKdlError(err.message, {cause: err.cause}));
				} else {
					errors.push(err);
				}
			}
			throw new AggregateError(errors, e.message, {cause: e.cause});
		} else {
			throw e;
		}
	}

	return value;
}
