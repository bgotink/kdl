import {InvalidKdlQueryError} from "../error.js";
import {Identifier} from "../model.js";
import {Accessor} from "../model/query/accessor.js";
import {Comparison} from "../model/query/comparison.js";
import {Filter} from "../model/query/filter.js";
import {Matcher} from "../model/query/matcher.js";
import {Query, Selector} from "../model/query/query.js";

import {
	consume,
	parseIdentifier as _parseIdentifier,
	parseNodeSpace,
	parseTag,
	parseValue,
	pop,
} from "./parse.js";
import {
	T_BOM,
	T_CLOSE_PAREN,
	T_CLOSE_SQUARE,
	T_OPEN_PAREN,
	T_OPEN_SQUARE,
	T_QUERY_OPERATOR,
} from "./tokenize.js";

/** @import { SelectorOperator } from '../model/query/query.js'; */

/** @import { ParserCtx } from "./parse.js"; */

/**
 * @param {ParserCtx} ctx
 * @param {string} message
 */
export function mkError(ctx, message) {
	return new InvalidKdlQueryError(message, {
		token: ctx.current.value ?? ctx.lastToken,
	});
}

/** @param {ParserCtx} ctx */
function parseIdentifier(ctx) {
	if (ctx.current.value?.type !== T_QUERY_OPERATOR) {
		return _parseIdentifier(ctx);
	}

	// Certain operators can be identifiers:
	const text = ctx.current.value.text;
	if (
		text === "||" ||
		text === ">" ||
		text === ">>" ||
		text === "<" ||
		text === "<<"
	) {
		pop(ctx);

		let identifier = _parseIdentifier(ctx);

		if (identifier) {
			identifier.name = text + identifier.name;
			identifier.representation = text + identifier.representation;
		} else {
			identifier = new Identifier(text);
			identifier.representation = text;
		}

		return identifier;
	}

	return;
}

/** @param {ParserCtx} ctx */
function parseAccessor(ctx) {
	const name = parseIdentifier(ctx)?.name;
	if (name == null) {
		return;
	}

	if (!consume(ctx, T_OPEN_PAREN)) {
		return Accessor.property(name);
	}

	parseNodeSpace(ctx);

	let accessor;

	switch (name) {
		case "name":
			accessor = Accessor.name();
			break;
		case "tag":
			accessor = Accessor.tag();
			break;
		case "val": {
			const arg = parseValue(ctx)?.value;
			if (arg !== undefined && typeof arg !== "number") {
				throw mkError(ctx, "The val() accessor only accepts number values");
			}
			accessor = Accessor.argument(arg);
			break;
		}
		case "prop": {
			const prop = parseIdentifier(ctx);
			if (!prop) {
				throw mkError(ctx, "The prop() accessor requires a property name");
			}

			accessor = Accessor.property(prop.name);
			break;
		}
		default:
			throw mkError(ctx, `Invalid accessor ${name}()`);
	}

	parseNodeSpace(ctx);

	if (!consume(ctx, T_CLOSE_PAREN)) {
		throw mkError(ctx, "Expected closing parenthesis");
	}

	return accessor;
}

/** @param {ParserCtx} ctx */
function parseComparison(ctx) {
	const operator = consume(ctx, T_QUERY_OPERATOR)?.text;
	if (!operator) {
		return;
	}

	parseNodeSpace(ctx);

	const value = parseValue(ctx) ?? parseTag(ctx);

	switch (operator) {
		case "=":
		case "!=":
		case ">":
		case "<":
		case ">=":
		case "<=":
		case "^=":
		case "$=":
		case "*=": {
			if (!value) {
				throw mkError(
					ctx,
					`Operator ${operator} requires a right hand side value`,
				);
			}

			return Comparison.create(operator, value);
		}
		default:
			throw mkError(ctx, `Operator ${operator} cannot be used in a comparison`);
	}
}

/** @param {ParserCtx} ctx */
function parseAccessorMatcher(ctx) {
	if (!consume(ctx, T_OPEN_SQUARE)) {
		return;
	}

	parseNodeSpace(ctx);

	const accessor = parseAccessor(ctx);
	if (!accessor) {
		if (!consume(ctx, T_CLOSE_SQUARE)) {
			throw mkError(ctx, "Expected an accessor");
		}

		return Matcher.always();
	}

	parseNodeSpace(ctx);
	const comparison = parseComparison(ctx);
	parseNodeSpace(ctx);

	if (!consume(ctx, T_CLOSE_SQUARE)) {
		throw mkError(ctx, "Expected ]");
	}

	return Matcher.accessor(accessor, comparison ?? null);
}

/** @param {ParserCtx} ctx */
function parseTypeMatcher(ctx) {
	if (!consume(ctx, T_OPEN_PAREN)) {
		return;
	}

	parseNodeSpace(ctx);

	const tag = parseIdentifier(ctx)?.name ?? null;

	parseNodeSpace(ctx);

	if (!consume(ctx, T_CLOSE_PAREN)) {
		throw mkError(ctx, "Invalid tag");
	}

	return Matcher.type(tag);
}

/** @param {ParserCtx} ctx */
function parseNodeNameMatcher(ctx) {
	const name = parseIdentifier(ctx)?.name;
	if (name == null) {
		return;
	}

	return Matcher.nodeName(name);
}

/** @param {ParserCtx} ctx */
function parseFilter(ctx) {
	const typeMatcher = parseTypeMatcher(ctx);
	const nameMatcher = parseNodeNameMatcher(ctx);
	const accessorMatcher = parseAccessorMatcher(ctx);

	/** @type {[Matcher, ...Matcher[]]} */
	let matchers;

	if (typeMatcher) {
		matchers = [typeMatcher];
		nameMatcher && matchers.push(nameMatcher);
		accessorMatcher && matchers.push(accessorMatcher);
	} else if (nameMatcher) {
		matchers = [nameMatcher];
		accessorMatcher && matchers.push(accessorMatcher);
	} else if (accessorMatcher) {
		matchers = [accessorMatcher];
	} else {
		return;
	}

	let matcher;
	while ((matcher = parseAccessorMatcher(ctx))) {
		matchers.push(matcher);
	}

	return new Filter(matchers);
}

/**
 * @param {ParserCtx} ctx
 * @returns {SelectorOperator=}
 */
function parseSelectorOperator(ctx) {
	if (ctx.current.done || ctx.current.value.type !== T_QUERY_OPERATOR) {
		return;
	}

	const {text} = ctx.current.value;
	switch (text) {
		case ">":
		case ">>":
		case "+":
		case "++":
			pop(ctx);
			return text;
	}
}

/** @param {ParserCtx} ctx */
function parseSelector(ctx) {
	const identifier = parseIdentifier(ctx);

	/** @type {[SelectorOperator, Filter][]} */
	const filters = [];

	/** @type {SelectorOperator=} */
	let nextOperator = ">>";

	if (identifier) {
		if (identifier.name === "top" && consume(ctx, T_OPEN_PAREN)) {
			parseNodeSpace(ctx);
			if (!consume(ctx, T_CLOSE_PAREN)) {
				throw mkError(ctx, "top() does not take parameters");
			}
		} else {
			// Oops, we've accidentally parsed part of the first filter already

			/** @type {[Matcher, ...Matcher[]]} */
			let matchers = [Matcher.nodeName(identifier.name)];

			let matcher;
			while ((matcher = parseAccessorMatcher(ctx))) {
				matchers.push(matcher);
			}

			filters.push([">>", new Filter(matchers)]);
		}

		parseNodeSpace(ctx);
		const op = parseSelectorOperator(ctx);
		parseNodeSpace(ctx);

		if (!op) {
			if (filters.length) {
				return new Selector(
					/** @type {[[SelectorOperator, Filter], ...[SelectorOperator, Filter][]]} */ (
						filters
					),
				);
			}

			throw mkError(ctx, "top() must be followed by an operator");
		}

		nextOperator = op;
	}

	while (nextOperator) {
		const filter = parseFilter(ctx);
		if (!filter) {
			throw mkError(ctx, "Expected a filter");
		}

		filters.push([nextOperator, filter]);

		parseNodeSpace(ctx);
		nextOperator = parseSelectorOperator(ctx);
		parseNodeSpace(ctx);
	}

	return filters.length ?
			new Selector(
				/** @type {[[SelectorOperator, Filter], ...[SelectorOperator, Filter][]]} */ (
					filters
				),
			)
		:	undefined;
}

/** @param {ParserCtx} ctx */
export function parseQuery(ctx) {
	consume(ctx, T_BOM);

	const selector = parseSelector(ctx);
	if (!selector) {
		return;
	}

	const selectors = [selector];

	parseNodeSpace(ctx);

	let separator;
	while ((separator = consume(ctx, T_QUERY_OPERATOR))) {
		if (separator.text !== "||") {
			throw mkError(ctx, `Invalid operator ${separator.text}`);
		}

		parseNodeSpace(ctx);

		const selector = parseSelector(ctx);
		if (!selector) {
			throw mkError(ctx, `Expected a selector after ||`);
		}

		selectors.push(selector);
		parseNodeSpace(ctx);
	}

	return new Query(selectors);
}
