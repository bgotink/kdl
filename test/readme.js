import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {Worker} from "node:worker_threads";
import {Lexer} from "marked";
import {test} from "uvu";

import {Document, format, parse} from "../src/index.js";

if (process.versions.node > "22") {
	const lexer = new Lexer({
		gfm: true,
		silent: true,
	});

	const readme = lexer.lex(
		await readFile(new URL("../README.md", import.meta.url), "utf-8"),
	);

	for (const [i, {text}] of /** @type {import("marked").Tokens.Code[]} */ (
		readme.filter((block) => block.type === "code" && block.lang === "js")
	).entries()) {
		test(`README code block ${i}`, async () => {
			const worker = new Worker(
				`
			import assert from "node:assert/strict";
		
			${text}
			`,
				{eval: true, type: "module"},
			);

			let error = null;
			worker.on("error", (e) => (error = e));

			await new Promise((resolve) => worker.once("exit", resolve));

			if (error) {
				throw error;
			}
		});
	}
} else {
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
}

test.run();
