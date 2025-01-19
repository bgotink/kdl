import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {test} from "uvu";

import {clearFormat, parse} from "../src/index.js";
import {parse as parseQuery} from "../src/query.js";

const testCasesFolder = new URL("query/test_cases/", import.meta.url);

for (const testCase of readdirSync(testCasesFolder)) {
	test(testCase, () => {
		const document = parse(readFileSync(new URL(testCase, testCasesFolder)));

		// We don't want to include formatting info in our comparisons
		clearFormat(document);

		const sourceDocument = document.findNodeByName("source")?.children;
		assert.ok(sourceDocument != null);

		for (const node of document.findNodesByName("query")) {
			const queryString = node.getArgument(0);
			assert.ok(typeof queryString === "string");

			const query = parseQuery(queryString);

			assert.deepEqual(
				[...query.find(sourceDocument)],
				node.children?.nodes ?? [],
			);
		}
	});
}

test.run();
