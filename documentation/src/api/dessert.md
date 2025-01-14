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

There is one serialization function: `serialize` takes a node name and a serializer and creates a node with that name and runs it through the serializer.
Serializers can be parameterized, allowing for serializers to be shared across multiple values.

There are three types of serializer:

- A function that takes a serialization context,
- An object with a `serialize` function on it that takes a serialization context, or
- An object with a `serializeToNode` function on it that returns a KDL node.

All three of these can be parameterized.

Here's an example of a parameterized serializer for the `Tree` type from either of the two deserialization examples above.

```ts
function treeSerializer(ctx: SerializationContext, tree: Tree) {
	ctx.argument(tree.value);

	if (tree.left) {
		ctx.child("left", treeSerializer, tree.left);
	}
	if (tree.right) {
		ctx.child("right", treeSerializer, tree.right);
	}
}

export function writeTree(tree: Tree): Node {
	return serialize("root", treeDeserializer, tree);
}
```

or we could extend the `Tree` class from the class-based sample with a serialize method:

```ts
class Tree {
	// ... see the Tree class in the deserialize example

	serialize(ctx: SerializationContext) {
		ctx.argument(this.value);

		if (this.left) {
			ctx.child("left", this.left);
		}
		if (this.right) {
			ctx.child("right", this.right);
		}
	}
}

export function writeTree(tree: Tree): Node {
	return serialize("root", tree);
}
```

## Preserving comments and formatting

Programs that make modifications to human-edited files might want to preserve comments and formatting when making these changes.
The `@bgotink/kdl/dessert` API supports this by allowing programs to link an object being serialized using a serialization context with its deserialization context.
This process takes two steps:

1. Store the `DeserializationContext` somewhere
2. Pass call `source` on the `SerializationContext` at the beginning of the `serialize` function and pass it the stored `DeserializationContext`

It is important this call to `source` happens before you make any other calls to any function on the `SerializationContext`.
Calling it later in the serializer will cause an error.

Here's an example of what this looks like in the class-based `Tree` example from above:

```ts
class Tree {
	// ... see the Tree class in the deserialize and serialize examples

	// We store the DeserializationContext
	static deserialize(ctx: DeserializationContxt) {
		const tree = new Tree(
			ctx.argument.required("number"),
			ctx.child.single("left", Tree),
			ctx.child.single("right", Tree),
		);
		tree.#deserializationCtx = ctx;
		return tree;
	}

	#deserializationCtx?: DeserializationContxt;

	// ...

	serialize(ctx: SerializationContext) {
		ctx.source(this.#deserializationCtx);

		// keep the rest of the original serialize function here
	}
}
```

If we now pass in this tree

```kdl
root 10 {
	left 5 { /- left 0; right 5 }
	right 5 { left 1; right 4 }
}
```

and run

```ts
function modify(node: Node): Node {
	const tree = readTree(node); // see deserialization example for this functino

	tree.right.left.value++;
	tree.right.value++;
	tree.value++;

	return writeTree(tree);
}
```

the resulting node will be

```kdl
root 11 {
	left 5 { /- left 0; right 5 }
	right 6 { left 2; right 4 }
}
```

instead of creating a fresh KDL document with default formatting, which would look more like this:

```kdl
root 11 {
	left 5 {
		right 5
	}
	right 6 {
		left 2
		right 4
	}
}
```

Deserializers and serializers that implement the `deserializeFromNode` and `serializeToNode` respectively are responsible for copying any comments and formatting from the original node being deserialized to the final serialized node.
