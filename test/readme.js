import {expect} from 'expect';
import {test} from 'uvu';

import {
	Document,
	Entry,
	Identifier,
	Node,
	format,
	Value,
	parse,
} from '../src/index.js';

test('readme code sample', () => {
	const doc = parse(String.raw`
		node "value" r#"other value"# 2.0 4 false \
				null -0 {
			child; "child too"
		}
	`);

	/** @type {Document} */ (doc.nodes[0].children).nodes[0].entries.push(
		parse(
			String.raw`/-lorem="ipsum" \
				dolor=true`,
			{as: 'entry'},
		),
	);

	expect(format(doc)).toBe(String.raw`
		node "value" r#"other value"# 2.0 4 false \
				null -0 {
			child /-lorem="ipsum" \
				dolor=true; "child too"
		}
	`);
});

test.run();
