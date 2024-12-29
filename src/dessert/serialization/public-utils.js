import {Document} from "../../model.js";
/** @import { Node } from "../../model.js" */

/**
 * Create a document containing the given nodes in order
 *
 * If documents are passed, all nodes from those documents will be inserted in order into the returned document.
 *
 * @param  {...(Document | Node)} docsAndNodes
 * @returns {Document}
 */
export function concat(...docsAndNodes) {
	const doc = new Document();

	let space = "";
	for (const docOrNode of docsAndNodes) {
		if (docOrNode.type === "document") {
			const nodes = docOrNode.nodes;
			const firstNode = nodes[0];

			if (space && firstNode) {
				firstNode.leading = space + (firstNode.leading ?? "");
				space = "";
			}

			doc.nodes.push(...nodes);
			space += docOrNode.trailing;
		} else {
			if (space) {
				docOrNode.leading = space + (docOrNode.leading ?? "");
				space = "";
			}

			doc.nodes.push(docOrNode);
		}
	}

	return doc;
}
