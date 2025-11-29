import {InvalidKdlError} from "./error.js";
import {resolveFlags} from "./flags.js";
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
 * @param {Partial<import('./flags.js').ParserFlags>} [options.flags]
 */
export function parse(text, {as = "document", flags, ...parserOptions} = {}) {
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

	const reoslvedFlags = resolveFlags(flags);

	const tokens = tokenize(text, {...parserOptions, flags: reoslvedFlags});
	// console.log(Array.from(tokens));

	const ctx = createParserCtx(text, tokens, {
		...parserOptions,
		flags: reoslvedFlags,
	});

	let value;
	try {
		value = parserMethod(ctx);
	} catch (e) {
		finalize(ctx, e);
	}

	finalize(ctx);

	if (!value) {
		throw new InvalidKdlError(
			`Expected ${/^[aeiouy]/.exec(as) ? "an" : "a"} ${as}`,
		);
	}

	return value;
}
