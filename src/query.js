import {InvalidKdlQueryError} from "./error.js";
import {resolveFlags} from "./flags.js";
import {Query} from "./model/query/query.js";
import {parseQuery} from "./parser/parse-query.js";
import {createParserCtx, finalize} from "./parser/parse.js";
import {tokenizeQuery} from "./parser/tokenize/tokenize-query.js";

export {Accessor} from "./model/query/accessor.js";
export {Comparison} from "./model/query/comparison.js";
export {Filter} from "./model/query/filter.js";
export {Matcher} from "./model/query/matcher.js";
export {Query, Selector} from "./model/query/query.js";

export {InvalidKdlQueryError} from "./error.js";

/**
 * Parse the given text into a KDL Query
 *
 * @param {string | ArrayBuffer | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | DataView} text
 * @param {object} [options]
 * @param {boolean} [options.graphemeLocations]
 * @param {Partial<import('./flags.js').ParserFlags>} [options.flags]
 * @returns {Query}
 * @throws {InvalidKdlQueryError} If the query is invalid
 */
export function parse(text, {flags, ...options} = {}) {
	if (typeof text !== "string") {
		if (typeof TextDecoder !== "function") {
			throw new TypeError(
				"Uint8Array input is only supported on platforms that include TextDecoder",
			);
		}

		const decoder = new TextDecoder("utf-8", {fatal: true});

		text = decoder.decode(text);
	}

	const resolvedFlags = resolveFlags(flags);

	const tokens = tokenizeQuery(text, {...options, flags: resolvedFlags});
	// console.log(Array.from(tokens));

	const ctx = createParserCtx(text, tokens, {flags: resolvedFlags});

	let value;
	try {
		value = parseQuery(ctx);
	} catch (e) {
		finalize(ctx, e);
	}

	finalize(ctx);

	if (!value) {
		throw new InvalidKdlQueryError(`Expected a query`);
	}

	return value;
}
