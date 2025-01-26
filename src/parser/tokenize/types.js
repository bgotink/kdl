export const T_EOF = 1;

export const T_BOM = 2;
export const T_SLASHDASH = 3;
export const T_OPEN_PAREN = 4;
export const T_OPEN_BRACE = 5;
export const T_CLOSE_PAREN = 6;
export const T_CLOSE_BRACE = 7;
export const T_SEMICOLON = 8;

export const T_QUOTED_STRING = 9;
export const T_RAW_STRING = 10;
export const T_IDENTIFIER_STRING = 11;

export const T_EQUALS = 12;
export const T_KEYWORD = 13;

export const T_NUMBER_HEXADECIMAL = 14;
export const T_NUMBER_DECIMAL = 15;
export const T_NUMBER_OCTAL = 16;
export const T_NUMBER_BINARY = 17;

export const T_INLINE_WHITESPACE = 18;
export const T_NEWLINE = 19;
export const T_ESCLINE = 20;

export const T_COMMENT_SINGLE = 21;
export const T_COMMENT_MULTI = 22;

export const T_MULTILINE_QUOTED_STRING = 23;
export const T_MULTILINE_RAW_STRING = 24;

export const T_OPEN_SQUARE = 25;
export const T_CLOSE_SQUARE = 26;

export const T_QUERY_OPERATOR = 27;

/** @param {number} codePoint  */
export function isUnicodeSpace(codePoint) {
	switch (codePoint) {
		case 0x0009: // Character Tabulation
		case 0x0020: // Space
		case 0x00a0: // No-Break Space
		case 0x1680: // Ogham Space Mark
		case 0x2000: // En Quad
		case 0x2001: // Em Quad
		case 0x2002: // En Space
		case 0x2003: // Em Space
		case 0x2004: // Three-Per-Em Space
		case 0x2005: // Four-Per-Em Space
		case 0x2006: // Six-Per-Em Space
		case 0x2007: // Figure Space
		case 0x2008: // Punctuation Space
		case 0x2009: // Thin Space
		case 0x200a: // Hair Space
		case 0x202f: // Narrow No-Break Space
		case 0x205f: // Medium Mathematical Space
		case 0x3000: // Ideographic Space
			return true;
	}
	return false;
}

/** @param {number} codePoint */
export function isNewLine(codePoint) {
	return (
		codePoint === 0x0d || // Carriage Return
		codePoint === 0x0a || // Line Feed
		codePoint === 0x85 || // Next Line
		codePoint === 0x0b || // Line Tabulation
		codePoint === 0x0c || // Form Feed
		codePoint === 0x2028 || // Line Separator
		codePoint === 0x2029 || // Paragraph Separator
		false
	);
}

/** @param {number} codePoint */
export function isInvalidCharacter(codePoint) {
	return (
		// Everything < \x20 except those that count as whitespace
		codePoint < 0x08 ||
		(codePoint >= 0x0e && codePoint <= 0x19) ||
		// Delete
		codePoint === 0x7f ||
		// Non-scalar values
		(codePoint >= 0xd800 && codePoint <= 0xdfff) ||
		codePoint > 0x10ffff ||
		// Direction control characters
		codePoint === 0x200e ||
		codePoint === 0x200f ||
		(codePoint >= 0x202a && codePoint <= 0x202e) ||
		(codePoint >= 0x2066 && codePoint <= 0x2069) ||
		// BOM is only valid at the start, otherwise it counts as invalid
		codePoint === 0xfeff
	);
}

/** @param {number} codePoint */
export function isIdentifierChar(codePoint) {
	// All other functions check whether the code point is one of a set of values,
	// this check does the opposite, it checks that the code point doesn't have
	// certain values.
	// That means this check has to explicitly check for EOF, which we represent
	// using NaN.
	return (
		!isNaN(codePoint) &&
		!isUnicodeSpace(codePoint) &&
		!isNewLine(codePoint) &&
		codePoint !== 0x3d && // =
		codePoint !== 0x5c && // \
		codePoint !== 0x2f && // /
		codePoint !== 0x28 && // (
		codePoint !== 0x29 && // )
		codePoint !== 0x7b && // {
		codePoint !== 0x7d && // }
		codePoint !== 0x3b && // ;
		codePoint !== 0x5b && // [
		codePoint !== 0x5d && // ]
		codePoint !== 0x22 && // "
		codePoint !== 0x23 && // #
		true
	);
}

/** @param {number} codePoint */
export function isHexadecimalDigit(codePoint) {
	return (
		(codePoint >= 0x30 && codePoint < 0x40) || // decimal
		(codePoint >= 0x41 && codePoint < 0x47) || // A-F
		(codePoint >= 0x61 && codePoint < 0x67) || // a-f
		false
	);
}

/** @param {number} codePoint */
export function isHexadecimalDigitOrUnderscore(codePoint) {
	return isHexadecimalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
export function isDecimalDigit(codePoint) {
	return codePoint >= 0x30 && codePoint < 0x3a;
}

/** @param {number} codePoint */
export function isDecimalDigitOrUnderscore(codePoint) {
	return isDecimalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
export function isOctalDigit(codePoint) {
	return codePoint >= 0x30 && codePoint < 0x38;
}

/** @param {number} codePoint */
export function isOctalDigitOrUnderscore(codePoint) {
	return isOctalDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
export function isBinaryDigit(codePoint) {
	return codePoint === 0x30 || codePoint === 0x31;
}

/** @param {number} codePoint */
export function isBinaryDigitOrUnderscore(codePoint) {
	return isBinaryDigit(codePoint) || codePoint === 0x5f;
}

/** @param {number} codePoint */
export function isNumberSign(codePoint) {
	return codePoint === 0x2d || codePoint === 0x2b;
}
