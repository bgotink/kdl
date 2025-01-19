/** @import { Document } from "../document.js"; */
/** @import { Node } from "../node.js"; */

/** @import { Filter } from "./filter.js"; */

/**
 * @typedef {'+' | '++' | '>' | '>>'} SelectorOperator
 */

export class Selector {
	/**
	 * @param {[[SelectorOperator, Filter], ...[SelectorOperator, Filter][]]} filters
	 */
	constructor(filters) {
		this.filters = [...filters].reverse();
	}
}

/**
 * @param {Selector} selector
 * @param {Node} node
 * @param {ReadonlyMap<Node, Node | Document>} nodeToParentMap
 * @param {Document} root
 * @returns {boolean}
 */
function matchesSelector(selector, node, nodeToParentMap, root) {
	/** @type {Set<Node | Document>} */
	let current = new Set([node]);

	for (const [operator, filter] of selector.filters) {
		const filtered = /** @type {Node[]} */ (
			Array.from(current).filter((n) => n.type === "node" && filter.matches(n))
		);

		if (!filtered.length) {
			return false;
		}

		switch (operator) {
			case ">":
				current = new Set(
					filtered.map(
						(n) => /** @type {Node | Document} */ (nodeToParentMap.get(n)),
					),
				);
				break;
			case ">>": {
				current = new Set();
				for (const node of filtered) {
					/** @type {Node | Document} */
					let parent = node;
					do {
						parent = /** @type {Node | Document} */ (
							nodeToParentMap.get(parent)
						);
						if (current.has(parent)) {
							// already processed
							break;
						}
						current.add(parent);
					} while (parent.type === "node");
				}
				break;
			}
			case "+":
				current = new Set();
				for (const node of filtered) {
					const parent = /** @type {Node | Document} */ (
						nodeToParentMap.get(node)
					);
					const document =
						parent.type === "document" ?
							parent
						:	/** @type {Document} */ (parent.children);

					const index = document.nodes.indexOf(node);
					if (index !== 0) {
						current.add(document.nodes[index - 1]);
					}
				}
				break;
			case "++": {
				current = new Set();
				for (const node of filtered) {
					const parent = /** @type {Node | Document} */ (
						nodeToParentMap.get(node)
					);
					const document =
						parent.type === "document" ?
							parent
						:	/** @type {Document} */ (parent.children);

					for (
						let index = document.nodes.indexOf(node) - 1;
						index >= 0;
						index--
					) {
						if (current.has(document.nodes[index])) {
							break;
						}

						current.add(document.nodes[index]);
					}
				}
				break;
			}
		}
	}

	return current.has(root);
}

export class Query {
	/**
	 * @param {Selector[]} selectors
	 */
	constructor(selectors) {
		/**
		 * Selectors in this query
		 *
		 * @type {Selector[]}
		 */
		this.selectors = selectors;
	}

	/**
	 * @param {Document} document
	 * @returns {Generator<Node, void, void>}
	 */
	*find(document) {
		/*
		 * This method and matchSelector work together to walk the document and look for nodes
		 * that match. The nodes are walked in a specific order: depth-first and in order.
		 *
		 * With the document
		 *   a { b { c; d } e; f }
		 * the nodes are walked in alphabetical order.
		 *
		 * The Selector evaluation happens much like CSS selector matching in the browser: from right to left.
		 * There are multiple benefits to this approach:
		 *
		 * - We only have to walk the entire document once to look for nodes that match the right-most filter.
		 *   Validating the rest of the query is relatively simple assuming we have a link between nodes and their parents.
		 * - We can choose the order in which we loop over the document to find matches, meaning we can yield
		 *   results in a consistent and predictable order. This would be a lot harder to implement if we evaluated
		 *   selectors from left to right.
		 */

		/**
		 * A collection that contains a link for all visited nodes to their parent node,
		 * or `document` in case of root nodes.
		 *
		 * The only selector operators are `parent > child` or `node + sibling` (or `>>` or `++`)
		 * which means that if we walk the document in order & depth-first, we only ever need to
		 * look at nodes we've already visited in order to validate the entire query for any node
		 * we visit.
		 *
		 * @type {Map<Node, Node | Document>}
		 */
		const nodesToParents = new Map();

		for (const [node, parent] of collectNodes(document)) {
			nodesToParents.set(node, parent);

			for (const selector of this.selectors) {
				if (matchesSelector(selector, node, nodesToParents, document)) {
					yield node;
					break;
				}
			}
		}
	}
}

/**
 * @param {Document | Node} parent
 * @returns {Generator<[node: Node, parent: Node | Document], void, void>}
 */
function* collectNodes(parent) {
	const document = parent.type === "node" ? parent.children : parent;
	if (!document) {
		return;
	}

	for (const node of document.nodes) {
		yield [node, parent];
		yield* collectNodes(node);
	}
}
