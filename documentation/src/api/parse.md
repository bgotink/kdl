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

## Quirks

This package turns KDL documents into JavaScript objects and vice versa. It is therefore limited by the JavaScript language.

### Properties

Multiple properties with the same name are allowed. All duplicated will be preserved, meaning those documents will correctly round-trip. When using `node.getProperty()`/`node.getProperties()`/`node.getPropertyEntry()`, the last property with that name's value will be returned, effectively shadowing any earlier duplicates. Using `node.getPropertyEntries()`/`node.entries` does expose the shadowed duplicates, leaving it up to the caller to handle these. Passing the node through `clearFormat()` removes these shadowed duplicates.

### Numbers

JavaScript stores all numbers as 64-bit [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. This limits what integer values can be used safely. These limits are lower than you might expect if you're used to working in environments that have a separate 64-bit integer data type.

The original representation of parsed numbers is retained, unless `clearFormat` is called on the value or any entry/node/document containing the value.

[getLocation]: ./reference/index/index.md#getlocation
