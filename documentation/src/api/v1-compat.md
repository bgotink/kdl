# Compabitility with KDL v1

The `parse` function in this package only supports KDL v2 documents.
If your program wants to be compatible with KDL v1 as well, this package exposes an extra entry point: [`@bgotink/kdl/v1-compat`](./reference/v1-compat/index.md).

## Loading compatibility code

The compatibility endpoint is a lot larger and slower than the regular `@bgotink/kdl` endpoint.
Programs that want to provide compatiblity are therefore encouraged to lazy-load the compatibility code, for example:

```js
import {readFile} from "node:fs/promises";
import {parse} from "@bgotink/kdl";

export async function loadConfiguration(path) {
	const content = await readFile(path);

	try {
		return parse(content);
	} catch (e) {
		const {parseWithoutFormatting} = await import("@bgotink/kdl/v1-compat");
		try {
			return parseWithoutFormatting(content);
		} catch (e2) {
			throw new AggregateError(
				[e, e2],
				`Failed to parse configuration at ${path}`,
			);
		}
	}
}
```

### Numbers

Here's a comparison of `@bgotink/kdl` and `@bgotink/kdl/v1-compat` in numbers:

| what                               | `@bgotink/kdl` | `@bgotink/kdl/v1-compat` |
| ---------------------------------- | -------------- | ------------------------ |
| size                               | 81,920 bytes   | 552,783 bytes            |
| size (bundled + minified)          | 24,593 bytes   | 261,295 bytes            |
| size (bundled + minified + zipped) | 7,489 bytes    | 63,315 bytes             |
| benchmark                          | 27k docs/sec   | 17k docs/sec             |

## Two compatibility functions

The compatibility endpoint exposes two functions that parse a KDL v1 text into a [`Document`](./reference/index/classes/Document.md).
Even though both functions yield documents that are functionally equivalent, they serve very different purposes:

- [`parseWithoutFormatting`](./reference/v1-compat/index.md#parsewithoutformatting) reads the KDL v1 text without storing any formatting, whitespace, comments, etc.
  The resulting document can be used everywhere a regular KDL v2 document can be used, but stringifying the document via `format()` will throw out any comments and formatting its author added.
- [`parseAndTransform`](./reference/v1-compat/index.md#parseandtransform) reads the KDL v1 text and transforms any formatting, whitespace, comments, etc. into their KDL v2 equivalent.
  The resulting document can safely be stringified via `format()` to overwrite the original KDL v1 text to automate the migration from KDL v1 to KDL v2.
