# LL(1) Grammar

This package uses a modified version of the KDL grammar as defined in [the KDL spec][kdl-spec].
This modified version is [an LL(1) grammar](https://en.wikipedia.org/wiki/LL_grammar).

The KDL string is pre-processed before it is passed through the parser.
This pre-processing takes care of stripping any leading BOM from the text and validates that no illegal characters are present in the text.
This simplifies the grammar quite a bit, and makes it possible to turn certain non-terminal rules in the KDL spec's grammar into terminals.

The definitions of terminals are not included on this page, but they all map onto regular expressions.
Some of the non-terminals in the KDL spec's grammar are implemented as terminals in this grammar.
For example, we've done so in the numbers where JavaScript's `parseInt` and `parseFloat` can do a lot of heavy lifting if we just take the whole number string and remove any underscores and leading `0x`/`0b`/`0o`.

The diagrams on this page are rendered using [railroad-diagrams], a lovely library by Tab Atkins Jr, who happens to be involved in KDL too!

## document

In the KDL spec all `line-space` are used as `line-space*` so to simplify this grammar, the `line-space` itself takes care of the "zero or more" part.

The `document` non-terminal is used in `node-children` below, because distinguishing between `node` and `final-node` as defined in the KDL spec is impossible without unbounded look-ahead.
Instead, the `document` non-terminal is modified to support ending on a `base-node` with or without `node-terminator`.

> There's one downside to this rewritten non-terminal: It works in the LL(1) parser but I am unable to write it down in BNF or any derivative.
> If someone else has any idea, feel free to make the necessary changes!

## plain-node-space

The KDL spec's `plain-node-space` is always used with either the `+` or `*` modifier.
Instead of doing the same, the `plain-node-space` in this grammar is it's own `+`, so it's either used plain for `+` or marked optional for `*`.

## line-space

Compared to the `line-space` defined in the KDL spec, this version includes its own "zero or more" operator.

## node-space

The `optional-node-space` and `required-node-space` non-terminals defined in the KDL spec are combined into a single non-terminal.
This `node-space` non-terminal does one extra thing that isn't shown in the diagram: it remembers whether the last subrule it applied was a `plain-node-space`.

## base-node

The `node-prop-or-arg` and `node-children` paths are only allowed if the last consumed `node-space` ended with a `plain-node-space`.
Note `node-prop-or-arg` always ends on a `node-space`.

## node

## node-prop-or-arg

The `node-prop-or-arg` non-terminal is very different from its sibling in the KDL spec in order to remove any need for look-ahead:

- If the first token is a tag (called type in the spec), then it must be an argument
- If the first token is a number or a keyword, then it must be an argument
- If the first token is a string, then we need to check if there's an equals sign.

Looking for the equals sign required unbounded lookahead thanks to the allowed `node-space` between the property name and the equals sign.
By changing this non-terminal so it also consumes any `node-space` that comes after the property or argument, we can remove the need for the look-ahead.

## node-children

## node-terminator

The `document` non-terminal supports ending on a node without `node-terminator`, so this non-terminal doesn't need to include EOF.

## tag

## escline

## multiline-comment

## single-line-comment

## value

## keyword

The `keyword` non-terminal "allows" invalid keywords, in order to throw an error when such a token is encountered.
This gives us the opportunity to throw a useful error along the lines of "Did you forget to mark a keyword with #?" rather than "Unexpected token InvalidKeyword, expected one of &lt;list of 20 allowed tokens&gt;"

## number

## string

The parser itself is greatly simplified and very lenient when it comes to strings, with post-processing added to filter out invalid strings.
All multiline quoted and raw strings are post-processed to remove leading whitespace.
All quoted strings are post-processed to replace any escapes.

<script type="module" src="./grammar.js"></script>
<link rel="stylesheet" href="./grammar.css">

[kdl-spec]: https://github.com/kdl-org/kdl/blob/main/SPEC.md
[railroad-diagrams]: https://github.com/tabatkins/railroad-diagrams/blob/gh-pages/README-js.md
