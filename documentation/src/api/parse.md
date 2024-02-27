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

Setting the `storeLocations` option to `true` makes location information available in the [`getLocation`](./reference/modules/index.md#getlocation) function.

## Quirks

This package turns KDL documents into JavaScript objects and vice versa. It is therefore limited by the JavaScript language.

### Properties

Multiple properties with the same name are allowed. All duplicated will be preserved, meaning those documents will correctly round-trip. When using `node.getProperty()`/`node.getProperties()`/`node.getPropertyEntry()`, the last property with that name's value will be returned, effectively shadowing any earlier duplicates. Using `node.getPropertyEntries()`/`node.entries` does expose the shadowed duplicates, leaving it up to the caller to handle these. Passing the node through `clearFormat()` removes these shadowed duplicates.

### Numbers

JavaScript stores all numbers as 64-bit [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. This limits what integer values can be used safely. These limits are lower than you might expect if you're used to working in environments that have a separate 64-bit integer data type.

The original representation of parsed numbers is retained, unless `clearFormat` is called on the value or any entry/node/document containing the value.
