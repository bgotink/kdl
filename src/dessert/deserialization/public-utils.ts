import type {Node} from "../../index.js";

import {
	deserialize,
	deserializeFromState,
	getState,
	isDeserializerFromContext,
} from "./deserialize.ts";
import {KdlDeserializeError} from "./error.js";
import type {
	Deserialized,
	Deserializer,
	DeserializerFromContext,
} from "./types.js";

/**
 * Call the given function with the given arguments until it returns undefined
 *
 * This function returns all return values apart from the final undefined.
 * If the given function returned undefined on the first call, this function returns undefined.
 */
export function repeat<A extends unknown[], T>(
	fn: (...args: NoInfer<A>) => T | undefined,
	...args: A
): [T, ...T[]] | undefined {
	const result: T[] = [];

	while (true) {
		const item = fn(...args);
		if (item !== undefined) {
			result.push(item);
		} else {
			break;
		}
	}

	return result.length ? (result as [T, ...T[]]) : undefined;
}

/**
 * Call the given function the given number of times with the given arguments.
 */
repeat.times = function <A extends unknown[], T>(
	times: number,
	fn: (...args: [...A, index: number]) => T,
	...args: A
): T[] {
	return Array.from({length: times}, (_, i) => fn(...args, i));
};

/**
 * Create a deserializer that tries all of the given deserializers until it finds one that doesn't throw an error.
 *
 * The returned deserializer throws an `AggregateError` if all of the given deserializers throw.
 */
export function firstMatchingDeserializer<
	T extends DeserializerFromContext<unknown>[],
>(...deserializers: T): DeserializerFromContext<Deserialized<T[number]>>;
/**
 * Create a deserializer that tries all of the given deserializers until it finds one that doesn't throw an error.
 *
 * The returned deserializer throws an `AggregateError` if all of the given deserializers throw.
 */
export function firstMatchingDeserializer<T extends Deserializer<unknown>[]>(
	...deserializers: T
): Deserializer<Deserialized<T[number]>>;
export function firstMatchingDeserializer(
	...deserializers: Deserializer<unknown>[]
): Deserializer<unknown> {
	const runningNodes = new Set<Node>();

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
							/** @type {DeserializerFromContext<Deserialized<T[number]>>} */ deserializer,
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
							/** @type {Deserializer<Deserialized<T[number]>>} */ deserializer,
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
