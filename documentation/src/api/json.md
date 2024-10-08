# JSON-in-KDL

The `@bgotink/kdl/json` package entrypoint exposes functions to handle JSON-in-KDL, aka JiK.
There are two families of functions:

The [`parse`](./reference/json/index.md#parse) and [`stringify`](./reference/json/index.md#stringify) functions are built to be a drop-in replacement for the [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) and [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) functions.
These functions work well for managing entire JiK files.

The [`toJson`](./reference/json/index.md#tojson) and [`fromJson`](./reference/json/index.md#fromjson) functions allow for more fine-grained control.
There are extra options that support some none-standard JiK behaviour.
Most importantly they work with a KDL `Node`, which makes these functions support JiK nodes embedded into regular a KDL document.

All of these functions throw an [`InvalidJsonInKdlError`](./reference/json/classes/InvalidJsonInKdlError.md) if they encounter invalid JiK content.
