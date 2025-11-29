import {InvalidKdlError} from "./error.js";
import {resolveFlags} from "./flags.js";
import {Document} from "./model/document.js";
import {parseDocument as parseV1Document} from "./parser/parse-v1.js";
import {
	createParserCtx,
	finalize,
	parseDocument as parseV2Document,
} from "./parser/parse.js";
import {tokenize as tokenizeV2} from "./parser/tokenize.js";
import {tokenize as tokenizeV1} from "./parser/tokenize/tokenize-v1.js";

/** @import {format} from './index.js' */

/**
 * Alias for `parse`
 *
 * @deprecated Use {@link parse} instead
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @returns {Document}
 */
export function parseWithoutFormatting(text) {
	return parse(text);
}

/**
 * Alias for `parse`
 *
 * @deprecated Use {@link parse} instead
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @returns {Document}
 */
export function parseAndTransform(text) {
	return parse(text);
}

/**
 * Parse the given KDL v1 text and turn it into a KDL v2 document
 *
 * {@link format Formatting} the given document will result in a KDL v2 text
 * equivalent to the original KDL v1 text.
 *
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @param {object} [options]
 * @param {boolean} [options.storeLocations]
 * @param {boolean} [options.graphemeLocations]
 * @returns {Document}
 */
export function parse(text, options = {}) {
	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	const tokens = tokenizeV1(text, options);

	const ctx = createParserCtx(text, tokens, {
		...options,
		flags: {
			experimentalSuffixedNumbers: false,
		},
	});

	let value;
	try {
		value = parseV1Document(ctx);
	} catch (e) {
		finalize(ctx, e);
	}

	finalize(ctx);

	if (!value) {
		throw new InvalidKdlError(`Expected a document`);
	}

	return value;
}

/**
 * Parse the given KDL v1 or v2 text and return a valid KDL v2 document
 *
 * {@link format Formatting} the given document will result in a KDL v2 text,
 * even if the original text was KDL v1.
 *
 * This function does not respect any `/- kdl-version <number>` comments
 * in the text. It always tries the most recent KDL version first and falls
 * back to the previous version if that fails.
 * If the text doesn't parse into a valid document under any KDL version,
 * an `AggregateError` is thrown combining all errors.
 *
 * @param {Parameters<typeof import("./index.js").parse>[0]} text
 * @param {object} [options]
 * @param {boolean} [options.storeLocations]
 * @param {boolean} [options.graphemeLocations]
 * @param {Partial<import('./flags.js').ParserFlags>} [options.flags]
 * @returns {Document}
 */
export function parseCompat(
	text,
	{storeLocations, graphemeLocations, flags} = {},
) {
	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	let v2Error;
	try {
		const resolvedFlags = resolveFlags(flags);

		const tokens = tokenizeV2(text, {
			graphemeLocations,
			flags: resolvedFlags,
		});

		const ctx = createParserCtx(text, tokens, {
			storeLocations,
			flags: resolvedFlags,
		});

		let value;
		try {
			value = parseV2Document(ctx);
		} catch (e) {
			finalize(ctx, e);
		}

		finalize(ctx);

		if (!value) {
			throw new InvalidKdlError(`Expected a document`);
		}

		return value;
	} catch (e) {
		v2Error = e;
	}

	let v1Error;
	try {
		const tokens = tokenizeV1(text, {graphemeLocations});

		const ctx = createParserCtx(text, tokens, {
			flags: {
				experimentalSuffixedNumbers: false,
			},
		});

		let value;
		try {
			value = parseV1Document(ctx);
		} catch (e) {
			finalize(ctx, e);
		}

		finalize(ctx);

		if (!value) {
			throw new InvalidKdlError(`Expected a document`);
		}

		return value;
	} catch (e) {
		v1Error = e;
	}

	throw new AggregateError(
		[v2Error, v1Error],
		"Failed to parse KDL document as either KDL v2 or KDL v1",
	);
}
