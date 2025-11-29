# Parsing KDL

The `parse(text[, options])` function parses a KDL document. The text can be passed in as string, Node.js buffer, TypedArray, ArrayBuffer, or DataView.

You can pass the `as` option to make the function parse something different from a KDL document:

```js
import {parse, Document, Node} from "@bgotink/kdl";

assert(
	parse(
		String.raw`
			node Lorem Ipsum
		`,
	) instanceof Document,
);

assert(
	parse(
		String.raw`
			node Lorem Ipsum
		`,
		{as: "node"},
	) instanceof Node,
);
```

## Errors

The `parse` function throws [`InvalidKdlError`s](./reference/index/classes/InvalidKdlError.md) when an error occurs.
The parser tries to recover from many errors so it can provide as much feedback as possible in a single run.
This greatly helps when using the parser to provide feedback to the human author of a KDL document, as you can provide them with multiple mistakes in a single go instaed of showing only the first error every single time.

A single `InvalidKdlError` object might describe multiple actual errors in the document.
The `flat()` method returns an iterator that yields every KDL error contained within the error.
If the error doesn't have any more details, the `flat()` iterator only yields the error itself..

## Locations

Setting the `storeLocations` option to `true` makes location information available in the [`getLocation`][getLocation] function.

## Two ways of tracking columns

By default the columns in error messages and in [`getLocation`][getLocation] results are tracked by code point.
This means that characters that span multiple code points will move the column forward quite a bit.
For example: `😅` is a single code point but `🏳️‍🌈` consists of four code points.

Setting the `graphemeLocations` option to `true` instead track columns by grapheme.
A grapheme is what we humans perceive as a single character.
The pride flag that consists of four code points is a single grapheme.

Tracking by code points is the default for the simple reason that it seems to match how columns are tracked in editors like VS Code or Zed.
There's also a 6.5x speed difference between the two methods, but even with `graphemeLocations` enabled the parser succeeds in parsing thousands of documents per second.

## Parser flags

The `parse` function accepts optional flags to define parser behaviour.
There is currently a single flag:

- [`experimentalSuffixedNumbers`](./reference/index/index.md#experimentalsuffixednumbers): if enabled, numbers can have a suffix tag (e.g. `10px` is equivalent to `(px)10`).
  This suffix is used as tag for the value, which implies a number cannot have both a tag and a suffix.
  The following limitations apply unless a `#` is used as separator:

  - Binary, octal, and hexadecimal numbers cannot have a suffix, only decimal numbers
  - Decimal numbers cannot have both an exponent and a suffix, e.g. `1e1lorem` is invalid
  - A suffix cannot start with a letter followed by a digit or an underscore (`_`)
  - A suffix cannot start with `x` or `X` followed by the letter a through f or A through F
  - A suffix cannot start on a dot (`.`) or comma (`,`)

```js
import {parse} from "@bgotink/kdl";

assert.throws(() => parse("node 10px"));

assert.doesNotThrow(() =>
	parse("node 10px", {
		flags: {
			experimentalSuffixedNumbers: true,
		},
	}),
);
```

## Quirks

This package turns KDL documents into JavaScript objects and vice versa. It is therefore limited by the JavaScript language.

### Properties

Multiple properties with the same name are allowed. All duplicated will be preserved, meaning those documents will correctly round-trip. When using `node.getProperty()`/`node.getProperties()`/`node.getPropertyEntry()`, the last property with that name's value will be returned, effectively shadowing any earlier duplicates. Using `node.getPropertyEntries()`/`node.entries` does expose the shadowed duplicates, leaving it up to the caller to handle these. Passing the node through `clearFormat()` removes these shadowed duplicates.

### Numbers

JavaScript stores all numbers as 64-bit [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. This limits what integer values can be used safely. These limits are lower than you might expect if you're used to working in environments that have a separate 64-bit integer data type.

The original representation of parsed numbers is retained, unless `clearFormat` is called on the value or any entry/node/document containing the value.

[getLocation]: ./reference/index/index.md#getlocation
