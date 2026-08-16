#!/usr/bin/env node
// @ts-check

import {Writable} from "node:stream";
import {parse, Entry, Node} from "../../src/index.js";

/**
 * @typedef {object} JsonStringValue
 * @prop {"string"} type
 * @prop {string} value
 */

/**
 * @typedef {object} JsonNumberValue
 * @prop {"number"} type
 * @prop {string} value
 */

/**
 * @typedef {object} JsonBooleanValue
 * @prop {"boolean"} type
 * @prop {"true" | "false"} value
 */

/**
 * @typedef {object} JsonNullValue
 * @prop {"null"} type
 */

/**
 * @typedef {object} JsonValue
 * @prop {string | null} type
 * @prop {JsonStringValue | JsonNumberValue | JsonBooleanValue | JsonNullValue} value
 */

/**
 * @typedef {object} JsonNode
 * @prop {string | null} type
 * @prop {string} name
 * @prop {JsonValue[]} args
 * @prop {Record<string, JsonValue>} props
 * @prop {JsonNode[]} [children]
 */

/** @param {number} value */
function stringifyNumber(value) {
	if (Number.isNaN(value)) {
		return "nan";
	}

	if (!Number.isFinite(value)) {
		return value > 0 ? "inf" : "-inf";
	}

	if (Number.isInteger(value)) {
		return BigInt(value).toString() + ".0";
	}

	const str = value.toString();

	const exponentIndex = str.indexOf("e");
	if (exponentIndex === -1) {
		return str;
	}

	const sign = str.charAt(0) === "-" ? "-" : "";
	let exponent = Number.parseInt(str.slice(exponentIndex + 1));
	let val = str.slice(sign.length, exponentIndex);

	// Note this is far from general enough for a regular toString
	// functionality for a number with an exponent, but in this scenario
	// we're only thinking about numbers stringified to exponent notation
	// by JavaScript's builtin Number.prototype.toString()
	// --> proper scientific notation with a single non-zero digit before the dot
	//   + only happens for very large or very small numbers, so we don't have to
	//     consider the case where the exponent would result in a large number
	//     with digits behind the decimal point.

	if (val.charAt(1) === ".") {
		val = val.charAt(0) + val.slice(2);
		exponent -= val.length - 1;
	}

	if (exponent >= 0) {
		return `${sign}${val}${"0".repeat(exponent)}`;
	} else {
		return `${sign}0.${"0".repeat(-(exponent + val.length))}${val}`;
	}
}

/**
 * @param {Entry} entry
 * @returns {JsonValue}
 */
function mapValue(entry) {
	/** @type {JsonValue['value']} */
	let value;
	switch (typeof entry.value.value) {
		case "string":
			value = {type: "string", value: entry.value.value};
			break;
		case "boolean":
			value = {type: "boolean", value: `${entry.value.value}`};
			break;
		case "number":
			value = {type: "number", value: stringifyNumber(entry.value.value)};
			break;
		default:
			value = {type: "null"};
	}

	return {
		type: entry.getTag(),
		value,
	};
}

/**
 * @param {Node} node
 * @returns {JsonNode}
 */
function mapNode(node) {
	return {
		type: node.getTag(),
		name: node.getName(),
		args: node.getArgumentEntries().map(mapValue),
		props: Object.fromEntries(
			node
				.getPropertyEntries()
				.map((entry) => [entry.getName(), mapValue(entry)]),
		),
		children: node.children?.nodes.map(mapNode) ?? [],
	};
}

try {
	/** @type {Buffer[]} */
	const inputParts = [];

	process.stdin.pipe(
		new Writable({
			writev(chunks, cb) {
				inputParts.push(...chunks.map(({chunk}) => chunk));

				cb();
			},
		}),
	);

	await new Promise((resolve) => process.stdin.on("end", resolve));

	process.stdout.write(
		JSON.stringify(parse(Buffer.concat(inputParts)).nodes.map(mapNode)),
	);
	process.stdout.write("\n");
} catch (e) {
	process.stderr.write(String(e));
	process.exit(1);
}
