import assert from "node:assert/strict";
import {test} from "uvu";

import {Document, format, parse} from "../src/index.js";

test("readme code sample", () => {
	const doc = parse(String.raw`
		node "value" #"other value"# 2.0 4 #false \
				#null -0 {
			child; "child too"
		}
	`);

	/** @type {Document} */ (doc.nodes[0].children).nodes[0].entries.push(
		parse(
			String.raw`/-lorem="ipsum" \
				dolor=#true`,
			{as: "entry"},
		),
	);

	assert.equal(
		format(doc),
		String.raw`
		node "value" #"other value"# 2.0 4 #false \
				#null -0 {
			child /-lorem="ipsum" \
				dolor=#true; "child too"
		}
	`,
	);
});

test.run();
