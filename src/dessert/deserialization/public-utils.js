import {
	deserialize,
	deserializeFromState,
	getState,
	isDeserializerFromContext,
} from "./deserialize.js";
import {KdlDeserializeError} from "./error.js";

/** @import {Node} from "../../index.js" */

/** @import {Deserialized, Deserializer, DeserializerFromContext} from "./types.js" */

/**
 * Call the given function with the given arguments until it returns undefined
 *
 * This function returns all return values apart from the final undefined.
 * If the given function returned undefined on the first call, this function returns undefined.
 *
 * @template {unknown[]} A
 * @template T
 * @param {(...args: NoInfer<A>) => T | undefined} fn
 * @param {A} args
 * @returns {[T, ...T[]] | undefined}
 */
export function repeat(fn, ...args) {
	/** @type {T[]} */
	const result = [];

	while (true) {
		const item = fn(...args);
		if (item !== undefined) {
			result.push(item);
		} else {
			break;
		}
	}

	return result.length ? /** @type {[T, ...T[]]} */ (result) : undefined;
}

/**
 * Call the given function the given number of times with the given arguments.
 *
 * @template {unknown[]} A
 * @template T
 * @param {number} times
 * @param {(...args: A) => T} fn
 * @param {A} args
 * @returns {T[]}
 */
repeat.times = (times, fn, ...args) => {
	return Array.from({length: times}, () => fn(...args));
};

/**
 * Create a deserializer that tries all of the given deserializers until it finds one that doesn't throw an error.
 *
 * The returned deserializer throws an `AggregateError` if all of the given deserializers throw.
 *
 * @template {DeserializerFromContext<unknown>[]} T
 * @overload
 * @param {...T} deserializers
 * @returns {DeserializerFromContext<Deserialized<T[number]>>}
 */

/**
 * Create a deserializer that tries all of the given deserializers until it finds one that doesn't throw an error.
 *
 * The returned deserializer throws an `AggregateError` if all of the given deserializers throw.
 *
 * @template {Deserializer<unknown>[]} T
 * @overload
 * @param {...T} deserializers
 * @returns {Deserializer<Deserialized<T[number]>>}
 */

/**
 * @param {Deserializer<unknown>[]} deserializers
 * @returns {Deserializer<unknown>}
 */
export function firstMatchingDeserializer(...deserializers) {
	/** @type {Set<Node>} */
	const runningNodes = new Set();

	if (deserializers.every(isDeserializerFromContext)) {
		return {
			deserialize(ctx) {
				const state = getState(ctx);

				const errors = [];

				for (const deserializer of deserializers) {
					const stateClone = state.clone();
					let result;

					try {
						result = deserializeFromState(
							stateClone,
							/** @type {DeserializerFromContext<Deserialized<T[number]>>} */ (
								deserializer
							),
						);
					} catch (e) {
						errors.push(e);
						continue;
					}

					state.apply(stateClone);
					return result;
				}

				throw new AggregateError(
					errors,
					"Failed to deserialize using any of the provided deserialiers",
				);
			},
		};
	}

	return {
		deserializeFromNode(node) {
			if (runningNodes.has(node)) {
				throw new KdlDeserializeError(
					"Loop detected trying to deserialize a node",
					{location: node},
				);
			}

			runningNodes.add(node);
			try {
				const errors = [];

				for (const deserializer of deserializers) {
					try {
						return deserialize(
							node,
							/** @type {Deserializer<Deserialized<T[number]>>} */ (
								deserializer
							),
						);
					} catch (e) {
						errors.push(e);
					}
				}

				throw new AggregateError(
					errors,
					"Failed to deserialize using any of the provided deserialiers",
				);
			} finally {
				runningNodes.delete(node);
			}
		},
	};
}
