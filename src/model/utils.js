/**
 * @template T
 * @param {readonly T[]} items
 */
export function* reverseIterate(items) {
	for (let i = items.length - 1; i >= 0; i--) {
		yield items[i];
	}
}
