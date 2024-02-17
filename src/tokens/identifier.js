import {createToken} from "chevrotain";

export const rePlainIdentifier =
	/(?![+-]?[0-9])(?:(?!﹦|＝|🟰)[^(){}\[\]/\\"#;=\x09-\x0D\x20\x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000])+/;

export const plainIdentifier = createToken({
	name: "PlainIdentifier",
	pattern: rePlainIdentifier,
});
