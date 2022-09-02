import {Document, Node} from './model.js';

export class InvalidJsonInKdlError extends Error {
	constructor(message: string);
}

export interface JsonObject {
	[property: string]: JsonValue;
}

export type JsonValue =
	| null
	| number
	| boolean
	| string
	| JsonObject
	| JsonValue[];

export function toJson(nodeOrDocument: Node | Document): JsonValue;
