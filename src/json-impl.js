/** @import {Node, Entry} from "./index.js" */

const arrayItemKey = "-";

export class InvalidJsonInKdlError extends Error {
	name = "InvalidJsonInKdlError";
}

/**
 * @typedef {object} ToJsonOptions
 * @prop {boolean} [ignoreValues]
 * @prop {string} [type]
 * @prop {(value: unknown, key: string | number, data: {location: Node | import('@bgotink/kdl').Entry}) => unknown} [reviver]
 */

/**
 * @overload
 * @param {Node} node
 * @param {ToJsonOptions & {reviver?: undefined}} [options]
 * @returns {import('./json.js').JsonValue}
 */
/**
 * @overload
 * @param {Node} node
 * @param {ToJsonOptions} [options]
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
/**
 * @param {Node} node
 * @param {ToJsonOptions} options
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
export function nodeToJsonValue(
	node,
	{ignoreValues = false, type = node.getTag() ?? undefined, reviver} = {},
) {
	return nodePartsToJsonValue(
		node.getName(),
		ignoreValues ? [] : node.getArgumentEntries(),
		new Map(
			node
				.getPropertyEntries()
				.map((entry) => [/** @type {string} */ (entry.getName()), entry]),
		),
		node.children?.nodes ?? [],
		{type, reviver},
	);
}

/**
 * @overload
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'> & {reviver?: undefined}} [options]
 * @returns {import('./json.js').JsonValue}
 */
/**
 * @overload
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'>} [options]
 * @returns {unknown} A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
/**
 * @param {string} name
 * @param {Entry[]} args
 * @param {Map<string, Entry>} props
 * @param {Node[]} children
 * @param {Omit<ToJsonOptions, 'ignoreValues'>} options
 * @returns A `JsonValue` if no reviver is passed, otherwise the type is truly unknown
 */
export function nodePartsToJsonValue(
	name,
	args,
	props,
	children,
	{type, reviver} = {},
) {
	if (
		type === "object" ||
		(type !== "array" &&
			(props.size > 0 ||
				children.some((child) => child.getName() !== arrayItemKey)))
	) {
		if (args.length > 0) {
			throw new InvalidJsonInKdlError("A JSON object cannot have arguments");
		}

		/** @type {Map<string, unknown>} */
		const properties = new Map();
		for (const [name, prop] of props) {
			/** @type {unknown} */
			let property = prop.getValue();
			if (reviver != null) {
				property = reviver(property, name, {location: prop});
				if (property === undefined) {
					continue;
				}
			}
			properties.set(name, property);
		}

		if (children.length) {
			for (const child of children) {
				const name = child.getName();
				if (properties.has(name)) {
					throw new InvalidJsonInKdlError(
						`Duplicate key ${JSON.stringify(name)} in JSON object`,
					);
				}

				/** @type {unknown} */
				let property = nodeToJsonValue(child, {reviver});
				if (reviver != null) {
					property = reviver(property, name, {location: child});
					if (property === undefined) {
						continue;
					}
				}
				properties.set(name, property);
			}
		}

		return Object.fromEntries(properties);
	}

	if (type === "array" || args.length > 1 || children.length > 0) {
		if (
			props.size > 0 ||
			children.some((child) => child.getName() !== arrayItemKey)
		) {
			throw new InvalidJsonInKdlError(
				"A JSON array cannot have properties or named children",
			);
		}

		/** @type {unknown[]} */
		const values = [];
		let index = 0;

		for (const arg of args) {
			/** @type {unknown} */
			let value = arg.getValue();
			if (reviver != null) {
				value = reviver(value, index, {location: arg});
				index++;
				if (value === undefined) {
					continue;
				}
			}
			values.push(value);
		}

		for (const child of children) {
			/** @type {unknown} */
			let value = nodeToJsonValue(child, {reviver});
			if (reviver != null) {
				value = reviver(value, index, {location: child});
				index++;
				if (value === undefined) {
					continue;
				}
			}
			values.push(value);
		}

		return values;
	}

	if (args.length === 0) {
		throw new InvalidJsonInKdlError(
			`No value found in node ${JSON.stringify(name)}`,
		);
	}

	return args[0].getValue();
}
