import {createToken} from 'chevrotain';

export const semicolon = createToken({
	name: 'Semicolon',
	label: ';',
	pattern: /;/,
});

export const equals = createToken({name: 'Equals', label: '=', pattern: /=/});
export const openBrace = createToken({
	name: 'OpenBrace',
	label: '{',
	pattern: /\{/,
});
export const closeBrace = createToken({
	name: 'CloseBrace',
	label: '}',
	pattern: /\}/,
});
export const openParenthesis = createToken({
	name: 'OpenParenthesis',
	label: '(',
	pattern: /\(/,
});
export const closeParenthesis = createToken({
	name: 'CloseParenthesis',
	label: ')',
	pattern: /\)/,
});

export const escLine = createToken({name: 'EscLine', pattern: /\\/});
