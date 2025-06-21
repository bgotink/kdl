import {Identifier, Node, parse as parseDocument} from "../../index.js";
import {deserializeJson} from "../json.js";
import {storeNodeForContext} from "../shared.js";

import {KdlDeserializeError} from "./error.js";
import {joinWithAnd, joinWithOr} from "./utils.js";

/** @import * as t from "./types.js" */
/** @import {Document, Entry, Primitive} from "../../index.js" */
/** @import {JsonValue, JsonObject} from "../../json.js" */

/** @param {Primitive} value */
function primitiveTypeOf(value) {
	return value === null ? "null" : (
			/** @type {t.PrimitiveType} */ (typeof value)
		);
}

/**
 * @template {t.PrimitiveType[]} T
 * @param {T} types
 * @param {Primitive} value
 * @returns {value is t.TypeOf<T>}
 */
function hasValidType(types, value) {
	return types.includes(primitiveTypeOf(value));
}

/**
 * @param {JsonValue} value
 * @returns {t.JsonType}
 */
function jsonTypeOf(value) {
	if (Array.isArray(value)) {
		return "array";
	}
	if (typeof value === "object") {
		return value === null ? "null" : "object";
	}
	return primitiveTypeOf(value);
}

/**
 * @template {t.JsonType[]} T
 * @param {T} types
 * @param {JsonValue} value
 * @returns {value is t.JsonTypeOf<T>}
 */
function hasValidJsonType(types, value) {
	return types.includes(jsonTypeOf(value));
}

class ContextState {
	node;

	arguments;
	properties;
	children;

	/** @param {Node} node */
	constructor(
		node,
		args = node.getArgumentEntries(),
		properties = new Map(
			node
				.getPropertyEntries()
				.map((entry) => [/** @type {string} */ (entry.getName()), entry]),
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

	/** @param {ContextState} other */
	apply(other) {
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
			).reduce((obj, name) => {
				obj[name] = (Object.hasOwn(obj, name) ? obj[name] : 0) + 1;

				return obj;
			}, /** @type {Record<string, number>} */ ({}));

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

/**
 * @param {ContextState} state
 * @returns {t.Argument}
 */
function makeArgument(state) {
	/**
	 * @template {boolean} Required
	 * @template {boolean} IgnoreInvalid
	 * @param {Required} required
	 * @param {IgnoreInvalid} ignoreInvalid
	 * @returns {t.Argument<Required, false, IgnoreInvalid>}
	 */
	function mkArgument(required, ignoreInvalid) {
		const getArgument =
			/** @type {t.Argument<Required, false, IgnoreInvalid>} */ (
				/** @type {unknown} */ (
					/** @param {...t.PrimitiveType} types */
					(...types) => {
						const arg = state.arguments[0];
						if (arg === undefined) {
							if (!required) {
								return undefined;
							}

							throw new KdlDeserializeError(`Missing argument`, {
								location: state.node,
							});
						}
						const value = arg.getValue();

						if (types.length && !hasValidType(types, value)) {
							if (ignoreInvalid) {
								return undefined;
							}

							throw new KdlDeserializeError(
								`Expected a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
								{location: arg},
							);
						}

						state.arguments.shift();
						return value;
					}
				)
			);

		// @ts-expect-error Mapped return types + type inference run into limitations
		getArgument.enum = (...enumValues) => {
			const arg = state.arguments[0];
			if (arg === undefined) {
				if (!required) {
					return undefined;
				}

				throw new KdlDeserializeError(`Missing argument`, {
					location: state.node,
				});
			}
			const value = arg.getValue();

			if (!enumValues.includes(value)) {
				if (ignoreInvalid) {
					return undefined;
				}

				throw new KdlDeserializeError(
					`Expected one of ${joinWithOr(enumValues.map((v) => JSON.stringify(v)))} but got ${JSON.stringify(value)}`,
					{location: arg},
				);
			}

			state.arguments.shift();
			return value;
		};

		let restBuilder;
		Object.defineProperty(getArgument, "rest", {
			get() {
				return (restBuilder ??= mkRestArgument(required, ignoreInvalid));
			},
		});

		if (!required) {
			let requiredBuilder;
			Object.defineProperty(getArgument, "required", {
				get() {
					return (requiredBuilder ??= mkArgument(true, ignoreInvalid));
				},
			});
		}

		if (!ignoreInvalid) {
			let ifBuilder;
			Object.defineProperty(getArgument, "if", {
				get() {
					return (ifBuilder ??= mkArgument(required, true));
				},
			});
		}

		return getArgument;
	}

	/**
	 * @template {boolean} Required
	 * @template {boolean} IgnoreInvalid
	 * @param {Required} required
	 * @param {IgnoreInvalid} ignoreInvalid
	 * @returns {t.Argument<Required, true, IgnoreInvalid>}
	 */
	function mkRestArgument(required, ignoreInvalid) {
		const getArgument =
			/** @type {t.Argument<Required, true, IgnoreInvalid>} */ (
				/** @param {...t.PrimitiveType} types */
				(...types) => {
					if (required) {
						throw new KdlDeserializeError(`Missing argument`, {
							location: state.node,
						});
					}

					return state.arguments
						.splice(0, state.arguments.length)
						.flatMap((arg) => {
							const value = arg.getValue();

							if (types.length && !hasValidType(types, value)) {
								if (ignoreInvalid) {
									state.arguments.push(arg);
									return [];
								}

								throw new KdlDeserializeError(
									`Expected a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
									{location: arg},
								);
							}

							return [value];
						});
				}
			);

		// @ts-expect-error Mapped return types + type inference run into limitations
		getArgument.enum = (...enumValues) => {
			if (required && state.arguments.length === 0) {
				throw new KdlDeserializeError(`Missing argument`, {
					location: state.node,
				});
			}

			return state.arguments
				.splice(0, state.arguments.length)
				.flatMap((arg) => {
					const value = arg.getValue();

					if (!enumValues.includes(value)) {
						if (ignoreInvalid) {
							state.arguments.push(arg);
							return [];
						}

						throw new KdlDeserializeError(
							`Expected one of ${joinWithOr(enumValues.map((v) => JSON.stringify(v)))} but got ${JSON.stringify(value)}`,
							{location: arg},
						);
					}

					return [value];
				});
		};

		if (!required) {
			let requiredBuilder;
			Object.defineProperty(getArgument, "required", {
				get() {
					return (requiredBuilder ??= mkRestArgument(true, ignoreInvalid));
				},
			});
		}

		if (!ignoreInvalid) {
			let ifBuilder;
			Object.defineProperty(getArgument, "if", {
				get() {
					return (ifBuilder ??= mkRestArgument(required, true));
				},
			});
		}

		return getArgument;
	}

	return mkArgument(false, false);
}

/**
 * @param {ContextState} state
 * @returns {t.Property}
 */
function makeProperty(state) {
	/**
	 * @template {boolean} Required
	 * @template {boolean} IgnoreInvalid
	 * @param {Required} required
	 * @param {IgnoreInvalid} ignoreInvalid
	 * @returns {t.Property<Required, IgnoreInvalid>}
	 */
	function mkProperty(required, ignoreInvalid) {
		const getProperty = /** @type {t.Property<Required, IgnoreInvalid>} */ (
			/** @type {unknown} */ (
				/**
				 * @param {string} name
				 * @param {...t.PrimitiveType} types
				 */
				(name, ...types) => {
					const prop = state.properties.get(name);
					if (prop === undefined) {
						if (!required) {
							return prop;
						}

						throw new KdlDeserializeError(`Missing property ${name}`, {
							location: state.node,
						});
					}
					const value = prop.getValue();

					if (types.length && !hasValidType(types, value)) {
						if (ignoreInvalid) {
							return undefined;
						}

						throw new KdlDeserializeError(
							`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
							{location: prop},
						);
					}

					state.properties.delete(name);
					return value;
				}
			)
		);

		// @ts-expect-error Mapped return types + type inference run into limitations
		getProperty.enum = (name, ...enumValues) => {
			const prop = state.properties.get(name);
			if (prop === undefined) {
				if (!required) {
					return prop;
				}

				throw new KdlDeserializeError(`Missing property ${name}`, {
					location: state.node,
				});
			}
			const value = prop.getValue();

			if (!enumValues.includes(value)) {
				if (ignoreInvalid) {
					return undefined;
				}

				throw new KdlDeserializeError(
					`Expected property ${name} to be onf of ${joinWithOr(enumValues.map((v) => JSON.stringify(v)))} but got ${JSON.stringify(value)}`,
					{location: prop},
				);
			}

			state.properties.delete(name);
			return value;
		};

		let restBuilder;
		Object.defineProperty(getProperty, "rest", {
			get() {
				return (restBuilder ??= mkRestProperties(required, ignoreInvalid));
			},
		});

		if (!required) {
			let requiredBuilder;
			Object.defineProperty(getProperty, "required", {
				get() {
					return (requiredBuilder ??= mkProperty(true, ignoreInvalid));
				},
			});
		}

		if (!ignoreInvalid) {
			let ifBuilder;
			Object.defineProperty(getProperty, "if", {
				get() {
					return (ifBuilder ??= mkProperty(required, true));
				},
			});
		}

		return getProperty;
	}

	/**
	 * @template {boolean} Required
	 * @template {boolean} IgnoreInvalid
	 * @param {Required} required
	 * @param {IgnoreInvalid} ignoreInvalid
	 * @returns {t.RestProperty<Required, IgnoreInvalid>}
	 */
	function mkRestProperties(required, ignoreInvalid) {
		const getProperty = /** @type {t.RestProperty<Required, IgnoreInvalid>} */ (
			/** @type {unknown} */ (
				/** @param {...t.PrimitiveType} types */
				(...types) => {
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

							if (types.length && !hasValidType(types, value)) {
								if (ignoreInvalid) {
									state.properties.set(name, prop);
									return [];
								}

								throw new KdlDeserializeError(
									`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
									{location: prop},
								);
							}

							return [[name, value]];
						}),
					);
				}
			)
		);

		getProperty.enum = (...enumValues) => {
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

					if (!enumValues.includes(value)) {
						if (ignoreInvalid) {
							state.properties.set(name, prop);
							return [];
						}

						throw new KdlDeserializeError(
							`Expected property ${name} to be one of ${joinWithOr(enumValues.map((v) => JSON.stringify(v)))} but got ${JSON.stringify(value)}`,
							{location: prop},
						);
					}

					return [[name, value]];
				}),
			);
		};

		if (!required) {
			let requiredBuilder;
			Object.defineProperty(getProperty, "required", {
				get() {
					return (requiredBuilder ??= mkProperty(true, ignoreInvalid));
				},
			});
		}

		if (!ignoreInvalid) {
			let ifBuilder;
			Object.defineProperty(getProperty, "if", {
				get() {
					return (ifBuilder ??= mkProperty(required, true));
				},
			});
		}

		return getProperty;
	}

	return mkProperty(false, false);
}

/**
 * @param {ContextState} state
 * @return {[child: t.Child, children: t.Children]}
 */
function makeChildren(state) {
	/**
	 * @template {boolean} Required
	 * @template {boolean} Single
	 * @param {Required} required
	 * @param {Single} single
	 * @returns {t.Child<Required, Single>}
	 */
	function mkChild(required, single) {
		const getChild = /** @type {t.Child<Required, Single>} */ (
			(name, deserializer, ...parameters) => {
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
			}
		);

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

	const children = /** @type {t.Children} */ (
		(name, deserializer, ...parameters) => {
			const result = [];

			for (const child of state.children) {
				if (child.getName() !== name) {
					continue;
				}

				state.children.delete(child);
				result.push(deserialize(child, deserializer, ...parameters));
			}

			return result;
		}
	);

	children.required = /** @type {t.Children['required']} */ (
		(name, deserializer, ...parameters) => {
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
		}
	);

	children.entries = /** @type {t.Children['entries']} */ (
		(deserializer, ...parameters) => {
			/** @type {[string, t.Deserialized<typeof deserializer>][]} */
			const result = Array.from(state.children, (child) => [
				child.getName(),
				deserialize(child, deserializer, ...parameters),
			]);
			state.children.clear();
			return result;
		}
	);

	children.entries.filtered = /** @type {t.Children['entries']['filtered']} */ (
		(filter, deserializer, ...parameters) => {
			/** @type {[string, t.Deserialized<typeof deserializer>][]} */
			const result = [];

			for (const child of state.children) {
				const name = child.getName();
				if (!filter.test(name)) {
					continue;
				}

				state.children.delete(child);
				result.push([name, deserialize(child, deserializer, ...parameters)]);
			}

			return result;
		}
	);

	children.entries.unique = /** @type {t.Children['entries']['unique']} */ (
		(deserializer, ...parameters) => {
			/** @type {Map<string, t.Deserialized<typeof deserializer>>} */
			const result = new Map();

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
		}
	);

	children.entries.filtered.unique = children.entries.unique.filtered = (
		filter,
		deserializer,
		...parameters
	) => {
		/** @type {Map<string, t.Deserialized<typeof deserializer>>} */
		const result = new Map();

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

/** @param {t.DeserializationContext} context */
export function getState(context) {
	return /** @type {t.DeserializationContext & {[kState]: ContextState}} */ (
		context
	)[kState];
}

/**
 * @template T
 * @template {unknown[]} [P=[]]
 * @param {t.Deserializer<T, P>} deserializer
 * @returns {deserializer is t.DeserializerFromContext<T, P>}
 */
export function isDeserializerFromContext(deserializer) {
	return !("deserializeFromNode" in deserializer);
}

/**
 * Deserialize the given {@link Document} or {@link Node} using the given {@link t.Deserializer deserializer}.
 *
 * If this function is given a {@link Document}, it will be wrapped with a nameless node (using "-" as name) without any arguments or properties.
 *
 * @template T
 * @template {unknown[]} [P=[]]
 * @param {Node | Document} node
 * @param {t.Deserializer<T, P>} deserializer
 * @param {P} parameters
 * @returns {T}
 */
export function deserialize(node, deserializer, ...parameters) {
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
 * Deserialize the given {@link ContextState} using the given {@link t.DeserializationContext<T, P> deserializer}.
 *
 * @template T
 * @template {unknown[]} [P=[]]
 * @param {ContextState} state
 * @param {t.DeserializerFromContext<T, P>} deserializer
 * @param {P} parameters
 * @returns {T}
 */
export function deserializeFromState(state, deserializer, ...parameters) {
	const argument = makeArgument(state);
	const property = makeProperty(state);
	const [child, children] = makeChildren(state);

	const json = /** @type {t.Json} */ (
		/** @param {...t.JsonType} types */
		(...types) => {
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
		}
	);

	json.required = /** @type {t.Json["required"]} */ (
		/** @param {...t.JsonType} types */
		(...types) => {
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
		}
	);

	/** @type {t.DeserializationContext["run"]} */
	const run = (deserializer, ...params) => {
		if (!isDeserializerFromContext(deserializer)) {
			throw new TypeError(
				"Expected a DeserializerFromContext, got a DeserializerFromNode",
			);
		}

		try {
			return "deserialize" in deserializer ?
					deserializer.deserialize(context, ...params)
				:	deserializer(context, ...params);
		} catch (e) {
			if (e instanceof KdlDeserializeError) {
				throw e;
			} else {
				throw new KdlDeserializeError(`Deserializer failed: ${String(e)}`, {
					location: state.node,
					cause: e,
				});
			}
		}
	};

	/** @type {t.DeserializationContext & {[kState]: ContextState}} */
	const context = {
		name: state.node.getName(),
		tag: state.node.getTag(),

		argument,
		property,
		child,
		children,
		json,

		run,

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
 *
 * @template T
 * @param {Parameters<typeof parseDocument>[0]} text
 * @param {t.Deserializer<T>} deserializer
 * @returns {T}
 */
export function parse(text, deserializer) {
	return deserialize(parseDocument(text), deserializer);
}
