import {JsonObject, JsonValue} from "../../json.js";
import {Node, Primitive} from "../../index.js";

/**
 * String representation of the {@link Primitive} types
 */
export type PrimitiveType = "boolean" | "null" | "number" | "string";

/**
 * Helper type to turn a list of {@link PrimitiveType}s into matching {@link Primitive} types
 */
export type TypeOf<T extends PrimitiveType[]> = {
	/** only here to quiet a typedoc warning */
	boolean: boolean;
	/** only here to quiet a typedoc warning */
	null: null;
	/** only here to quiet a typedoc warning */
	number: number;
	/** only here to quiet a typedoc warning */
	string: string;
}[T[number]];

/**
 * Function or object capable of deserializing objects of type `T` using a {@link DeserializationContext}
 */
export type DeserializerFromContext<T, P extends unknown[] = []> =
	| ((ctx: DeserializationContext, ...parameters: P) => T)
	| {
			/** Function that is given a {@link DeserializationContext} */
			deserialize(ctx: DeserializationContext, ...parameters: P): T;
	  };

/**
 * Function or object capable of deserializing objects of type `T`
 *
 * There are three types of deserializers:
 * - Functions that are given a {@link DeserializationContext}
 * - A value (usually a class) with a `deserialize` function that is given a {@link DeserializationContext}
 * - A value (usually a class) with a `deserializeFromNode` function that is given a {@link Node}
 *
 * All three variants can be parameterized.
 * Parameters can be passed via `deserialize` or any of the `child`/`children` functions on a {@link DeserializationContext}
 */
export type Deserializer<T, P extends unknown[] = []> =
	| DeserializerFromContext<T, P>
	| {
			/** Function that is given a {@link Node} */
			deserializeFromNode(node: Node, ...parameters: P): T;
	  };

/**
 * Helper type to extract the type a deserializer supports
 */
export type Deserialized<T extends Deserializer<unknown, any[]>> =
	T extends Deserializer<infer V, any[]> ? V : never;

export interface Argument {
	/**
	 * Return the next argument, if there is a next argument
	 */
	(): Primitive | undefined;
	/**
	 * Return the next argument, if there is a next argument, requiring the argument to be of the given type
	 *
	 * @throws If the next argument does not match any of the given types
	 */
	<T extends [PrimitiveType, ...PrimitiveType[]]>(
		...types: T
	): TypeOf<T> | undefined;

	/**
	 * Return the next argument, if there is a next argument and it has a valid type
	 */
	if<T extends [PrimitiveType, ...PrimitiveType[]]>(
		...types: T
	): TypeOf<T> | undefined;

	/**
	 * Return the next argument
	 *
	 * @throws If there is no next argument
	 */
	required(): Primitive;
	/**
	 * Return the next argument
	 *
	 * @throws If there is no next argument
	 * @throws If the next argument does not match any of the given types
	 */
	required<T extends [PrimitiveType, ...PrimitiveType[]]>(
		...types: T
	): TypeOf<T>;

	/**
	 * Return all remaining arguments
	 */
	rest(): Primitive[];

	/**
	 * Return all remaining arguments
	 */
	rest<T extends [PrimitiveType, ...PrimitiveType[]]>(...types: T): TypeOf<T>[];
}

export interface Property {
	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet
	 */
	(name: string): Primitive | undefined;
	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet
	 *
	 * @throws If the property value does not match any of the given types
	 */
	<T extends [PrimitiveType, ...PrimitiveType[]]>(
		name: string,
		...types: T
	): TypeOf<T> | undefined;

	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet and its value has the correct type
	 */
	if<T extends [PrimitiveType, ...PrimitiveType[]]>(
		name: string,
		...types: T
	): TypeOf<T> | undefined;

	/**
	 * Return the property with the given name
	 *
	 * @throws If the property doesn't exist or it has already been returned
	 */
	required(name: string): Primitive;
	/**
	 * Return the property with the given name
	 *
	 * @throws If the property doesn't exist or it has already been returned
	 * @throws If the property value does not match any of the given types
	 */
	required<T extends [PrimitiveType, ...PrimitiveType[]]>(
		name: string,
		...types: T
	): TypeOf<T>;

	/**
	 * Return all remaining properties
	 */
	rest(): Map<string, Primitive>;
}

export interface Child {
	/**
	 * Returns the next child with the given name, if there is any
	 *
	 * @throws If the deserializer fails
	 */
	<T, P extends unknown[]>(
		name: string,
		deserializer: Deserializer<T, P>,
		...parameters: P
	): T | undefined;

	required: {
		/**
		 * Returns the next child with the given name
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 */
		<T, P extends unknown[]>(
			name: string,
			deserializer: Deserializer<T, P>,
			...parameters: P
		): T;
		/**
		 * Returns the next child with the given name and validate that there are no others
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		single<T, P extends unknown[]>(
			name: string,
			deserializer: Deserializer<T, P>,
			...parameters: P
		): T;
	};

	single: {
		/**
		 * Returns the next child with the given name if there is any and validate that there are no others
		 *
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		<T, P extends unknown[]>(
			name: string,
			deserializer: Deserializer<T, P>,
			...parameters: P
		): T | undefined;
		/**
		 * Returns the next child with the given name and validate that there are no others
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		required<T, P extends unknown[]>(
			name: string,
			deserializer: Deserializer<T, P>,
			...parameters: P
		): T;
	};
}

export interface Children {
	/**
	 * Returns all remaining children with the given name
	 *
	 * @throws If the deserializer fails
	 */
	<T, P extends unknown[]>(
		name: string,
		deserializer: Deserializer<T, P>,
		...parameters: P
	): T[];

	/**
	 * Returns all remaining children with the given name, requiring at least one such child
	 *
	 * @throws If the deserializer fails
	 * @throws If there are no remaining children with the given name
	 */
	required<T, P extends unknown[]>(
		name: string,
		deserializer: Deserializer<T, P>,
		...parameters: P
	): [T, ...T[]];

	entries: {
		/**
		 * Returns all remaining children with their name
		 *
		 * @throws If the deserializer fails
		 */
		<T, P extends unknown[]>(
			deserializer: Deserializer<T, P>,
			...parameters: P
		): [name: string, value: T][];

		filtered: {
			/**
			 * Returns all remaining children with their name if that name matches the given filter
			 *
			 * @throws If the deserializer fails
			 */
			<T, P extends unknown[]>(
				filter: RegExp,
				deserializer: Deserializer<T, P>,
				...parameters: P
			): [name: string, value: T][];
			/**
			 * Returns all remaining children with their name if that name matches the given filter, requiring all matching names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			unique<T, P extends unknown[]>(
				filter: RegExp,
				deserializer: Deserializer<T, P>,
				...parameters: P
			): [name: string, value: T][];
		};

		unique: {
			/**
			 * Returns all remaining children with their name, requiring all names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			<T, P extends unknown[]>(
				deserializer: Deserializer<T, P>,
				...parameters: P
			): [name: string, value: T][];
			/**
			 * Returns all remaining children with their name if that name matches the given filter, requiring all matching names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			filtered<T, P extends unknown[]>(
				filter: RegExp,
				deserializer: Deserializer<T, P>,
				...parameters: P
			): [name: string, value: T][];
		};
	};
}

/**
 * String representation of the {@link JsonValue} types
 */
export type JsonType = PrimitiveType | "object" | "array";

/**
 * Helper type to turn {@link JsonType}s into the corresponding {@link JsonValue} types
 */
export type JsonTypeOf<T extends JsonType[]> = {
	/** only here to quiet a typedoc warning */
	boolean: boolean;
	/** only here to quiet a typedoc warning */
	null: null;
	/** only here to quiet a typedoc warning */
	number: number;
	/** only here to quiet a typedoc warning */
	string: string;
	/** only here to quiet a typedoc warning */
	object: JsonObject;
	/** only here to quiet a typedoc warning */
	array: JsonValue[];
}[T[number]];

export interface Json {
	/**
	 * Turn the remaining arguments, properties, and children into a JSON value
	 *
	 * After calling this function, all remaining arguments, properties, and children of the context have been consumed.
	 * Further calls to any of the context's utilities will return undefined or throw, depending on how the utility handles an empty context.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 */
	(): JsonValue | undefined;
	/**
	 * Turn the remaining arguments, properties, and children into a JSON value matching any of the given types
	 *
	 * After calling this function, all remaining arguments, properties, and children of the context have been consumed.
	 * Further calls to any of the context's utilities will return undefined or throw, depending on how the utility handles an empty context.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 * @throws If the deserialized value doesn't match any of the given types
	 */
	<T extends [JsonType, ...JsonType[]]>(...types: T): JsonTypeOf<T> | undefined;

	/**
	 * Turn the remaining arguments, properties, and children into a JSON value
	 *
	 * After calling this function, all remaining arguments, properties, and children of the context have been consumed.
	 * Further calls to any of the context's utilities will return undefined or throw, depending on how the utility handles an empty context.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 * @throws If the context is empty
	 */
	required(): JsonValue;
	/**
	 * Turn the remaining arguments, properties, and children into a JSON value matching any of the given types
	 *
	 * After calling this function, all remaining arguments, properties, and children of the context have been consumed.
	 * Further calls to any of the context's utilities will return undefined or throw, depending on how the utility handles an empty context.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 * @throws If the context is empty
	 * @throws If the deserialized value doesn't match any of the given types
	 */
	required<T extends [JsonType, ...JsonType[]]>(...types: T): JsonTypeOf<T>;
}

/**
 * Wrapper around a {@link Node} to help deserializing a single {@link Node} into a value
 */
export interface DeserializationContext {
	/**
	 * Name of the node being deserialized
	 */
	readonly name: string;

	/**
	 * Tag of the node being deserialized
	 */
	readonly tag: string | null;

	/**
	 * Helper to access the node's arguments
	 */
	readonly argument: Argument;
	/**
	 * Helper to access the node's properties
	 */
	readonly property: Property;

	/**
	 * Helper to access the node's children
	 */
	readonly child: Child;
	/**
	 * Helper to access the node's children
	 */
	readonly children: Children;

	/**
	 * Helper for processing the node as JSON
	 */
	readonly json: Json;

	/**
	 * Run the given deserializer
	 */
	readonly run: <T, P extends unknown[]>(
		deserializer: DeserializerFromContext<T, P>,
		...parameters: P
	) => T;
}
