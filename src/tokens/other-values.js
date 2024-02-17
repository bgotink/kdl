import {createToken} from "chevrotain";

import {plainIdentifier} from "./identifier.js";

export const keyword = createToken({
	name: "Keyword",
	pattern: /#(?:true|false|null|-?inf|nan)/,
});

export const invalidKeyword = createToken({
	name: "InvalidKeyword",
	pattern: /(?:true|false|null)/,
	longer_alt: plainIdentifier,
});
