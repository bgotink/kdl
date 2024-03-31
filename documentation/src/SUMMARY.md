# Summary

[KDL](./README.md)

# API

- [Parsing KDL](./api/parse.md)
- [Formatting KDL](./api/format.md)
- [JSON-in-KDL](./api/json.md)
- [API Reference](./api/reference/index.md)
  - [`@bgotink/kdl`](./api/reference/modules/index.md)
    - [Document](./api/reference/classes/index.Document.md)
    - [Node](./api/reference/classes/index.Node.md)
    - [Entry](./api/reference/classes/index.Entry.md)
    - [Tag](./api/reference/classes/index.Tag.md)
    - [Identifier](./api/reference/classes/index.Identifier.md)
    - [Value](./api/reference/classes/index.Value.md)
    - [InvalidKdlError](./api/reference/classes/index.InvalidKdlError.md)
    - [Location](./api/reference/interfaces/index.Location.md)
  - [`@bgotink/kdl/json`](./api/reference/modules/json.md)
    - [InvalidJsonInKdlError](./api/reference/classes/json.InvalidJsonInKdlError.md)
    - [FromJsonOptions](./api/reference/interfaces/json.FromJsonOptions.md)
    - [JiKReviver](./api/reference/interfaces/json.JiKReviver.md)
    - [JsonObject](./api/reference/interfaces/json.JsonObject.md)
    - [StringifyOptions](./api/reference/interfaces/json.StringifyOptions.md)
    - [ToJsonOptions](./api/reference/interfaces/json.ToJsonOptions.md)
    - [ToJsonReviver](./api/reference/interfaces/json.ToJsonReviver.md)
    - [ToJsonType](./api/reference/interfaces/json.ToJsonType.md)

# Internals

- [LL(1) Parser](./internals/parser.md)
