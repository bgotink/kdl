import {
	Identifier,
	Node,
	parse as parseDocument,
	type Primitive,
	type Entry,
	type Document,
} from "../../index.js";
import type {JsonValue} from "../../json.js";
import {deserializeJson} from "../json.js";
import {storeNodeForContext} from "../shared.js";

import {KdlDeserializeError} from "./error.js";
import {joinWithAnd, joinWithOr} from "./utils.js";
import type {
	Argument,
	ArgumentReturnType,
	Child,
	Children,
	DeserializationContext,
	Deserialized,
	Deserializer,
	DeserializerFromContext,
	Json,
	JsonType,
	JsonTypeOf,
	PrimitiveType,
	Property,
	PropertyReturnType,
	RegExpLike,
	RestProperty,
	Run,
	Tagged,
	TypeOf,
} from "./types.js";

function primitiveTypeOf(value: Primitive) {
	return value === null ? "null" : (typeof value as PrimitiveType);
}

function hasValidType<T extends readonly PrimitiveType[]>(
	types: T,
	value: Primitive,
): value is TypeOf<T> {
	return types.includes(primitiveTypeOf(value));
}

function jsonTypeOf(value: JsonValue): JsonType {
	if (Array.isArray(value)) {
		return "array";
	}
	if (typeof value === "object") {
		return value === null ? "null" : "object";
	}
	return primitiveTypeOf(value);
}

function hasValidJsonType<T extends readonly JsonType[]>(
	types: T,
	value: JsonValue,
): value is JsonTypeOf<T> {
	return types.includes(jsonTypeOf(value));
}

class ContextState {
	node: Node;

	arguments: Entry[];
	properties: Map<string, Entry>;
	children: Set<Node>;

	constructor(
		node: Node,
		args = node.getArgumentEntries(),
		properties = new Map(
			node.getPropertyEntries().map((entry) => [entry.getName()!, entry]),
		),
		children = new Set(node.children?.nodes),
	) {
		this.node = node;

		this.arguments = args;
		this.properties = properties;
		this.children = children;
	}

	clone() {
		return new ContextState(
			this.node,
			Array.from(this.arguments),
			new Map(this.properties),
			new Set(this.children),
		);
	}

	apply(other: ContextState) {
		// assert(other.#node === this.#node);

		this.arguments = Array.from(other.arguments);
		this.properties = new Map(other.properties);
		this.children = new Set(other.children);
	}

	clear() {
		const {arguments: args, properties: props, children} = this;
		this.arguments = [];
		this.properties = new Map();
		this.children = new Set();
		return {args, props, children};
	}

	finalize() {
		if (this.arguments.length) {
			throw new KdlDeserializeError(
				`Found ${this.arguments.length} superfluous arguments`,
				{location: this.node},
			);
		}

		if (this.properties.size) {
			throw new KdlDeserializeError(
				`Found superfluous properties ${joinWithAnd(Array.from(this.properties.keys(), (name) => JSON.stringify(name)))}`,
				{location: this.node},
			);
		}

		if (this.children.size) {
			// Replace with Object.groupBy once targeting node ≥ 22
			const counts = Array.from(this.children, (child) =>
				child.getName(),
			).reduce(
				(obj, name) => {
					obj[name] = (Object.hasOwn(obj, name) ? obj[name] : 0) + 1;

					return obj;
				},
				{} as Record<string, number>,
			);

			throw new KdlDeserializeError(
				`Found ${this.children.size} superfluous children (${joinWithAnd(
					Object.entries(counts).map(([name, count]) =>
						count > 1 ?
							`${count} ${JSON.stringify(name)}`
						:	JSON.stringify(name),
					),
				)})`,
				{location: this.node},
			);
		}
	}
}

type Extractor<IncludeTag extends boolean> = <T extends Primitive>(
	value: T,
	entry: Entry,
) => Tagged<T, IncludeTag>;

function extractValueWithTag<T>(value: T, entry: Entry): Tagged<T, true> {
	return [value, entry.getTag()];
}

function extractValue<T>(value: T): Tagged<T, false> {
	return value;
}

function getExtractor<IncludeTag extends boolean>(
	includeTag: IncludeTag,
): Extractor<IncludeTag>;
function getExtractor(includeTag: boolean): Extractor<boolean> {
	return includeTag ? extractValueWithTag : extractValue;
}

function validateType(
	entry: Entry,
	value: Primitive,
	ignoreInvalid: boolean,
	...types: PrimitiveType[]
): value is Primitive {
	if (!types.length || hasValidType(types, value)) {
		return true;
	}

	if (ignoreInvalid) {
		return false;
	}

	throw new KdlDeserializeError(
		`Expected a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
		{location: entry},
	);
}

function validateEnum<T extends readonly Primitive[]>(
	entry: Entry,
	value: Primitive,
	ignoreInvalid: boolean,
	...enumValues: T
): value is T[number] {
	if (enumValues.includes(value)) {
		return true;
	}

	if (ignoreInvalid) {
		return false;
	}

	throw new KdlDeserializeError(
		`Expected one of ${joinWithOr(enumValues.map((v) => JSON.stringify(v)))} but got ${JSON.stringify(value)}`,
		{location: entry},
	);
}

function validatePattern(
	entry: Entry,
	value: Primitive,
	ignoreInvalid: boolean,
	...patterns: RegExpLike[]
): value is string {
	if (
		typeof value === "string" &&
		patterns.some((pattern) => pattern.test(value))
	) {
		return true;
	}

	if (ignoreInvalid) {
		return false;
	}

	throw new KdlDeserializeError(
		`Expected a string matching ${joinWithOr(patterns.map((v) => String(v)))} but got ${JSON.stringify(value)}`,
		{location: entry},
	);
}

function getArgumentHelper<
	A extends unknown[],
	R extends Primitive,
	IncludeTag extends boolean,
	Required extends boolean,
	IgnoreInvalid extends boolean,
>(
	state: ContextState,
	extractor: Extractor<IncludeTag>,
	required: Required,
	ignoreInvalid: IgnoreInvalid,
	validate: (
		arg: Entry,
		value: Primitive,
		ignoreInvalid: boolean,
		...args: A
	) => value is R,
): (
	...args: A
) => ArgumentReturnType<Tagged<R, IncludeTag>, Required, false, IgnoreInvalid> {
	return (...args) => {
		const arg = state.arguments[0];
		if (arg === undefined) {
			if (!required) {
				return undefined as ArgumentReturnType<
					Tagged<R, IncludeTag>,
					Required,
					false,
					IgnoreInvalid
				>;
			}

			throw new KdlDeserializeError(`Missing argument`, {
				location: state.node,
			});
		}

		const value = arg.getValue();
		if (validate(arg, value, ignoreInvalid, ...args)) {
			state.arguments.shift();
			return extractor(value, arg);
		} else {
			return undefined as ArgumentReturnType<
				Tagged<R, IncludeTag>,
				Required,
				false,
				IgnoreInvalid
			>;
		}
	};
}

function getRestArgumentHelper<
	A extends unknown[],
	R extends Primitive,
	IncludeTag extends boolean,
	Required extends boolean,
	IgnoreInvalid extends boolean,
>(
	state: ContextState,
	extractor: Extractor<IncludeTag>,
	required: Required,
	ignoreInvalid: IgnoreInvalid,
	validate: (
		arg: Entry,
		value: Primitive,
		ignoreInvalid: boolean,
		...args: A
	) => value is R,
): (
	...args: A
) => ArgumentReturnType<Tagged<R, IncludeTag>, Required, true, IgnoreInvalid> {
	return (...args) => {
		if (required && state.arguments.length === 0) {
			throw new KdlDeserializeError(`Missing argument`, {
				location: state.node,
			});
		}

		return state.arguments.splice(0, state.arguments.length).flatMap((arg) => {
			const value = arg.getValue();
			if (validate(arg, value, ignoreInvalid, ...args)) {
				return [extractor(value, arg)];
			} else {
				state.arguments.push(arg);
				return [];
			}
		}) as ArgumentReturnType<
			Tagged<R, IncludeTag>,
			Required,
			true,
			IgnoreInvalid
		>;
	};
}

function defineLazyProperties<O extends object>(
	object: O,
	factories: {
		[K in keyof O]: () => O[K];
	},
) {
	Object.defineProperties(
		object,
		Object.fromEntries(
			Object.entries<(() => O[keyof O]) | undefined>(factories).map(
				([name, factory]) => {
					let value: O[keyof O] | null = null;
					return [
						name,
						factory ? {get: () => (value ??= factory())} : {value: null},
					];
				},
			),
		),
	);
}

function makeArgument<IncludeTag extends boolean>(
	state: ContextState,
	includeTag: IncludeTag,
): Argument<IncludeTag> {
	const extractor = getExtractor(includeTag);

	function mkArgument<Required extends boolean, IgnoreInvalid extends boolean>(
		required: Required,
		ignoreInvalid: IgnoreInvalid,
	) {
		const getArgument = getArgumentHelper(
			state,
			extractor,
			required,
			ignoreInvalid,
			validateType,
		) as Argument<IncludeTag, Required, false, IgnoreInvalid>;

		defineLazyProperties(getArgument, {
			enum: () =>
				getArgumentHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validateEnum,
				),
			pattern: () =>
				getArgumentHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validatePattern,
				),

			rest: () => mkRestArgument(required, ignoreInvalid),

			required: () => mkArgument(true, ignoreInvalid),
			if: () => mkArgument(required, true),
		});

		return getArgument;
	}

	function mkRestArgument<
		Required extends boolean,
		IgnoreInvalid extends boolean,
	>(required: Required, ignoreInvalid: IgnoreInvalid) {
		const getRestArguments = getRestArgumentHelper(
			state,
			extractor,
			required,
			ignoreInvalid,
			validateType,
		) as Argument<IncludeTag, Required, true, IgnoreInvalid>;

		defineLazyProperties(getRestArguments, {
			enum: () =>
				getRestArgumentHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validateEnum,
				),
			pattern: () =>
				getRestArgumentHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validatePattern,
				),

			rest: () => getRestArguments,

			required: () => mkRestArgument(true, ignoreInvalid),
			if: () => mkRestArgument(required, true),
		});

		return getRestArguments;
	}

	return mkArgument(false, false);
}

function getPropertyHelper<
	A extends unknown[],
	R extends Primitive,
	IncludeTag extends boolean,
	Required extends boolean,
	IgnoreInvalid extends boolean,
>(
	state: ContextState,
	extractor: Extractor<IncludeTag>,
	required: Required,
	ignoreInvalid: IgnoreInvalid,
	validate: (
		arg: Entry,
		value: Primitive,
		ignoreInvalid: boolean,
		...args: A
	) => value is R,
): (
	name: string,
	...args: A
) => PropertyReturnType<Tagged<R, IncludeTag>, Required, false, IgnoreInvalid> {
	return (name, ...args) => {
		const prop = state.properties.get(name);
		if (prop === undefined) {
			if (!required) {
				return undefined as PropertyReturnType<
					Tagged<R, IncludeTag>,
					Required,
					false,
					IgnoreInvalid
				>;
			}

			throw new KdlDeserializeError(`Missing property ${name}`, {
				location: state.node,
			});
		}

		const value = prop.getValue();
		if (validate(prop, value, ignoreInvalid, ...args)) {
			state.properties.delete(name);
			return extractor(value, prop);
		} else {
			return undefined as PropertyReturnType<
				Tagged<R, IncludeTag>,
				Required,
				false,
				IgnoreInvalid
			>;
		}
	};
}

function getRestPropertiesHelper<
	A extends unknown[],
	R extends Primitive,
	IncludeTag extends boolean,
	Required extends boolean,
	IgnoreInvalid extends boolean,
>(
	state: ContextState,
	extractor: Extractor<IncludeTag>,
	required: Required,
	ignoreInvalid: IgnoreInvalid,
	validate: (
		arg: Entry,
		value: Primitive,
		ignoreInvalid: boolean,
		...args: A
	) => value is R,
): (
	...args: A
) => PropertyReturnType<Tagged<R, IncludeTag>, Required, true, IgnoreInvalid> {
	return (...args) => {
		if (required && state.properties.size === 0) {
			throw new KdlDeserializeError(`Missing properties`, {
				location: state.node,
			});
		}

		const result = [...state.properties];
		state.properties.clear();

		return new Map(
			result.flatMap(([name, prop]) => {
				const value = prop.getValue();
				if (validate(prop, value, ignoreInvalid, ...args)) {
					return [[name, extractor(value, prop)]];
				} else {
					state.properties.set(name, prop);
					return [];
				}
			}),
		);
	};
}

function makeProperty<IncludeTag extends boolean>(
	state: ContextState,
	includeTag: IncludeTag,
): Property<IncludeTag> {
	const extractor = getExtractor(includeTag);

	function mkProperty<Required extends boolean, IgnoreInvalid extends boolean>(
		required: Required,
		ignoreInvalid: IgnoreInvalid,
	) {
		const getProperty = getPropertyHelper(
			state,
			extractor,
			required,
			ignoreInvalid,
			validateType,
		) as Property<IncludeTag, Required, IgnoreInvalid>;

		defineLazyProperties(getProperty, {
			enum: () =>
				getPropertyHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validateEnum,
				),
			pattern: () =>
				getPropertyHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validatePattern,
				),

			rest: () => mkRestProperties(required, ignoreInvalid),

			required: () => mkProperty(true, ignoreInvalid),
			if: () => mkProperty(required, true),
		});

		return getProperty;
	}

	function mkRestProperties<
		Required extends boolean,
		IgnoreInvalid extends boolean,
	>(required: Required, ignoreInvalid: IgnoreInvalid) {
		const getRestProperties = getRestPropertiesHelper(
			state,
			extractor,
			required,
			ignoreInvalid,
			validateType,
		) as RestProperty<IncludeTag, Required, IgnoreInvalid>;

		defineLazyProperties(getRestProperties, {
			enum: () =>
				getRestPropertiesHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validateEnum,
				),
			pattern: () =>
				getRestPropertiesHelper(
					state,
					extractor,
					required,
					ignoreInvalid,
					validatePattern,
				),

			required: () => mkRestProperties(true, ignoreInvalid),
			if: () => mkRestProperties(required, true),
		});

		return getRestProperties;
	}

	return mkProperty(false, false);
}

function makeChildren(state: ContextState): [child: Child, children: Children] {
	function mkChild<Required extends boolean, Single extends boolean>(
		required: Required,
		single: Single,
	): Child<Required, Single> {
		const getChild = ((name, deserializer, ...parameters) => {
			let result;
			let foundMatch = false;

			for (const child of state.children) {
				if (child.getName() !== name) {
					continue;
				}

				if (foundMatch) {
					throw new KdlDeserializeError(
						`Expected a single child called ${JSON.stringify(name)} but found multiple`,
						{location: child},
					);
				}

				foundMatch = true;
				result = deserialize(child, deserializer, ...parameters);
				state.children.delete(child);

				if (!single) {
					// we can stop here, no need to continue looking for other children with the same name
					return result;
				}
			}

			if (required && !foundMatch) {
				throw new KdlDeserializeError(
					`Expected a child called ${JSON.stringify(name)} but found none`,
					{location: state.node},
				);
			}

			return result;
		}) as Child<Required, Single>;

		if (!required) {
			let requiredChild;
			Object.defineProperty(getChild, "required", {
				get() {
					return (requiredChild ??= mkChild(true, single));
				},
			});
		}

		if (!single) {
			let singleChild;
			Object.defineProperty(getChild, "single", {
				get() {
					return (singleChild ??= mkChild(required, true));
				},
			});
		}

		return getChild;
	}

	const children = ((name, deserializer, ...parameters) => {
		const result = [];

		for (const child of state.children) {
			if (child.getName() !== name) {
				continue;
			}

			state.children.delete(child);
			result.push(deserialize(child, deserializer, ...parameters));
		}

		return result;
	}) as Children;

	children.required = ((name, deserializer, ...parameters) => {
		const result = [];

		for (const child of state.children) {
			if (child.getName() !== name) {
				continue;
			}

			state.children.delete(child);
			result.push(deserialize(child, deserializer, ...parameters));
		}

		if (result.length === 0) {
			throw new KdlDeserializeError(
				`Expected at least one child called ${JSON.stringify(name)} but found none`,
				{location: state.node},
			);
		}

		return result;
	}) as Children["required"];

	children.entries = ((deserializer, ...parameters) => {
		const result: [string, Deserialized<typeof deserializer>][] = Array.from(
			state.children,
			(child) => [
				child.getName(),
				deserialize(child, deserializer, ...parameters),
			],
		);
		state.children.clear();
		return result;
	}) as Children["entries"];

	children.entries.filtered = ((filter, deserializer, ...parameters) => {
		const result: [string, Deserialized<typeof deserializer>][] = [];

		for (const child of state.children) {
			const name = child.getName();
			if (!filter.test(name)) {
				continue;
			}

			state.children.delete(child);
			result.push([name, deserialize(child, deserializer, ...parameters)]);
		}

		return result;
	}) as Children["entries"]["filtered"];

	children.entries.unique = ((deserializer, ...parameters) => {
		const result = new Map<string, Deserialized<typeof deserializer>>();

		for (const child of state.children) {
			const name = child.getName();

			if (result.has(name)) {
				throw new KdlDeserializeError(
					`Encountered multiple children named ${JSON.stringify(name)} but expected unique names`,
					{location: child},
				);
			}

			state.children.delete(child);
			result.set(name, deserialize(child, deserializer, ...parameters));
		}

		return Array.from(result);
	}) as Children["entries"]["unique"];

	children.entries.filtered.unique = children.entries.unique.filtered = (
		filter,
		deserializer,
		...parameters
	) => {
		const result = new Map<string, Deserialized<typeof deserializer>>();

		for (const child of state.children) {
			const name = child.getName();
			if (!filter.test(name)) {
				continue;
			}

			if (result.has(name)) {
				throw new KdlDeserializeError(
					`Encountered multiple children named ${JSON.stringify(name)} but expected unique names`,
					{location: child},
				);
			}

			state.children.delete(child);
			result.set(name, deserialize(child, deserializer, ...parameters));
		}

		return Array.from(result);
	};

	return [mkChild(false, false), children];
}

const kState = Symbol.for("@bgotink/kdl:deserialization-state");

export function getState(context: DeserializationContext) {
	return (context as DeserializationContext & {[kState]: ContextState})[kState];
}

export function isDeserializerFromContext<T, P extends unknown[] = []>(
	deserializer: Deserializer<T, P>,
): deserializer is DeserializerFromContext<T, P> {
	return !("deserializeFromNode" in deserializer);
}

/**
 * Deserialize the given {@link Document} or {@link Node} using the given {@link Deserializer deserializer}.
 *
 * If this function is given a {@link Document}, it will be wrapped with a nameless node (using "-" as name) without any arguments or properties.
 */
export function deserialize<T, P extends unknown[] = []>(
	node: Node | Document,
	deserializer: Deserializer<T, P>,
	...parameters: P
): T {
	if (node.type === "document") {
		node = new Node(new Identifier("-"), undefined, node);
	}

	if (!isDeserializerFromContext(deserializer)) {
		try {
			return deserializer.deserializeFromNode(node, ...parameters);
		} catch (e) {
			if (e instanceof KdlDeserializeError) {
				throw e;
			} else {
				throw new KdlDeserializeError(`Deserializer failed: ${String(e)}`, {
					location: node,
					cause: e,
				});
			}
		}
	}

	return deserializeFromState(
		new ContextState(node),
		deserializer,
		...parameters,
	);
}

/**
 * Deserialize the given {@link ContextState} using the given {@link DeserializationContext<T, P> deserializer}.
 */
export function deserializeFromState<T, P extends unknown[] = []>(
	state: ContextState,
	deserializer: DeserializerFromContext<T, P>,
	...parameters: P
): T {
	const json = ((...types: JsonType[]) => {
		const {args, props, children} = state.clear();

		if (!args.length && !props.size && !children.size) {
			const tag = state.node.getTag();
			if (tag !== "object" && tag !== "array") {
				return undefined;
			}
		}

		const value = deserializeJson(
			types,
			state.node,
			args,
			props,
			Array.from(children),
		);

		if (types.length && !hasValidJsonType(types, value)) {
			throw new KdlDeserializeError(
				`Expected a ${joinWithOr(types)} but got a ${jsonTypeOf(value)}`,
				{location: state.node},
			);
		}

		return value;
	}) as Json;

	json.required = (...types: JsonType[]) => {
		const {args, props, children} = state.clear();

		const value = deserializeJson(
			types,
			state.node,
			args,
			props,
			Array.from(children),
		);

		if (types.length && !hasValidJsonType(types, value)) {
			throw new KdlDeserializeError(
				`Expected a ${joinWithOr(types)} but got a ${jsonTypeOf(value)}`,
				{location: state.node},
			);
		}

		return value;
	};

	const run = ((deserializer, ...params) => {
		if (!isDeserializerFromContext(deserializer)) {
			throw new TypeError(
				"Expected a DeserializerFromContext, got a DeserializerFromNode",
			);
		}

		const stateBefore = state.clone();
		try {
			return "deserialize" in deserializer ?
					deserializer.deserialize(context, ...params)
				:	deserializer(context, ...params);
		} catch (e) {
			state.apply(stateBefore);

			if (e instanceof KdlDeserializeError) {
				throw e;
			} else {
				throw new KdlDeserializeError(`Deserializer failed: ${String(e)}`, {
					location: state.node,
					cause: e,
				});
			}
		}
	}) as Run;

	run.try = <T, P extends unknown[]>(
		deserializer: DeserializerFromContext<T, P>,
		...params: P
	) => {
		try {
			return run(deserializer, ...params);
		} catch (e) {
			if (e instanceof KdlDeserializeError) {
				return null;
			}

			throw e;
		}
	};

	const [child, children] = makeChildren(state);
	const context: DeserializationContext & {[kState]: ContextState} = {
		name: state.node.getName(),
		tag: state.node.getTag(),

		argument: makeArgument(state, false),
		property: makeProperty(state, false),
		child,
		children,
		json,

		run,

		tagged: {
			argument: makeArgument(state, true),
			property: makeProperty(state, true),
		},

		[kState]: state,
	};

	storeNodeForContext(context, state.node);

	const result = run(deserializer, ...parameters);

	state.finalize();

	return result;
}

/**
 * Parse the given KDL text as a document and run it through the given deserializer
 *
 * The deserializer will only have access to children, as a document has no arguments or properties.
 *
 * This is a small function that runs {@link parseDocument parse} and then runs the resulting {@link Document} through {@link deserialize}.
 */
export function parse<T>(
	text: Parameters<typeof parseDocument>[0],
	deserializer: Deserializer<T>,
): T {
	return deserialize(parseDocument(text), deserializer);
}
