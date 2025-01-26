# Compabitility with KDL v1

The `parse` function in this package only supports KDL v2 documents.
If your program wants to be compatible with KDL v1 as well, this package exposes an extra entry point [`@bgotink/kdl/v1-compat`](./reference/v1-compat/index.md).

This entry point exposes two functions: [`parse`](./reference/v1-compat/index.md#parse) and [`parseCompat`](./reference/v1-compat/index.md#parsecompat).
Both functions return a [`Document`](./reference/index/classes/Document.md) that produces valid KDL v2 text, but they differ in what they accept.

- `parse` parses a KDL v1 text
- `parseCocmpat` parses KDL text that's either valid KDL v2 or KDL v1

The `parseCompat` function first tries to parse the text as a KDL v2 document. If that fails, it tries to parse the text as a KDL v1 document.
If both parsers fail, the function throws an `AggregateError` that contains all errors.
The function does not look for a `/- kdl-version <version>` hint in the text.
