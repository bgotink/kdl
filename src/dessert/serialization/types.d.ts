import {JsonValue} from "../../json.js";
import {Document, Node, Primitive} from "../../model.js";
import {DeserializationContext} from "../deserialization/types.js";

/**
 * Function or object capable of serializing via a {@link SerializationContext}
 */
export type SerializerFromContext<P extends unknown[]> =
	| ((ctx: SerializationContext, ...parameters: P) => void)
	| {
			/** Function that is given a {@link SerializationContext} */
			serialize(ctx: SerializationContext, ...parameters: P): void;
	  };

/**
 * Function or object capable of serializing a {@link Node}
 *
 * There are three types of serializers:
 * - Functions that are given a {@link SerializationContext}
 * - A value (usually a class instance) with a `serialize` function that is given a {@link SerializationContext}
 * - A value (usually a class instance) with a `serializeTNode` function that returns a {@link Node}
 *
 * All three of these types can accept parameters, in which case these parameters have to be passed when calling {@link serialize}.
 */
export type Serializer<P extends unknown[]> =
	| SerializerFromContext<P>
	| {
			/** Function to serialize a Node of the given name */
			serializeToNode(name: string, ...parameters: P): Node;
	  };

/**
 * Function or object capable of serializing a {@link Document}
 *
 * There are three types of serializers:
 * - Functions that are given a {@link SerializationContext}
 * - A value (usually a class instance) with a `serialize` function that is given a {@link SerializationContext}
 *
 * Both types can accept parameters, in which case these parameters have to be passed when calling {@link serialize}.
 */
export type DocumentSerializer<P extends unknown[]> =
	| ((ctx: DocumentSerializationContext, ...parameters: P) => void)
	| {
			/** Function that is given a {@link DocumentSerializationContext} */
			serialize(ctx: DocumentSerializationContext, ...parameters: P): void;
	  };

/**
 * Wrapper around a {@link Node} to help serializing a value into a single {@link Node}
 */
export interface SerializationContext {
	/**
	 * Marker property that can be used to distinguish between a {@link DocumentSerializationContext} and SerializationContext.
	 */
	readonly target: "node";

	/**
	 * Link this serialization to a prior deserialization
	 *
	 * Attaching a deserialization context as source to this serialization allows the serialization to keep track of metadata in the original text.
	 * For example, an effort is made to preserve formatting and comments.
	 */
	readonly source: (
		sourceCtx: DeserializationContext | null | undefined,
	) => void;

	readonly argument: {
		/**
		 * Add an argument to the serialized node
		 */
		(value: Primitive): void;
		/**
		 * Add an argument with a tag to the serialized node
		 */
		tagged(tag: string, value: Primitive): void;
	};

	readonly property: {
		/**
		 * Set a property on the serialized node
		 *
		 * If the same property was already set previously, the previous value is overwritten.
		 */
		(name: string, value: Primitive): void;
		/**
		 * Set a property with a tag on the serialized node
		 *
		 * If the same property was already set previously, the previous value is overwritten.
		 */
		tagged(tag: string, name: string, value: Primitive): void;
	};

	/**
	 * Serialize a child node and add it to this serialized node
	 */
	readonly child: {
		/**
		 * Run the given serializer to create a node with the given name and add that node as child to the node being serialized
		 */
		<P extends unknown[]>(
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
		/**
		 * Run the given serializer to create a node with the given name and tag and add that node as child to the node being serialized
		 */
		tagged<P extends unknown[]>(
			tag: string,
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
	};

	/**
	 * Serialize a JSON value
	 */
	readonly json: (value: JsonValue) => void;

	/**
	 * Run the given serializer
	 */
	readonly run: <P extends unknown[]>(
		serializer: SerializerFromContext<P>,
		...parameters: P
	) => void;
}

/**
 * Wrapper around a {@link Document} to help serializing a value or values into a {@link Document}
 */
export interface DocumentSerializationContext {
	/**
	 * Marker property that can be used to distinguish between a DocumentSerializationContext and {@link SerializationContext}.
	 */
	readonly target: "document";

	/**
	 * Link this serialization to a prior deserialization
	 *
	 * Attaching a deserialization context as source to this serialization allows the serialization to keep track of metadata in the original text.
	 * For example, an effort is made to preserve formatting and comments.
	 */
	readonly source: (
		sourceCtx: DeserializationContext | null | undefined,
	) => void;

	readonly child: {
		/**
		 * Run the given serializer to create a node with the given name and add that node as child to the document being serialized
		 */
		<P extends unknown[]>(
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
		/**
		 * Run the given serializer to create a node with the given name and tag and add that node as child to the document being serialized
		 */
		tagged<P extends unknown[]>(
			tag: string,
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
	};

	/**
	 * Serialize a JSON value
	 *
	 * The allowed values are limited to only values that can be entirely serialized into nodes placed inside the document.
	 * For example, a string value would be added as argument but a document can't have arguments.
	 */
	readonly json: (value: Exclude<JsonValue, Primitive>) => void;

	/**
	 * Run the given serializer
	 */
	readonly run: <P extends unknown[]>(
		serializer: DocumentSerializer<P>,
		...parameters: P
	) => void;
}

/**
 * Create a node with the given name using the given serializer
 *
 * @param name The name of the node
 * @param serializer Serializer to call
 * @param params Parameters to pass along to the serializer
 */
export function serialize<P extends unknown[]>(
	name: string,
	serializer: Serializer<P>,
	...params: P
): Node;
/**
 * Create a document using the given serializer
 *
 * The first parameter can be null or typeof Document.
 * Passing `null` is easiest, but it won't work when using TypeScript with "strictNullChecks" disabled.
 *
 * @param name Null or a refernece to the Document class
 * @param serializer Serializer to call
 * @param params Parameters to pass along to the serializer
 */
export function serialize<P extends unknown[]>(
	name: typeof Document | null,
	serializer: DocumentSerializer<P>,
	...params: P
): Document;
