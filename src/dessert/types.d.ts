import {JsonObject, JsonValue} from "../json.js";
import {Node} from "../index.js";

/**
 * A primitive is any type that can be represented as an argument or property
 */
export type Primitive = boolean | null | number | string;

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
 * Function or object capable of deserializing objects of type `T`
 *
 * There are three types of deserializers:
 * - Functions that are given a {@link DeserializeContext}
 * - A value (usually a class) with a `deserialize` function that is given a {@link DeserializeContext}
 * - A value (usually a class) with a `deserializeFromNode` function that is given a {@link Node}
 */
export type Deserializer<T> =
	| ((ctx: DeserializeContext) => T)
	| {
			/** Function that is given a {@link DeserializeContext} */
			deserialize(ctx: DeserializeContext): T;
	  }
	| {
			/** Function that is given a {@link Node} */
			deserializeFromNode(node: Node): T;
	  };

/**
 * Helper type to extract the type a deserializer supports
 */
export type Deserialized<T extends Deserializer<unknown>> =
	T extends Deserializer<infer V> ? V : never;

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
}

export interface Child {
	/**
	 * Returns the next child with the given name, if there is any
	 *
	 * @throws If the deserializer fails
	 */
	<T>(name: string, deserializer: Deserializer<T>): T | undefined;

	required: {
		/**
		 * Returns the next child with the given name
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 */
		<T>(name: string, deserializer: Deserializer<T>): T;
		/**
		 * Returns the next child with the given name and validate that there are no others
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		single<T>(name: string, deserializer: Deserializer<T>): T;
	};

	single: {
		/**
		 * Returns the next child with the given name if there is any and validate that there are no others
		 *
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		<T>(name: string, deserializer: Deserializer<T>): T | undefined;
		/**
		 * Returns the next child with the given name and validate that there are no others
		 *
		 * @throws If there is no next child with the given name
		 * @throws If the deserializer fails
		 * @throws If there are other children left with the given name
		 */
		required<T>(name: string, deserializer: Deserializer<T>): T;
	};
}

export interface Children {
	/**
	 * Returns all remaining children with the given name
	 *
	 * @throws If the deserializer fails
	 */
	<T>(name: string, deserializer: Deserializer<T>): T[];

	/**
	 * Returns all remaining children with the given name, requiring at least one such child
	 *
	 * @throws If the deserializer fails
	 * @throws If there are no remaining children with the given name
	 */
	required<T>(name: string, deserializer: Deserializer<T>): [T, ...T[]];

	entries: {
		/**
		 * Returns all remaining children with their name
		 *
		 * @throws If the deserializer fails
		 */
		<T>(deserializer: Deserializer<T>): [name: string, value: T][];

		filtered: {
			/**
			 * Returns all remaining children with their name if that name matches the given filter
			 *
			 * @throws If the deserializer fails
			 */
			<T>(
				filter: RegExp,
				deserializer: Deserializer<T>,
			): [name: string, value: T][];
			/**
			 * Returns all remaining children with their name if that name matches the given filter, requiring all matching names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			unique<T>(
				filter: RegExp,
				deserializer: Deserializer<T>,
			): [name: string, value: T][];
		};

		unique: {
			/**
			 * Returns all remaining children with their name, requiring all names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			<T>(deserializer: Deserializer<T>): [name: string, value: T][];
			/**
			 * Returns all remaining children with their name if that name matches the given filter, requiring all matching names to be unique
			 *
			 * @throws If the deserializer fails
			 * @throws If a duplicate name is encountered
			 */
			filtered<T>(
				filter: RegExp,
				deserializer: Deserializer<T>,
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
	 * Turn the entire context into a JSON value
	 *
	 * If any argument has already been used in the context, all arguments are ignored by the JSON conversion, otherwise arguments are included.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 * @throws If any of the context's properties or children have already been consumed
	 */
	(): JsonValue;
	/**
	 * Turn the entire context into a JSON value matching any of the given types
	 *
	 * If any argument has already been used in the context, all arguments are ignored by the JSON conversion, otherwise arguments are included.
	 *
	 * @throws If the context doesn't contain a valid JSON value
	 * @throws If any of the context's properties or children have already been consumed
	 * @throws If the deserialized value doesn't match any of the given types
	 */
	<T extends [JsonType, ...JsonType[]]>(...types: T): JsonTypeOf<T>;
}

/**
 * Wrapper around a {@link Node} to help deserializing a single {@link Node} into a value
 */
export interface DeserializeContext {
	/**
	 * Helper to access the node's arguments
	 */
	argument: Argument;
	/**
	 * Helper to access the node's properties
	 */
	property: Property;

	/**
	 * Helper to access the node's children
	 */
	child: Child;
	/**
	 * Helper to access the node's children
	 */
	children: Children;

	/**
	 * Helper for processing the node as JSON
	 */
	json: Json;
}
