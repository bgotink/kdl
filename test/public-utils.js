import assert from 'node:assert/strict';
import {test} from 'uvu';

import {getIndentation, parse} from '../src/index.js';

test('getIndentation', () => {
	const parsed = parse(String.raw`
node "value" r"value too" 2 0b10_10 0xfF null \
     true false {
	child; "child too"; r##"child three"## {}
}
`);

	const root = parsed.nodes[0];
	const children = /** @type {import('../src/index.js').Document} */ (
		root.children
	);
	assert.equal(getIndentation(root), '');
	assert.equal(getIndentation(children.nodes[0]), '\t');
	assert.equal(getIndentation(children.nodes[1]), null);
	assert.equal(getIndentation(children.nodes[2]), null);
});

test.run();
