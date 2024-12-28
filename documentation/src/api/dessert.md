# (De)Serialization Tools

The `@bgotink/kdl/dessert` package export exposes tools for helping with (de)serializing KDL nodes/documents into a more useful JavaScript structure.
The basic tools don't enforce any specific programming paradigm, e.g. enforcing the use of `class`, but some of the higher level tools exposed do take a more opinionated approach.

The name "dessert" comes from DESerialization & SERialization Tools.
Also, who doesn't like dessert?

## Deserialization

There is one main deserialization function: `deserialize` takes a KDL node or document and a deserializer and runs the given node or document through the deserializer.
A second function `parse` takes a KDL document text, parses it into a KDL document and then runs it through `deserialize`.

There are three types of deserializer:

- A function that takes a deserialization context and returns the deserialized value,
- An object with a `deserialize` function on it that takes a deserialization context and returns the deserialized value, or
- An object with a `deserializeFromNode` function on it that takes a KDL node and returns the deserialized value.

A [deserialization context](./reference/dessert/index.md#deserializationcontext) is an object with a bunch of functions on it to help extract arguments, properties, and children from the node.

Here's an example of a deserializer using functions:

```ts
import type {DeserializationContext} from "@bgotink/kdl/dessert";

type Tree = {value: number; left?: Tree; right?: Tree};

function treeDeserializer(ctx: DeserializationContext): Tree {
	return {
		value: ctx.argument.required("number"),
		left: ctx.child.single("left", treeDeserializer),
		right: ctx.child.single("right", treeDeserializer),
	};
}

export function readTree(node: Node): Tree {
	return deserialize(node, treeDeserializer);
}
```

and here's that same deserializer as a `class`:

```ts
import type {DeserializationContext} from "@bgotink/kdl/dessert";

class Tree {
	static deserialize(ctx: DeserializationContext): Tree {
		return new Tree(
			ctx.argument.required("number"),
			ctx.child.single("left", Tree),
			ctx.child.single("right", Tree),
		);
	}

	constructor(
		readonly value: number,
		readonly left?: Tree,
		readonly right?: Tree,
	) {}
}

export function readTree(node: Node): Tree {
	return deserialize(node, Tree);
}
```

Both of these deserializers effortlessly turn the following KDL node into a tree structure

```kdl
root 10 {
	left 5 {
		left 3
		right 2
	}
	right 5 {
		left 1
		right 4 {
			left 1
			right 3 {
				left 2
				right 1
			}
		}
	}
}
```

## Serialization

To come :)
