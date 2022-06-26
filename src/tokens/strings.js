import {createToken} from 'chevrotain';

export const rawString = createToken({
	name: 'RawString',
	pattern: /r(#*)"(?:.|[\x0A\x0C\x0D\x85\u2028\u2029])*?"\1/,
	start_chars_hint: ['r'],
	line_breaks: true,
});

export const stringMode = 'string';

export const openQuote = createToken({
	name: 'OpenQuote',
	pattern: /"/,
	label: '"',
	push_mode: stringMode,
});

export const unicode = createToken({
	name: 'Unicode',
	pattern: /[^\\"]+/,
	line_breaks: true,
});

export const escape = createToken({name: 'Escape', pattern: /\\[nrt\\/"bf]/});

export const escapedValues = new Map([
	['\\n', '\n'],
	['\\r', '\r'],
	['\\t', '\t'],
	['\\\\', '\\'],
	['\\/', '/'],
	['\\"', '"'],
	['\\b', '\b'],
	['\\f', '\f'],
]);

export const unicodeEscape = createToken({
	name: 'UnicodeEscape',
	pattern: /\\u\{(?:[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\}/,
});

export const closeQuote = createToken({
	name: 'CloseQuote',
	pattern: /"/,
	label: '"',
	pop_mode: true,
});
