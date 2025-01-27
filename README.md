# `@bgotink/kdl`

This package contains a parser and stringifier for the [KDL Document Language][kdl-site], a node-based, human-friendly configuration and serialization format.

The parser in this package focuses on parsing documents in a way that allows for format-preserving modifications. This is most useful when working with KDL files maintained by humans.

## Install

```sh
yarn add @bgotink/kdl
# or
npm install @bgotink/kdl
# or
pnpm add @bgotink/kdl
# or ...
```

## Usage

The examples below assume a Node.js environment.
The `@bgotink/kdl` package works in any javascript runtime, including browsers, as long as it supports relatively modern browser standards.
If you're trying to run these samples in a non-Node.js runtime, replace the import for `assert` with something equivalent in your runtime.

```js
import {parse, format} from "@bgotink/kdl";
import assert from "node:assert/strict";

const doc = parse(String.raw`
	node "value" #"other value"# 2.0 4 #false \
			#null -0 {
		child; "child too"
	}
`);

doc.nodes[0].children.nodes[0].entries.push(
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
```

## JSON-in-KDL (JiK)

This package exports function from `@bgotink/kdl/json` to parse and stringify KDL documents as JSON-in-KDL (JiK) 4.0.0. For information on the format, see [the JiK 4.0.0 specification][jik-spec].

```js
import {parse} from "@bgotink/kdl/json";
import assert from "node:assert/strict";

assert.deepEqual(
	parse(
		String.raw`
			- {
				prop #false
				otherProp {
					- 0
					- 2
					- 4
				}
			}
		`,
	),
	{
		prop: false,
		otherProp: [0, 2, 4],
	},
);
```

There are four functions:

- `parse` and `stringify` turn text into the encoded JSON value and back. These functions are useful for encoding/decoding entire JiK files.
- `toJson` and `fromJson` turn KDL nodes into the encoded JSON value and back. These functions give more fine-grained control over the output, and can be used for e.g. encoding/decoding a JiK node embedded in a KDL document.

## (De)Serialization

The package contains utilities for (de)serialization in `@bgotink/kdl/dessert`.

```js
import {parse} from "@bgotink/kdl/dessert";
import assert from "node:assert/strict";

assert.deepEqual(
	parse(
		String.raw`
			name "my-package"
			
			dependency "@bgotink/kdl" range="^0.2.0"
			dependency "prettier" range="^3" dev=#true
		`,
		(ctx) => {
			const dependencies = {};
			const devDependencies = {};

			const name = ctx.child.single.required("name", (ctx) =>
				ctx.argument.required("string"),
			);

			for (const dependency of ctx.children("dependency", (ctx) => ({
				name: ctx.argument.required("string"),
				range: ctx.property("range", "string") ?? "*",
				dev: ctx.property("dev", "boolean") ?? false,
			}))) {
				(dependency.dev ? devDependencies : dependencies)[dependency.name] =
					dependency.range;
			}

			return {name, dependencies, devDependencies};
		},
	),
	{
		name: "my-package",
		dependencies: {
			"@bgotink/kdl": "^0.2.0",
		},
		devDependencies: {
			prettier: "^3",
		},
	},
);
```

## KDL v1

The package exports two functions from `@bgotink/kdl/v1-compat` to support documents written in KDL v1:

- `parse` parses a KDL v1 document and transforms all linked formatting information to turn it into a valid KDL v2 document.
  If the resulting document is passed to `format()`, the resulting string will be the same document but in KDL v2 syntax. It will include all comments and formatting applied by the original document's author.
- `parseCompat` parses a document that's either KDL v2 or KDL v1 and returns a valid KDL v2 document.
  This is a helper function that combines the regular `parse` function with the v1-compat `parse` function into a single function that supports both formats.

## Quirks

This package turns KDL documents into JavaScript objects and vice versa. It is therefore limited by the JavaScript language.

### Properties

Multiple properties with the same name are allowed. All duplicated will be preserved, meaning those documents will correctly round-trip. When using `node.getProperty()`/`node.getProperties()`/`node.getPropertyEntry()`, the last property with that name's value will be returned, effectively shadowing any earlier duplicates. Using `node.getPropertyEntries()`/`node.entries` does expose the shadowed duplicates, leaving it up to the caller to handle these. Passing the node through `clearFormat()` removes these shadowed duplicates.

### Numbers

JavaScript stores all numbers as 64-bit [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. This limits what integer values can be used safely. These limits are lower than you might expect if you're used to working in environments that have a separate 64-bit integer data type.

The original representation of parsed numbers is retained, unless `clearFormat` is called on the value or any entry/node/document containing the value.

## License

This package is licensed under the MIT license, which can be found in `LICENSE.md`.

The test suite at `test/upstream` is part of the [KDL specification][kdl-spec-repo] and is available under the Creative Commons Attribution-ShareAlike 4.0 International License.

[kdl-site]: https://kdl.dev/
[kdl-spec-repo]: https://github.com/kdl-org/kdl
[kdl-rs]: https://github.com/kdl-org/kdl-rs
[kdljs]: https://github.com/kdl-org/kdljs
[jik-spec]: https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
