import {createToken} from "chevrotain";

export const sign = createToken({
	name: "Sign",
	pattern: /[+-](?=[0-9])/,
});

export const binaryNumber = createToken({
	name: "BinaryNumber",
	pattern: /0[bB][01][01_]*/,
});

export const octalNumber = createToken({
	name: "OctalNumber",
	pattern: /0[oO][0-7][0-7_]*/,
});

export const hexadecimalNumber = createToken({
	name: "HexadecimalNumber",
	pattern: /0[xX][0-9A-Fa-f][0-9A-Fa-f_]*/,
});

export const decimalNumber = createToken({
	name: "DecimalNumber",
	pattern: /[0-9][0-9_]*(?:\.[0-9][0-9_]*)?(?:[eE][+-]?[0-9][0-9_]*)?/,
});
