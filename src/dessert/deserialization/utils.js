/** @param {string[]} strings */
export function joinWithAnd(strings) {
	if (strings.length === 1) {
		return strings[0];
	}
	if (strings.length === 2) {
		return `${strings[0]} and ${strings[1]}`;
	}

	return strings.map(_insertAndInLastItem).join(", ");
}
/**
 * @param {string} t
 * @param {number} i
 * @param {string[]} a
 */
function _insertAndInLastItem(t, i, {length}) {
	return i === length - 1 ? `and ${t}` : t;
}

/** @param {readonly string[]} strings */
export function joinWithOr(strings) {
	if (strings.length === 1) {
		return strings[0];
	}
	if (strings.length === 2) {
		return `${strings[0]} or ${strings[1]}`;
	}

	return strings.map(_insertOrInLastItem).join(", ");
}
/**
 * @param {string} t
 * @param {number} i
 * @param {readonly string[]} a
 */
function _insertOrInLastItem(t, i, {length}) {
	return i === length - 1 ? `or ${t}` : t;
}
