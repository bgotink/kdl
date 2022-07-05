import {expect} from 'expect';
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
	expect(getIndentation(root)).toBe('');
	expect(children.leading).toBe('');
	expect(getIndentation(children.nodes[0])).toBe('\t');
	expect(getIndentation(children.nodes[1])).toBe(null);
	expect(getIndentation(children.nodes[2])).toBe(null);
});

test.run();
