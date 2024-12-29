import {JsonValue} from "../../json.js";
import {Node, Primitive} from "../../model.js";

export type Tagged<F extends Function> =
	F extends (...args: infer A) => infer R ?
		{
			(...args: A): R;
			tagged(type: string, ...args: A): R;
		}
	:	never;

export type SerializerFromContext<P extends unknown[]> =
	| ((ctx: SerializationContext, ...parameters: P) => void)
	| {serialize(ctx: SerializationContext, ...parameters: P): void};

export type Serializer<P extends unknown[]> =
	| SerializerFromContext<P>
	| {serializeToNode(name: string, ...parameters: P): Node};

export interface SerializationContext {
	argument: Tagged<(value: Primitive) => void>;

	property: Tagged<(name: string, value: Primitive) => void>;

	// Can't use Tagged here because of the generics
	child: {
		<P extends unknown[]>(
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
		tagged<P extends unknown[]>(
			tag: string,
			name: string,
			serializer: Serializer<P>,
			...params: P
		): void;
	};

	json(value: JsonValue): void;

	run<P extends unknown[]>(
		serializer: SerializerFromContext<P>,
		...parameters: P
	): void;
}
