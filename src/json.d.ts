import {Document, Node} from './model.js';

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

export function toJson(node: Node): JsonValue;
export function toJson(document: Document): JsonObject | JsonValue[];
export function toJson(nodeOrDocument: Node | Document): JsonValue;
