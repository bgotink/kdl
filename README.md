# `@bgotink/kdl`

This package contains a parser and stringifier for the [KDL Document Language][kdl-site], a node-based, human-friendly configuration and serialization format.

The parser in this package focuses on parsing documents in a way that allows for format-preserving modifications. This is most useful when working with KDL files maintained by humans.

If you don't care about formatting or programmatic manipulation, you might want to check out the official parser [`kdljs`][kdljs] instead.

> [!CAUTION]
> This package handles KDL 2.0.0-draft.4, a draft of the KDL v2 spec.
> There might still be breaking changes to that specification before it is finalized.
>
> Use version 0.1.6 of this package if you want a stable version that supports KDL v1.

## Install

```sh
yarn add @bgotink/kdl
```

## Usage

```js
import {parse, format} from "@bgotink/kdl";

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

expect(format(doc)).toBe(String.raw`
	node "value" #"other value"# 2.0 4 #false \
			#null -0 {
		child /-lorem="ipsum" \
			dolor=#true; "child too"
	}
`);
```

## JSON-in-KDL (JiK)

This package exports function from `@bgotink/kdl/json` to parse and stringify KDL documents as JSON-in-KDL (JiK) 4.0.0. For information on the format, see [the JiK 4.0.0 specification][jik-spec].

```js
import {parse} from "@bgotink/kdl/json";

expect(
	parse(
		String.raw`
			- {
				prop false
				otherProp {
					- 0
					- 2
					- 4
				}
			}
		`,
	),
).toEqual({
	prop: false,
	otherProp: [0, 2, 4],
});
```

There are four functions:

- `parse` and `stringify` turn text into the encoded JSON value and back. These functions are useful for encoding/decoding entire JiK files.
- `toJson` and `fromJson` turn KDL nodes into the encoded JSON value and back. These functions give more fine-grained control over the output, and can be used for e.g. encoding/decoding a JiK node embedded in a KDL document.

## Quirks

This package turns KDL documents into JavaScript objects and vice versa. It is therefore limited by the JavaScript language.

### Properties

Multiple properties with the same name are allowed. All duplicated will be preserved, meaning those documents will correctly round-trip. When using `node.getProperty()`/`node.getProperties()`/`node.getPropertyEntry()`, the last property with that name's value will be returned, effectively shadowing any earlier duplicates. Using `node.getPropertyEntries()`/`node.entries` does expose the shadowed duplicates, leaving it up to the caller to handle these. Passing the node through `clearFormat()` removes these shadowed duplicates.

### Numbers

JavaScript stores all numbers as 64-bit [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. This limits what integer values can be used safely. These limits are lower than you might expect if you're used to working in environments that have a separate 64-bit integer data type.

The original representation of parsed numbers is retained, unless `clearFormat` is called on the value or any entry/node/document containing the value.

## License & Notice

This package is licensed under the MIT license, which can be found in `LICENSE.md`.

The test suite at `test/upstream` is part of the [KDL specification][kdl-spec-repo] and is available under the Creative Commons Attribution-ShareAlike 4.0 International License.

This package wouldn't be possible without software that other people graciously made open source:

The code in this package is heavily influenced by the [`kdl` crate][kdl-rs], available under the Apache 2.0 license.
Some token expressions have been copied out of the official [`kdljs`][kdljs] parser, available under the MIT license.

This package bundles it dependencies when published to npm:

- [Chevrotain](https://chevrotain.io/), available under the Apache 2.0 license
  Copyright (c) 2021 the original author or authors from the Chevrotain project
  Copyright (c) 2015-2020 SAP SE or an SAP affiliate company.
- [lodash](https://lodash.com/), available under the MIT license

[kdl-site]: https://kdl.dev/
[kdl-spec-repo]: https://github.com/kdl-org/kdl
[kdl-rs]: https://github.com/kdl-org/kdl-rs
[kdljs]: https://github.com/kdl-org/kdljs
[jik-spec]: https://github.com/kdl-org/kdl/blob/76d5dd542a9043257bc65476c0a70b94667052a7/JSON-IN-KDL.md
