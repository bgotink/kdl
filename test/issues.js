import {expect} from 'expect';
import {test} from 'uvu';

import {clearFormat, Entry, Node, parse} from '../src/index.js';

test('issue #1: leading/trailing whitespace', () => {
	expect(
		clearFormat(
			parse(
				String.raw`
					node {}
				`,
				{as: 'node'},
			),
		),
	).toEqual(Node.create('node'));

	expect(
		clearFormat(
			parse(
				String.raw`    \
					prop="value" \
				`,
				{as: 'entry'},
			),
		),
	).toEqual(Entry.createProperty('prop', 'value'));

	expect(
		clearFormat(
			parse(
				String.raw` \
					"value"   \
				`,
				{as: 'entry'},
			),
		),
	).toEqual(Entry.createArgument('value'));
});

test.run();
