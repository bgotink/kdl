import {createToken} from "chevrotain";

export const rawString = createToken({
	name: "RawString",
	pattern: /(#+)"(?:.|[\x0A\x0C\x0D\x85\u2028\u2029])*?"\1/,
	start_chars_hint: ["#"],
	line_breaks: true,
});

export const quotedString = createToken({
	name: "QuotedString",
	pattern:
		/"(?:[^\\"]|\\.|\\[\x0A\x0C\x0D\x85\u2028\u2029]|[\x0A\x0C\x0D\x85\u2028\u2029])*"/,
	start_chars_hint: ['"'],
	line_breaks: true,
});

export const escapedWhitespace =
	/(?<=(?:^|[^\\])(?:\\\\)*)\\[\x0A\x0C\x0D\x85\u2028\u2029\uFEFF\u0009\u000B\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;
export const escape = /\\(?:[^u]|u\{([0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\})/g;

export const escapedValues = new Map([
	["\\n", "\n"],
	["\\r", "\r"],
	["\\t", "\t"],
	["\\\\", "\\"],
	['\\"', '"'],
	["\\b", "\b"],
	["\\f", "\f"],
	["\\s", " "],
]);
