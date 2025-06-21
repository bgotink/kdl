import {JsonObject, JsonValue} from "../../json.js";
import {Node, Primitive} from "../../index.js";

import {KdlDeserializeError} from "./error.js";

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
 * Object capable of deserializing objects of type `T` from a {@link Node}
 */
export interface DeserializerFromNode<T, P extends unknown[] = []> {
	/** Function that is given a {@link Node} */
	deserializeFromNode(node: Node, ...parameters: P): T;
}

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
	| DeserializerFromNode<T, P>;

/**
 * Helper type to extract the type a deserializer supports
 */
export type Deserialized<T extends Deserializer<unknown, any[]>> =
	T extends Deserializer<infer V, any[]> ? V : never;

/**
 * Return type of the {@link DeserializationContext}'s argument
 *
 * The actual type depends on whether you're using `ctx.argument()`
 * with or without `.if`, `.required`, and/or `.rest`.
 */
export type ArgumentReturnType<
	T,
	Required extends boolean,
	ReturnMultiple extends boolean,
	IgnoreInvalid extends boolean = false,
> =
	ReturnMultiple extends false ?
		| T
		| (Required extends false ? undefined : never)
		| (IgnoreInvalid extends true ? undefined : never)
	: Required extends true ?
		IgnoreInvalid extends false ?
			[T, ...T[]]
		:	T[]
	:	T[];

export interface Argument<
	Required extends boolean = false,
	ReturnMultiple extends boolean = false,
	IgnoreInvalid extends boolean = false,
> {
	/**
	 * Return the next argument, if there is a next argument
	 */
	(): ArgumentReturnType<Primitive, Required, ReturnMultiple>;

	/**
	 * Return the next argument, if there is a next argument, requiring the argument to be of the given type
	 *
	 * @throws If the next argument does not match any of the given types
	 */
	<T extends [PrimitiveType, ...PrimitiveType[]]>(
		...types: T
	): ArgumentReturnType<TypeOf<T>, Required, ReturnMultiple, IgnoreInvalid>;

	/**
	 * Return the next argument, if there is a next argument, requiring the argument to be one of the given enum values
	 *
	 * @throws If the next argument does not equal any of the given values
	 */
	enum<T extends Primitive[]>(
		...values: T
	): ArgumentReturnType<T[number], Required, ReturnMultiple, IgnoreInvalid>;

	/**
	 * Throw if there is no next argument, rather than return undefined
	 */
	required: Required extends false ?
		Argument<true, ReturnMultiple, IgnoreInvalid>
	:	never;

	/**
	 * Return all remaining arguments rather than only the next argument
	 */
	rest: ReturnMultiple extends false ? Argument<Required, true, IgnoreInvalid>
	:	never;

	/**
	 * Return undefined instead of throwing if the next argument doesn't match the given types or enum values
	 */
	if: IgnoreInvalid extends false ? Argument<Required, ReturnMultiple, true>
	:	never;
}

/**
 * Return type of the {@link DeserializationContext}'s property
 *
 * The actual type depends on whether you're using `ctx.property`
 * with or without `.if`, `.required`, and/or `.rest`.
 */
type PropertyReturnType<
	T,
	Required extends boolean,
	ReturnMultiple extends boolean,
	IgnoreInvalid extends boolean = false,
> =
	ReturnMultiple extends false ?
		| T
		| (Required extends false ? undefined : never)
		| (IgnoreInvalid extends true ? undefined : never)
	:	Map<string, T>;

export interface Property<
	Required extends boolean = false,
	IgnoreInvalid extends boolean = false,
> {
	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet
	 */
	(name: string): PropertyReturnType<Primitive, Required, false>;

	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet
	 *
	 * @throws If the property value does not match any of the given types
	 */
	<T extends [PrimitiveType, ...PrimitiveType[]]>(
		name: string,
		...types: T
	): PropertyReturnType<TypeOf<T>, Required, false, IgnoreInvalid>;

	/**
	 * Return the property with the given name if it exists and it hasn't been returned yet
	 *
	 * @throws If the property value does not equal any of the given values
	 */
	enum<T extends Primitive[]>(
		name: string,
		...values: T
	): PropertyReturnType<T[number], Required, false, IgnoreInvalid>;

	/**
	 * Throw if there is no property with the given name, rather than return undefined
	 */
	required: Required extends false ? Property<true, IgnoreInvalid> : never;

	/**
	 * Return all remaining properties rather than only a single named property
	 */
	rest: RestProperty<Required, IgnoreInvalid>;

	/**
	 * Return undefined instead of throwing if the property doesn't match the given types or enum values
	 */
	if: IgnoreInvalid extends false ? Property<Required, true> : never;
}

export interface RestProperty<
	Required extends boolean = false,
	IgnoreInvalid extends boolean = false,
> {
	/**
	 * Return all remaining properties
	 */
	(): PropertyReturnType<Primitive, Required, true>;

	/**
	 * Return all remaining properties
	 *
	 * @throws If any remaining property value does not match any of the given types
	 */
	<T extends [PrimitiveType, ...PrimitiveType[]]>(
		...types: T
	): PropertyReturnType<TypeOf<T>, Required, true, IgnoreInvalid>;

	/**
	 * Return all remaining properties
	 *
	 * @throws If any remaining property value does not equal any of the given values
	 */
	enum<T extends Primitive[]>(
		...values: T
	): PropertyReturnType<T[number], Required, true, IgnoreInvalid>;

	/**
	 * Throw if there is no property with the given name, rather than return undefined
	 */
	required: Required extends false ? RestProperty<true, IgnoreInvalid> : never;

	/**
	 * Return undefined instead of throwing if the property doesn't match the given types or enum values
	 */
	if: IgnoreInvalid extends false ? RestProperty<Required, true> : never;
}

export interface Child<
	Required extends boolean = false,
	Single extends boolean = false,
> {
	/**
	 * Returns the next child with the given name, if there is any
	 *
	 * @throws If the deserializer fails
	 */
	<T, P extends unknown[]>(
		name: string,
		deserializer: Deserializer<T, P>,
		...parameters: P
	): T | (Required extends false ? undefined : never);

	/**
	 * Throw if there is no next child with the given name, instead of returning undefined
	 */
	required: Required extends false ? Child<true, Single> : never;

	/**
	 * Throw if there are multiple nodes left with the given name
	 */
	single: Single extends false ? Child<Required, true> : never;
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

export interface Run {
	/**
	 * Run the given deserializer
	 *
	 * The deserializer is run atomically, i.e. if the deserializer fails
	 * then the context is reset to before the deserializer ran.
	 */
	<T, P extends unknown[]>(
		deserializer: DeserializerFromContext<T, P>,
		...parameters: P
	): T;

	/**
	 * Run the given deserializer, returning null if the deserializer fails with a {@link KdlDeserializeError}
	 *
	 * The deserializer is run atomically, i.e. if the deserializer fails
	 * then the context is reset to before the deserializer ran.
	 */
	try<T, P extends unknown[]>(
		deserializer: DeserializerFromContext<T, P>,
		...parameters: P
	): T | null;
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
	 * Helper for running other deserializers.
	 */
	readonly run: Run;
}
