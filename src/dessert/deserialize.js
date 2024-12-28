import {Identifier, Node, parse as parseDocument} from "../index.js";
import {toJson} from "../json.js";

import {KdlDeserializeError} from "./error.js";
import {joinWithAnd, joinWithOr} from "./utils.js";

/** @import * as t from "./types.js" */
/** @import {Document, Value} from "../index.js" */
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
 * @returns {[argument: t.Argument, finalize: (validate: boolean) => void, hasConsumedArguments: () => boolean]}
 */
function makeArgument(node) {
	const unusedArguments = node.getArguments();
	const numberOfArguments = unusedArguments.length;

	const argument = /** @type {t.Argument} */ (
		/** @param {...t.PrimitiveType} types */
		(...types) => {
			const argument = unusedArguments[0];
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
		const argument = unusedArguments[0];
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
			const argument = unusedArguments[0];
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

	argument.rest = () => unusedArguments.splice(0, unusedArguments.length);

	return [
		argument,
		(validate) => {
			if (validate && unusedArguments.length) {
				throw new KdlDeserializeError(
					`Found ${unusedArguments.length} superfluous arguments`,
				);
			}

			unusedArguments.length = 0;
		},
		() => unusedArguments.length < numberOfArguments,
	];
}

/**
 * @param {Node} node
 * @returns {[property: t.Property, finalize: (validate: boolean) => void, hasConsumedProperties: () => boolean]}
 */
function makeProperty(node) {
	const unusedProperties = node.getProperties();
	const numberOfProperties = unusedProperties.size;

	const property = /** @type {t.Property} */ (
		/**
		 * @param {string} name
		 * @param {...t.PrimitiveType} types
		 */
		(name, ...types) => {
			const argument = unusedProperties.get(name);
			if (argument === undefined) {
				return argument;
			}

			if (types.length && !hasValidType(types, argument)) {
				throw new KdlDeserializeError(
					`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(argument)}`,
				);
			}

			unusedProperties.delete(name);
			return argument;
		}
	);

	property.if = (name, ...types) => {
		const argument = unusedProperties.get(name);
		if (argument === undefined) {
			return argument;
		}

		if (!hasValidType(types, argument)) {
			return undefined;
		}

		unusedProperties.delete(name);
		return argument;
	};

	property.required = /** @type {t.Property['required'] } */ (
		/**
		 * @param {string} name
		 * @param {...t.PrimitiveType} types
		 */
		(name, ...types) => {
			const argument = unusedProperties.get(name);
			if (argument === undefined) {
				throw new KdlDeserializeError(`Missing property ${name}`);
			}

			if (types.length && !hasValidType(types, argument)) {
				throw new KdlDeserializeError(
					`Expected property ${name} to be a ${joinWithOr(types)} but got ${primitiveTypeOf(argument)}`,
				);
			}

			unusedProperties.delete(name);
			return argument;
		}
	);

	return [
		property,
		(validate) => {
			if (validate && unusedProperties.size) {
				throw new KdlDeserializeError(
					`Found superfluous properties ${joinWithAnd(Array.from(unusedProperties.keys(), (name) => JSON.stringify(name)))}`,
				);
			}

			unusedProperties.clear();
		},
		() => unusedProperties.size < numberOfProperties,
	];
}

/**
 * @param {Node} node
 * @return {[child: t.Child, children: t.Children, finalize: (validate: boolean) => void, hasConsumedChildren: () => boolean]}
 */
function makeChildren(node) {
	const unusedChildren = new Set(node.children?.nodes);
	const numberOfChildren = unusedChildren.size;

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
		(validate) => {
			if (validate && unusedChildren.size) {
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

			unusedChildren.clear();
		},
		() => unusedChildren.size < numberOfChildren,
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

	const [argument, finalizeArgument, hasConsumedArguments] = makeArgument(node);
	const [property, finalizeProperty, hasConsumedProperties] =
		makeProperty(node);
	const [child, children, finalizeChildren, hasConsumedChildren] =
		makeChildren(node);

	const finalizers = [finalizeArgument, finalizeProperty, finalizeChildren];

	const json = /** @type {t.Json} */ (
		/** @param {...t.JsonType} types */
		(...types) => {
			if (hasConsumedChildren()) {
				throw new KdlDeserializeError(
					`Cannot call .json() if any children were already used`,
				);
			}
			if (hasConsumedProperties()) {
				throw new KdlDeserializeError(
					`Cannot call .json() if any properties were already used`,
				);
			}

			const value = toJson(node, {
				ignoreValues: hasConsumedArguments(),
			});

			if (types.length && !hasValidJsonType(types, value)) {
				throw new KdlDeserializeError(
					`Expected a ${joinWithOr(types)} but got a ${jsonTypeOf(value)}`,
				);
			}

			for (const finalizer of finalizers) {
				finalizer(false);
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

	for (const finalizer of finalizers) {
		finalizer(true);
	}

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
