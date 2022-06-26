import {createToken} from 'chevrotain';

export const reInlineWhitespace =
	/[ \t\uFEFF\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]+/;

export const inlineWhitespace = createToken({
	name: 'InlineWhiteSpace',
	pattern: reInlineWhitespace,
});

export const reContainsNewLine = /[\x0A\x0C\x0D\x85\u2028\u2029]/;

export const newLine = createToken({
	name: 'NewLine',
	pattern: /\x0D\x0A|[\x0A\x0C\x0D\x85\u2028\u2029]/,
});

export const slashDash = createToken({
	name: 'SlashDash',
	label: '/-',
	pattern: /\/-/,
});

export const singleLineComment = createToken({
	name: 'SingleLineComment',
	pattern: /\/\/[^\x0A\x0C\x0D\x85\u2028\u2029]*/,
});

export const multiLineCommentMode = 'multilineComment';

export const openMultiLineComment = createToken({
	name: 'OpenMultiLineComment',
	label: '/*',
	pattern: /\/\*/,
	push_mode: multiLineCommentMode,
});
export const multiLineCommentContent = createToken({
	name: 'MultiLineCommentContent',
	pattern: /[^/*]+|\*|\//,
	line_breaks: true,
});
export const closeMultiLineComment = createToken({
	name: 'CloseMultiLineComment',
	label: '*/',
	pattern: /\*\//,
	pop_mode: true,
});
