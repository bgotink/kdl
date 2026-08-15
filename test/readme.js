import {readFile} from "node:fs/promises";
import {Worker} from "node:worker_threads";
import {suite, test} from "node:test";
import {Lexer} from "marked";

suite("readme", async () => {
	const lexer = new Lexer({
		gfm: true,
		silent: true,
	});

	const readme = lexer.lex(
		await readFile(new URL("../README.md", import.meta.url), "utf-8"),
	);

	for (const [i, {text}] of Iterator.from(readme)
		.filter(
			/** @returns {block is import("marked").Tokens.Code} */ (block) =>
				block.type === "code",
		)
		.filter((block) => block.lang === "js")
		.map((block, i) => /** @type {const} */ ([i, block]))) {
		test(`README code block ${i}`, async () => {
			const worker = new Worker(
				text,
				// @ts-expect-error type field not supported yet in @types/node
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
});
