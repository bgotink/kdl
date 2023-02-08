import assert from 'node:assert/strict';
import {test} from 'uvu';

import {
	Document,
	Entry,
	Identifier,
	Node,
	format,
	Value,
} from '../src/index.js';

test('format document', () => {
	assert.equal(
		format(
			new Document([
				new Node(
					new Identifier('node'),
					[
						new Entry(new Value('value'), null),
						new Entry(new Value(2), null),
						new Entry(new Value(null), null),
						new Entry(new Value(true), null),
						new Entry(new Value(false), null),
					],
					new Document([
						new Node(new Identifier('child')),
						new Node(new Identifier('child too')),
					]),
				),
			]),
		),
		`node "value" 2 null true false {
	child
	"child too"
}
`,
	);
});

test.run();
