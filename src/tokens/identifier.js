import {createToken} from 'chevrotain';

export const plainIdentifierRe =
	/(?![+-][0-9])[\x21\x23-\x27\x2A\x2B\x2D\x2E\x3A\x3F-\x5A\x5E-\x7A\x7C\x7E-\uFFFF][\x21\x23-\x27\x2A\x2B\x2D\x2E\x30-\x3A\x3F-\x5A\x5E-\x7A\x7C\x7E-\uFFFF]*/;

export const plainIdentifier = createToken({
	name: 'PlainIdentifier',
	pattern: plainIdentifierRe,
});
