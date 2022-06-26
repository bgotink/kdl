import {createToken} from 'chevrotain';

import {plainIdentifier} from './identifier.js';

export const _null = createToken({
	name: 'Null',
	pattern: /null/,
	longer_alt: plainIdentifier,
});

export const boolean = createToken({
	name: 'Boolean',
	pattern: /true|false/,
	longer_alt: plainIdentifier,
});
