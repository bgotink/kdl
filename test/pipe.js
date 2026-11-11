import assert from "node:assert/strict";
import {suite, test} from "node:test";

import {
	Document,
	InvalidKdlError,
	Node,
	clearFormat,
	format,
	formatCompact,
	getLocation,
	parse as _parse,
} from "../src/index.js";
import {parse as parseV1, parseCompat} from "../src/v1-compat.js";

/** @type {typeof _parse} */
// @ts-ignore
const parse = (text, options = {}) => {
	return _parse(text, {
		...options,
		flags: {
			experimentalNodePipes: true,
			.../** @type {{flags?: object}} */ (options).flags,
		},
	});
};

/**
 * @param {string} text
 */
function parseWhitespace(text) {
	return /** @type {import("../src/index.js").WhitespaceInDocument} */ (
		/** @type {unknown} */ (parse(text, {as: "whitespace in document"}))
	);
}

/**
 * Assert the given pipe text parses into the same document as the nested text
 *
 * @param {string} pipe
 * @param {string} nested
 */
function assertEquivalent(pipe, nested) {
	assert.deepEqual(clearFormat(parse(pipe)), clearFormat(_parse(nested)));
}

/**
 * @param {string} text
 */
function assertRoundTrip(text) {
	assert.equal(format(parse(text)), text);
}

const examplePipe = String.raw`
app {
	route "/users" { handler list-users #> auth role=admin #> cache ttl=(s)60 #> log }
	route "/orders" { static "public"; handler list-orders #> auth #> retry times=3 }
}
`;

const exampleNested = String.raw`
app {
	route "/users" { log { cache ttl=(s)60 { auth role=admin { handler list-users } } } }
	route "/orders" { static "public"; retry times=3 { auth { handler list-orders } } }
}
`;

suite("node pipes", () => {
	suite("semantics", () => {
		test("a single pipe", () => {
			assertEquivalent(
				'text "Hello" #> padding 8',
				'padding 8 { text "Hello" }',
			);
		});

		test("chains are left-associative", () => {
			assertEquivalent("a #> b #> c", "c { b { a; }; }");
			assertEquivalent(examplePipe, exampleNested);
		});

		test("the left-hand side can have children", () => {
			assertEquivalent(
				"sprite hero { frame 1; frame 2 } #> loop 4",
				"loop 4 { sprite hero { frame 1; frame 2 } }",
			);
		});

		test("the right-hand side cannot have children", () => {
			assert.throws(
				() => parse('text "Hello" #> padding 8 { border }'),
				InvalidKdlError,
			);
		});

		test("tags are kept on every stage", () => {
			assertEquivalent("(t)a 1 #> (u)b 2", "(u)b 2 { (t)a 1 }");
		});

		test("pipes can be used in children", () => {
			assertEquivalent("x { a #> b; c }", "x { b { a }; c }");
		});
	});

	suite("the #> token", () => {
		test("whitespace around #> is optional", () => {
			assertEquivalent("a#>b", "b { a }");
			assertEquivalent("a #>b", "b { a }");
			assertEquivalent("a#> b", "b { a }");
			assertEquivalent("a 1#>b", "b { a 1 }");
			assertEquivalent('a "x"#>b', 'b { a "x" }');
			assertEquivalent("r#>b", "b { r }");
		});

		test("without the flag, #> is invalid", () => {
			for (const text of ["a #> b", "a#>b", "a #>b", "a#> b"]) {
				assert.throws(() => _parse(text), InvalidKdlError, text);
			}
		});

		test("number suffixes take precedence over pipes", () => {
			const flags = {experimentalSuffixedNumbers: true};

			const suffixed = parse("n 6#> x", {flags});
			assert.equal(suffixed.nodes.length, 1);
			assert.deepEqual(suffixed.nodes[0].getArguments(), [6, "x"]);
			assert.equal(suffixed.nodes[0].entries[0].getTag(), ">");

			assert.deepEqual(
				clearFormat(parse("n 6 #> x", {flags})),
				clearFormat(_parse("x { n 6 }")),
			);
		});

		test("#> is not a value", () => {
			assert.throws(() => parse("a k=#> b"), InvalidKdlError);
			assert.throws(() => parse("a (#>)b"), InvalidKdlError);
		});
	});

	suite("multiline chains", () => {
		test("trailing #>", () => {
			assertEquivalent(
				'source "orders.csv" #>\n\tfilter status=paid #>\n\tsort total',
				'sort total { filter status=paid { source "orders.csv" } }',
			);
		});

		test("leading #>", () => {
			assertEquivalent(
				'source "orders.csv"\n\t#> filter status=paid\n\t#> sort total\nnext',
				'sort total { filter status=paid { source "orders.csv" } }; next',
			);
		});

		test("comments and blank lines between stages", () => {
			assertEquivalent(
				'source "orders.csv" // comment\n\n\t/* more */ #> filter status=paid\n\n\t#> sort total',
				'sort total { filter status=paid { source "orders.csv" } }',
			);
			assertEquivalent("a #> // comment\n\tb", "b { a }");
		});

		test("leading #> continues the preceding node, even if slashdashed", () => {
			assertEquivalent("a\n/- b\n#> c", "a");
			assertEquivalent("a\n/- b\n#> c\nd", "a; d");
		});

		test("leading #> in children", () => {
			assertEquivalent("x {\n\ta\n\t#> b\n\tc\n}", "x {\n\tb { a }\n\tc\n}");
		});

		test("a semicolon ends the chain", () => {
			assert.throws(() => parse("a; #> b"), InvalidKdlError);
			assert.throws(() => parse("a;\n#> b"), InvalidKdlError);
		});

		test("#> requires a node before it", () => {
			assert.throws(() => parse("#> b"), InvalidKdlError);
			assert.throws(() => parse("\n\t#> b"), InvalidKdlError);
			assert.throws(() => parse("x { #> b }"), InvalidKdlError);
			assert.throws(() => parse("a #>"), InvalidKdlError);
			assert.throws(() => parse("a #> #> b"), InvalidKdlError);
		});

		test("parsing a single node", () => {
			assert.deepEqual(
				clearFormat(parse("a #> b", {as: "node"})),
				clearFormat(_parse("b { a }", {as: "node"})),
			);
			assert.deepEqual(
				clearFormat(parse("a\n#> b\n", {as: "node"})),
				clearFormat(_parse("b { a }", {as: "node"})),
			);
		});
	});

	suite("slashdash", () => {
		test("slashdash before the chain drops the chain", () => {
			assertEquivalent(
				'/- image "photo.jpg" #> resize width=800 #> grayscale\nnext',
				"next",
			);
			assertEquivalent(
				'/- image "photo.jpg"\n#> resize width=800\n#> grayscale\nnext',
				"next",
			);
		});

		test("slashdash before #> drops a stage", () => {
			assertEquivalent(
				'text "Hello" /-#> padding 8 #> center',
				'center { text "Hello" }',
			);
			assertEquivalent(
				'text "Hello" /- #> padding 8 #> center',
				'center { text "Hello" }',
			);
			assertEquivalent(
				"sprite hero { frame 1 } /-#> loop 4 #> delay 2",
				"delay 2 { sprite hero { frame 1 } }",
			);
			assertEquivalent(
				'text "Hello"\n\t/-#> padding 8\n\t#> center',
				'center { text "Hello" }',
			);
		});

		test("slashdash on the final stage", () => {
			assertEquivalent("a #> b /-#> c", "b { a }");
			assertEquivalent("a #> b\n/-#> c\nd", "b { a }; d");
			assertEquivalent("a /-#> c", "a");
		});

		test("slashdash before the chain across lines", () => {
			assertEquivalent(
				'/- image "photo.jpg"\n\t#> resize width=800\n\n\t// note\n\t#> crop ratio="16/9"\n\t#> grayscale\nnext',
				"next",
			);
			assertEquivalent("/- a #>\n\tb #> c\nnext", "next");
			assertEquivalent("/- a { x\n\ty } #> c\nnext", "next");
			assertEquivalent('/- a "x;y" #> b; d', "d");
			assertEquivalent("x {\n\t/- a\n\t#> b\n}", "x {}");
		});

		test("trailing slashdashed #> drops the next stage", () => {
			assertEquivalent(
				'source "orders.csv" #>\n\tfilter status=paid /-#>\n\tgroup-by customer #>\n\tsort total order=desc',
				'sort total order=desc { filter status=paid { source "orders.csv" } }',
			);
			assertEquivalent("a /-#>   \n\tb\nc", "a; c");
			assertEquivalent("a /-#>\n\n\tb\nc", "a; c");
		});

		test("slashdashed stage ends at the end of the node", () => {
			assertEquivalent("a #> b /-#> c; d", "b { a }; d");
			assertEquivalent("x { a /-#> b }", "x { a }");
		});
	});

	suite("formatting", () => {
		test("round-trip", () => {
			assertRoundTrip(examplePipe);
			assertRoundTrip('text "Hello"#>padding 8');
			assertRoundTrip("a { b } #> c");
			assertRoundTrip("a{b}#>c");
			assertRoundTrip("(t)a 1 #> (u)b 2");
			assertRoundTrip(
				'source "orders.csv" #>\n\tfilter status=paid #>\n\tsort total\n',
			);
			assertRoundTrip(
				'source "orders.csv"\n\t#> filter status=paid // comment\n\n\t#> sort total\n',
			);
			assertRoundTrip('/- image "photo.jpg" #> grayscale\nnext\n');
			assertRoundTrip('text "Hello" /-#> padding 8 #> center');
			assertRoundTrip('text "Hello"\n\t/-#> padding 8\n\t#> center\n');
			assertRoundTrip("a #> b /-#> c\n");
			assertRoundTrip("a #> b\n/-#> c\nd\n");
			assertRoundTrip("x {\n\ta\n\t#> b\n\tc\n}\n");
		});

		test("editing the piped node in place keeps the pipe", () => {
			const document = parse("a #> b");
			const a = /** @type {Document} */ (document.nodes[0].children).nodes[0];
			a.addArgument(1);

			assert.equal(format(document), "a 1 #> b");
		});

		test("editing the piped node's children keeps the pipe", () => {
			const document = parse("a #> b #> c");
			const b = /** @type {Document} */ (document.nodes[0].children).nodes[0];
			b.addArgument(1);

			assert.equal(format(document), "a #> b 1 #> c");
		});

		test("adding a child falls back to the nested form", () => {
			const document = parse("a #> b");
			document.nodes[0].appendNode(Node.create("c"));

			assert.equal(format(document), "b {\n\ta\n\tc\n}");
		});

		test("replacing the child falls back to the nested form", () => {
			const document = parse("a #> b");
			const b = document.nodes[0];
			b.replaceNode(
				/** @type {Document} */ (b.children).nodes[0],
				Node.create("z"),
			);

			assert.equal(format(document), "b {\n\tz\n}");
		});

		test("removing the child falls back to the nested form", () => {
			const document = parse("a #> b");
			const b = document.nodes[0];
			b.removeNode(/** @type {Document} */ (b.children).nodes[0]);

			assert.equal(format(document), "b {}");
		});

		test("clearFormat and formatCompact yield the nested form", () => {
			assert.equal(
				format(clearFormat(parse(examplePipe))),
				format(clearFormat(_parse(exampleNested))),
			);
			assert.equal(
				formatCompact(parse(examplePipe)),
				formatCompact(_parse(exampleNested)),
			);
		});

		test("clone keeps the pipe", () => {
			const document = parse(examplePipe);
			const clone = document.clone();

			assert.equal(format(clone), examplePipe);

			const b = parse("a #> b").clone().nodes[0];
			assert(b.pipe);
			assert.equal(b.pipe.child, b.children?.nodes[0]);
		});
	});

	test("locations only cover the node itself", () => {
		const document = parse('text "Hello" #> padding 8', {
			storeLocations: true,
		});
		const padding = document.nodes[0];
		const text = /** @type {Document} */ (padding.children).nodes[0];

		assert.equal(getLocation(padding)?.start.offset, 16);
		assert.equal(getLocation(text)?.start.offset, 0);
		assert(/** @type {number} */ (getLocation(text)?.end.offset) <= 13);

		const graphemes = parse("text 🏳️‍🌈#>center", {
			storeLocations: true,
			graphemeLocations: true,
		});
		assert.equal(format(graphemes), "text 🏳️‍🌈#>center");
		assert.equal(getLocation(graphemes.nodes[0])?.start.column, 9);
	});

	test("whitespace", () => {
		const document = parse("a #> b /-#> c\n");
		const whitespace = parseWhitespace(document.nodes[0].trailing ?? "");

		assert.equal(whitespace.length, 2);
		assert.deepEqual(whitespace[0], {type: "space", text: " "});

		const slashdash = whitespace[1];
		assert(slashdash.type === "slashdash" && "pipe" in slashdash);
		assert.equal(slashdash.pipe, true);
		assert.deepEqual(slashdash.preface, []);
		assert.equal(slashdash.value.getName(), "c");
		assert.equal(slashdash.value.leading, " ");
		assert.equal(slashdash.value.trailing, "\n");

		const chain = parseWhitespace("/- a #> b\n");
		assert.equal(chain.length, 1);
		assert(chain[0].type === "slashdash");
		assert.equal(chain[0].value.getName(), "b");

		const multiline = parseWhitespace("/- a\n#> b\n");
		assert.equal(multiline.length, 1);
		assert(multiline[0].type === "slashdash");
		assert.equal(multiline[0].value.getName(), "b");

		// a semicolon ends the chain, in both parsers
		assert.throws(() => parse("/- a;\n#> b\n"), InvalidKdlError);
		assert.throws(() => parseWhitespace("/- a;\n#> b\n"), InvalidKdlError);

		// a slashdashed stage doesn't end the chain, in both parsers
		const text = "/- a\n/-#> b\n#> c\n";
		assert.doesNotThrow(() => parse(text));
		const stages = parseWhitespace(text);
		assert.equal(stages.length, 2);
		assert(stages[1].type === "slashdash" && "pipe" in stages[1]);
		assert.equal(stages[1].value.getName(), "c");
		assert.equal(stages[1].value.children?.nodes[0]?.getName(), "b");
	});

	test("v1 compatibility", () => {
		assert.throws(() => parseV1("a #> b"));
		assertEquivalent("a #> b", "b { a }");
		assert.deepEqual(
			clearFormat(
				parseCompat("a #> b", {flags: {experimentalNodePipes: true}}),
			),
			clearFormat(_parse("b { a }")),
		);
	});
});
