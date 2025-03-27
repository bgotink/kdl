# LL(1) Parser

This package contains [an LL(1) parser](https://en.wikipedia.org/wiki/LL_parser), i.e. the parser iterates over the tokens without having to backtrack or look ahead.
The parser achieves this by using a modified version of the KDL grammar defined in [the KDL spec][kdl-spec].

The parser iterates over the text per [code point](https://en.wikipedia.org/wiki/Code_point) or per [grapheme](https://en.wikipedia.org/wiki/Grapheme), depending on the value of the `graphemeLocations` option.
It then looks at the first code point of every value (graphemes can contain multiple code points) and filters out code points disallowed by the KDL spec.

The parser works in two stages. First, it turns the stream of code points (or graphemes) into a stream of tokens.
Then it iterates over the token stream to result in the KDL document.

The diagrams on this page are rendered using [railroad-diagrams], a lovely library by Tab Atkins Jr, who happens to be involved in KDL too!

## Error handling

The tokenizer and parser can throw two kinds of errors: recoverable and non-recoverable.
In fact, a recoverable error is not really thrown but rather tracked separately (in the token or in the parser context).

At the end, if both the tokenizer and parser have found no non-recoverable error, all recoverable errors are thrown in a single error object.
This gives the calling code more context to what is wrong in the document, with the option to show the human who wrote the KDL document everything that's wrong in their document in one go.

## Tokenizer

The first step of the parser turns the stream of code points (or graphemes) into a stream of tokens.
A token is an object with the following properties:

- `type`: the token type
- `text`: the text of the token, this can contain multiple code points / graphemes
- `start`: the location of the first code point of this token in the source text
- `end`: the location of the first code point after this token in the source text
- `error`: any recoverable error that occurred while processing the text for this token

The `start` and `end` locations are used when throwing errors upon encountering invalid KDL text, so these are stored even if the `storeLocations` option is false.
These locations contain three properties: `offset` is the zero-indexed location of the character in the text, `line` and `column` are the one-indexed line and column positions. The `offset` can be used to programmatically find the token in the text, `line` and `column` are more interesting for human readers to e.g. see where in the document they've made a mistake.

Token types are stored as integer, rather than a human readable string because of two reasons.
Firstly, "human readable" doesn't mean "the person running the parser understands it", so the usefulness of string types is questionable.
Secondly, string comparison is slower than number comparison.

That speed bump granted by number comparison is also why the tokenizer looks at the code point's integer value to split the text into tokens rather than compare string values.
Regular expressions are avoided entirely in the tokenizer.

## Parser

The parser is a "recursive descent" parser.
That means the starts at the top-level, e.g. `parseDocument` when asked to parse a document, and that function recurses into other parser functions, e.g. `parseNode` to parse each individual node.

### document

In the KDL spec all `line-space` are used as `line-space*` so to simplify this grammar, the `line-space` itself takes care of the "zero or more" part.

The `document` non-terminal is used in `node-children` below, because distinguishing between `node` and `final-node` as defined in the KDL spec is impossible without unbounded look-ahead.
Instead, the `document` non-terminal is modified to support ending on a `base-node` with or without `node-terminator`.

> There's one downside to this rewritten non-terminal: It works in the LL(1) parser but I am unable to write it down in BNF or any derivative.
> If someone else has any idea, feel free to make the necessary changes!

### node-space

The KDL spec's `node-space` is always used with either the `+` or `*` modifier.
Instead of doing the same, the `node-space` in this grammar is it's own `+`, so it's either used plain for `+` or marked optional for `*`.

The official `node-space` is written as `ws* escline ws* | ws+`, but since `node-space` is only ever used with `+` or `*`, it is functionally equivalent with `escline | ws`.

### line-space

Compared to the `line-space` defined in the KDL spec, this version includes its own "zero or more" operator and it inlines `node-space` instead of referencing the non-terminal.

### slashdash

### base-node

The `base-node` non-terminal differs quite a bit from the one described in the KDL spec in order to remove any ambiguity for our LL(1) parser.

The diagram above fails to show two things:

- There can only be one non-slashdashed `node-children` block in the `base-node`.
  This is validated separately in the parser.
- The `node-prop-or-arg` rule actually already checks for the existence of `node-space`.
  That result is used in parsing the `base-node`, instead of requiring multiple consecutive `node-space`s (which would be impossible anyway since `node-space` is a repetition).

### node

### node-prop-or-arg

The `node-prop-or-arg` non-terminal is very different from its sibling in the KDL spec in order to remove any need for look-ahead:

- If the first token is a tag (called type in the spec), then it must be an argument
- If the first token is a number or a keyword, then it must be an argument
- If the first token is a string, then we need to check if there's an equals sign.

Looking for the equals sign requires unbounded lookahead thanks to the allowed `node-space` between the property name and the equals sign.
By changing this non-terminal so it also consumes any `node-space` that comes after the property or argument, we can remove the need for the look-ahead.

### node-children

### node-terminator

The `document` non-terminal supports ending on a node without `node-terminator`, so this non-terminal doesn't need to include EOF.

### tag

### escline

### multiline-comment

### single-line-comment

### value

### keyword

### number

### string

The parser itself is greatly simplified and very lenient when it comes to strings, with post-processing added to filter out invalid strings.
All multiline quoted and raw strings are post-processed to remove leading whitespace.
All quoted strings are post-processed to replace any escapes.

<script type="module" src="./grammar.js"></script>
<link rel="stylesheet" href="./grammar.css">

[kdl-spec]: https://github.com/kdl-org/kdl/blob/main/SPEC.md
[railroad-diagrams]: https://github.com/tabatkins/railroad-diagrams/blob/gh-pages/README-js.md
