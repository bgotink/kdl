# Formatting KDL

The [`format(value)`](./reference/index.md#format) function turns a document, node, entry, identifier, value, or tag into a KDL string representing that value.

The KDL DOM classes contain not just their values, but also any information on whitespace and comments required to format the element.
This makes this package good at manipulating KDL files maintained by humans, as it supports making modifications with as few changes to the file as possible.

```js
import {parse, format} from "@bgotink/kdl";

const doc = parse(
	String.raw`
		node "value" #"other value"# 2.0 4 #false \
				#null -0 {
			child; "child too"
		}
	`,
);

doc.nodes[0].children.nodes[0].entries.push(
	parse(
		String.raw`/-lorem="ipsum" \
				dolor=#true`,
		{as: "entry"},
	),
);

assert.equal(
	format(doc),
	String.raw`
		node "value" #"other value"# 2.0 4 #false \
				#null -0 {
			child /-lorem="ipsum" \
				dolor=#true; "child too"
		}
	`,
);
```

All KDL DOM elements that wrap simple values—i.e. `Value`, `Identifier`, and `Tag`—have an optional `representation` property that declares how its value is to be formatted.
This property is set for all parsed elements and ensures that formatting the elmeent results in as few changes as possible.
Take care when changing these values, as the representation is not validated when formatting the element.

```js
// Do not do this!
import {Entry, Identifier, Node, Value, format} from "@bgotink/kdl";

const node = new Node(new Identifier("real_name"));
node.name.representation = "fake_name";

const entry = new Entry(new Value(42), new Identifier("property"));
entry.name.representation = "something_else";
entry.value.representation = "false";

assert.equal(format(node), "fake_name something_else=false");
```

Instances of `Document`, `Node`, `Entry`, and `Tag`, store information about whitespace.
Just like the `representation`, these fields are not validated when formatting the DOM elements.

## Reset

The [`clearFormat(value)`](./reference/index.md#clearformat) function removes any and all formatting from a document, node, entry, value, identifier, or tag.
