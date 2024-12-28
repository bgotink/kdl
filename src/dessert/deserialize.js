import {Identifier, Node, parse as parseDocument} from "../index.js";
import {InvalidJsonInKdlError, nodePartsToJsonValue} from "../json-impl.js";

import {KdlDeserializeError} from "./error.js";
import {joinWithAnd, joinWithOr} from "./utils.js";

/** @import * as t from "./types.js" */
/** @import {Document, Entry, Value} from "../index.js" */
/** @import {JsonValue, JsonObject} from "../json.js" */

/** @param {Value['value']} value */
function primitiveTypeOf(value) {
	return value === null ? "null" : (
			/** @type {t.PrimitiveType} */ (typeof value)
		);
}

/**
 * @template {t.PrimitiveType[]} T
 * @param {T} types
 * @param {Value['value']} value
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

/**
 * @param {Node} node
 * @returns {[argument: t.Argument, finalize: () => void, getRest: () => Entry[]]}
 */
function makeArgument(node) {
	const unusedArguments = node.getArgumentEntries();

	const argument = /** @type {t.Argument} */ (
		/** @param {...t.PrimitiveType} types */
		(...types) => {
			const argument = unusedArguments[0].getValue();
			if (argument === undefined) {
				return argument;
			}

			if (types.length && !hasValidType(types, argument)) {
				throw new KdlDeserializeError(
					`Expected a ${joinWithOr(types)} but got ${primitiveTypeOf(argument)}`,
				);
			}

			unusedArguments.shift();
			return argument;
		}
	);

	argument.if = (...types) => {
		const argument = unusedArguments[0].getValue();
		if (argument === undefined) {
			return argument;
		}

		if (!hasValidType(types, argument)) {
			return undefined;
		}

		unusedArguments.shift();
		return argument;
	};

	argument.required = /** @type {t.Argument['required'] } */ (
		/** @param {...t.PrimitiveType} types */
		(...types) => {
			const argument = unusedArguments[0].getValue();
			if (argument === undefined) {
				throw new KdlDeserializeError(`Missing argument`);
			}

			if (types.length && !hasValidType(types, argument)) {
				throw new KdlDeserializeError(
					`Expected a ${joinWithOr(types)} but got ${primitiveTypeOf(argument)}`,
				);
			}

			unusedArguments.shift();
			return argument;
		}
	);

	argument.rest = () =>
		unusedArguments
			.splice(0, unusedArguments.length)
			.map((entry) => entry.getValue());

	return [
		argument,
		() => {
			if (unusedArguments.length) {
				throw new KdlDeserializeError(
					`Found ${unusedArguments.length} superfluous arguments`,
				);
			}
		},
		() => unusedArguments.splice(0, unusedArguments.length),
	];
}

/**
 * @param {Node} node
 * @returns {[property: t.Property, finalize: () => void, getRest: () => Map<string, Entry>]}
 */
function makeProperty(node) {
	const unusedProperties = new Map(
		node
			.getPropertyEntries()
			.map((entry) => [/** @type {string} */ (entry.getName()), entry]),
	);

	const property = /** @type {t.Property} */ (
		/**
		 * @param {string} name
		 * @param {...t.PrimitiveType} types
		 */
		(name, ...types) => {
			const prop = unusedProperties.get(name);
			if (prop === undefined) {
				return prop;
			}
			const value = prop.getValue();

			if (types.length && !hasValidType(types, value)) {
				throw new KdlDeserializeError(
					`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
				);
			}

			unusedProperties.delete(name);
			return value;
		}
	);

	property.if = (name, ...types) => {
		const prop = unusedProperties.get(name);
		if (prop === undefined) {
			return prop;
		}
		const value = prop.getValue();

		if (!hasValidType(types, value)) {
			return undefined;
		}

		unusedProperties.delete(name);
		return value;
	};

	property.required = /** @type {t.Property['required'] } */ (
		/**
		 * @param {string} name
		 * @param {...t.PrimitiveType} types
		 */
		(name, ...types) => {
			const prop = unusedProperties.get(name);
			if (prop === undefined) {
				throw new KdlDeserializeError(`Missing property ${name}`);
			}
			const value = prop.getValue();

			if (types.length && !hasValidType(types, value)) {
				throw new KdlDeserializeError(
					`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(value)}`,
				);
			}

			unusedProperties.delete(name);
			return value;
		}
	);

	property.rest = () => {
		const result = new Map(
			Array.from(unusedProperties, ([name, prop]) => [name, prop.getValue()]),
		);
		unusedProperties.clear();
		return result;
	};

	return [
		property,
		() => {
			if (unusedProperties.size) {
				throw new KdlDeserializeError(
					`Found superfluous properties ${joinWithAnd(Array.from(unusedProperties.keys(), (name) => JSON.stringify(name)))}`,
				);
			}
		},
		() => {
			const result = new Map(unusedProperties);
			unusedProperties.clear();
			return result;
		},
	];
}

/**
 * @param {Node} node
 * @return {[child: t.Child, children: t.Children, finalize: () => void, getRest: () => Node[]]}
 */
function makeChildren(node) {
	const unusedChildren = new Set(node.children?.nodes);

	const child = /** @type {t.Child} */ (
		(name, deserializer) => {
			for (const child of unusedChildren) {
				if (child.getName() !== name) {
					continue;
				}

				unusedChildren.delete(child);
				return deserialize(child, deserializer);
			}

			return undefined;
		}
	);

	child.single = /** @type {t.Child['single']} */ (
		(name, deserializer) => {
			let result;
			let foundMatch = false;

			for (const child of unusedChildren) {
				if (child.getName() !== name) {
					continue;
				}

				if (foundMatch) {
					throw new KdlDeserializeError(
						`Expected a single child called ${JSON.stringify(name)} but found multiple`,
					);
				}

				foundMatch = true;
				result = deserialize(child, deserializer);
				unusedChildren.delete(child);
			}

			return result;
		}
	);

	child.required = /** @type {t.Child['required']} */ (
		(name, deserializer) => {
			for (const child of unusedChildren) {
				if (child.getName() !== name) {
					continue;
				}

				unusedChildren.delete(child);
				return deserialize(child, deserializer);
			}

			throw new KdlDeserializeError(
				`Expected a child called ${JSON.stringify(name)} but found none`,
			);
		}
	);

	child.single.required = child.required.single = (name, deserializer) => {
		let result;
		let foundMatch = false;

		for (const child of unusedChildren) {
			if (child.getName() !== name) {
				continue;
			}

			if (foundMatch) {
				throw new KdlDeserializeError(
					`Expected a single child called ${JSON.stringify(name)} but found multiple`,
				);
			}

			foundMatch = true;
			result = deserialize(child, deserializer);
			unusedChildren.delete(child);
		}

		if (!foundMatch) {
			throw new KdlDeserializeError(
				`Expected a child called ${JSON.stringify(name)} but found none`,
			);
		}

		return /** @type {any} */ (result);
	};

	const children = /** @type {t.Children} */ (
		(name, deserializer) => {
			const result = [];

			for (const child of unusedChildren) {
				if (child.getName() !== name) {
					continue;
				}

				unusedChildren.delete(child);
				result.push(deserialize(child, deserializer));
			}

			return result;
		}
	);

	children.required = /** @type {t.Children['required']} */ (
		(name, deserializer) => {
			const result = [];

			for (const child of unusedChildren) {
				if (child.getName() !== name) {
					continue;
				}

				unusedChildren.delete(child);
				result.push(deserialize(child, deserializer));
			}

			if (result.length === 0) {
				throw new KdlDeserializeError(
					`Expected at least one child called ${JSON.stringify(name)} but found none`,
				);
			}

			return result;
		}
	);

	children.entries = /** @type {t.Children['entries']} */ (
		(deserializer) => {
			/** @type {[string, t.Deserialized<typeof deserializer>][]} */
			const result = Array.from(unusedChildren, (child) => [
				child.getName(),
				deserialize(child, deserializer),
			]);
			unusedChildren.clear();
			return result;
		}
	);

	children.entries.filtered = /** @type {t.Children['entries']['filtered']} */ (
		(filter, deserializer) => {
			/** @type {[string, t.Deserialized<typeof deserializer>][]} */
			const result = [];

			for (const child of unusedChildren) {
				const name = child.getName();
				if (!filter.test(name)) {
					continue;
				}

				unusedChildren.delete(child);
				result.push([name, deserialize(child, deserializer)]);
			}

			return result;
		}
	);

	children.entries.unique = /** @type {t.Children['entries']['unique']} */ (
		(deserializer) => {
			/** @type {Map<string, t.Deserialized<typeof deserializer>>} */
			const result = new Map();

			for (const child of unusedChildren) {
				const name = child.getName();

				if (result.has(name)) {
					throw new KdlDeserializeError(
						`Encountered multiple children named ${JSON.stringify(name)} but expected unique names`,
					);
				}

				unusedChildren.delete(child);
				result.set(name, deserialize(child, deserializer));
			}

			return Array.from(result);
		}
	);

	children.entries.filtered.unique = children.entries.unique.filtered = (
		filter,
		deserializer,
	) => {
		/** @type {Map<string, t.Deserialized<typeof deserializer>>} */
		const result = new Map();

		for (const child of unusedChildren) {
			const name = child.getName();
			if (!filter.test(name)) {
				continue;
			}

			if (result.has(name)) {
				throw new KdlDeserializeError(
					`Encountered multiple children named ${JSON.stringify(name)} but expected unique names`,
				);
			}

			unusedChildren.delete(child);
			result.set(name, deserialize(child, deserializer));
		}

		return Array.from(result);
	};

	return [
		child,
		children,
		() => {
			if (unusedChildren.size) {
				// Replace with Object.groupBy once targeting node ≥ 22
				const counts = Array.from(unusedChildren, (child) =>
					child.getName(),
				).reduce((obj, name) => {
					obj[name] = (Object.hasOwn(obj, name) ? obj[name] : 0) + 1;

					return obj;
				}, /** @type {Record<string, number>} */ ({}));

				throw new KdlDeserializeError(
					`Found ${unusedChildren.size} superfluous children (${joinWithAnd(
						Object.entries(counts).map(
							([name, count]) => `${count} ${JSON.stringify(name)}`,
						),
					)})`,
				);
			}
		},
		() => {
			const result = Array.from(unusedChildren);
			unusedChildren.clear();
			return result;
		},
	];
}

/**
 * Deserialize the given {@link Document} or {@link Node} using the given {@link t.Deserializer deserializer}.
 *
 * If this function is given a {@link Document}, the deserializer only has access to children on the {@link t.DeserializeContext DeserializeContext}, no arguments or properties will be present.
 *
 * @template T
 * @param {Node | Document} node
 * @param {t.Deserializer<T>} deserializer
 * @returns {T}
 */
export function deserialize(node, deserializer) {
	if (node.type === "document") {
		node = new Node(new Identifier("-"), undefined, node);
	}

	if ("deserializeFromNode" in deserializer) {
		return deserializer.deserializeFromNode(node);
	}

	const [argument, finalizeArguments, getRemainingArguments] =
		makeArgument(node);
	const [property, finalizeProperties, getRemainingProperties] =
		makeProperty(node);
	const [child, children, finalizeChildren, getRemainingChildren] =
		makeChildren(node);

	const json = /** @type {t.Json} */ (
		/** @param {...t.JsonType} types */
		(...types) => {
			let value;

			const args = getRemainingArguments();
			const props = getRemainingProperties();
			const children = getRemainingChildren();

			if (!args.length && !props.size && !children.length) {
				return undefined;
			}

			try {
				value = /** @type {JsonValue} */ (
					nodePartsToJsonValue(node.getName(), args, props, children, {
						type: types.length === 1 ? types[0] : undefined,
					})
				);
			} catch (e) {
				if (e instanceof InvalidJsonInKdlError) {
					throw new KdlDeserializeError(
						`Failed to deserialize JSON ${types.length ? joinWithOr(types) : "value"}: ${e.message}`,
						{cause: e},
					);
				}

				throw e;
			}

			if (types.length && !hasValidJsonType(types, value)) {
				throw new KdlDeserializeError(
					`Expected a ${joinWithOr(types)} but got a ${jsonTypeOf(value)}`,
				);
			}

			return value;
		}
	);

	json.required = /** @type {t.Json["required"]} */ (
		/** @param {...t.JsonType} types */
		(...types) => {
			let value;

			const args = getRemainingArguments();
			const props = getRemainingProperties();
			const children = getRemainingChildren();

			try {
				value = /** @type {JsonValue} */ (
					nodePartsToJsonValue(node.getName(), args, props, children, {
						type: types.length === 1 ? types[0] : undefined,
					})
				);
			} catch (e) {
				if (e instanceof InvalidJsonInKdlError) {
					throw new KdlDeserializeError(
						`Failed to deserialize JSON ${types.length ? joinWithOr(types) : "value"}: ${e.message}`,
						{cause: e},
					);
				}

				throw e;
			}

			if (types.length && !hasValidJsonType(types, value)) {
				throw new KdlDeserializeError(
					`Expected a ${joinWithOr(types)} but got a ${jsonTypeOf(value)}`,
				);
			}

			return value;
		}
	);

	/** @type {t.DeserializeContext} */
	const context = {
		argument,
		property,
		child,
		children,
		json,
	};

	const result =
		"deserialize" in deserializer ?
			deserializer.deserialize(context)
		:	deserializer(context);

	finalizeArguments();
	finalizeProperties();
	finalizeChildren();

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
