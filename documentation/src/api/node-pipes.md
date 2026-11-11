# Node pipes (experimental)

> This is an experimental extension of KDL, enabled with the `experimentalNodePipes` [parser flag](./parse.md#parser-flags).
> Documents using it are not valid KDL for other parsers.

Node pipes let you write deeply nested single-child structures as a left-to-right chain.

```kdl
route "/users" { handler list-users #> auth role=admin #> cache ttl=60 #> log }

// is equivalent to

route "/users" { log { cache ttl=60 { auth role=admin { handler list-users } } } }
```

```js
import {parse} from "@bgotink/kdl";

const document = parse(
	'task fetch url="https://example.com" #> timeout 5 #> retry times=3',
	{flags: {experimentalNodePipes: true}},
);
```

## Semantics

`A #> B` is equivalent to `B { A }`: the node on the left becomes the sole child of the node on the right.
Chains are left-associative: `A #> B #> C` is equivalent to `C { B { A } }`.

The left-hand side of `#>` is always a single node, which may have children of its own:

```kdl
sprite hero { frame 1; frame 2 } #> loop 4 #> ease in-out #> delay 2

// is equivalent to

delay 2 { ease in-out { loop 4 { sprite hero { frame 1; frame 2 } } } }
```

The right-hand side of `#>` cannot have a children block. `text "Hello" #> padding 8 { border }` is invalid. Use the nested form instead.

The parsed document is identical to the nested form: queries, (de)serialization, and all other APIs see regular nested nodes.

## The `#>` token

`#>` is a pipe wherever it appears between nodes, with or without surrounding whitespace: `a #> b`, `a#>b`, and `a #>b` are all equivalent.

Parsers without this extension reject documents that use node pipes.
Enabling the flag doesn't change the meaning of any valid KDL document, and the rules about when strings must be quoted are unchanged.

When the [`experimentalSuffixedNumbers`](./parse.md#parser-flags) flag is also enabled, `#>` immediately after a number is parsed as a number suffix.
In `loop 4#> ease`, `4` has the suffix tag `>`.
Add whitespace before the pipe in that case: `loop 4 #> ease`.

## Multiline chains

Chains can span multiple lines, with `#>` either ending a line or starting the next one:

```kdl
source "orders.csv" #>
  filter status=paid #>
  group-by customer #>
  sort total order=desc

source "orders.csv"
  #> filter status=paid
  #> group-by customer
  #> sort total order=desc
```

Blank lines and comments are allowed between stages.
A line break never changes the meaning of a chain: a leading `#>` always continues the node right before it.
A semicolon ends the chain: `a; #> b` is an error, as is a `#>` at the start of a document or children block.

## Slashdash

A slashdash before the first node of a chain comments out the entire chain:

```kdl
/- image "photo.jpg" #> resize width=800 #> crop ratio="16/9" #> grayscale

/- image "photo.jpg"
  #> resize width=800
  #> crop ratio="16/9"
  #> grayscale
```

A slashdash before a `#>` comments out that single stage:

```kdl
text "Hello" #> padding 8 /-#> border width=1 #> center

// is equivalent to

center { padding 8 { text "Hello" } }
```

## Formatting

Parsing a pipe chain retains the pipe formatting, so `format(parse(text))` writes the chain back as it was written.

The pipe form is only preserved while the node still has exactly one child, and that child is the same node object it was parsed with.
Editing that child in place (e.g. adding an argument) keeps the pipe form.
Removing the child, adding a second child, or replacing it with another node makes the formatter write the nested form instead.

There's no API to create pipe chains in code: pipe formatting only ever comes from parsing.
Both `clearFormat()` and `formatCompact()` drop pipe formatting and yield the nested form, which is valid KDL for any parser.

## Locations

When `storeLocations` is enabled, the location of each node in a chain covers only that node's own text.
For `text "Hello" #> padding 8`, the `padding` node's location spans `padding 8`, and the `text` node's location spans `text "Hello"`.

## Whitespace

Slashdashed stages are retained as part of the surrounding whitespace.
Parsing that whitespace with `parse(text, {as: "whitespace in document"})` yields a part `{type: "slashdash", pipe: true, preface, value}` where `value` is the commented-out node.

## Limitations

Only supported by the KDL v2 parser.
