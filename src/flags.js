/**
 * @typedef {object} ParserFlags
 * Flags to turn language features on or off
 *
 * @prop {boolean} experimentalNodePipes
 * Support node pipes using a proposal that is not part of the language
 *
 * If enabled, `A #> B` is equivalent to `B { A }`, i.e. the node on the left
 * becomes the sole child of the node on the right. Chains are left-associative:
 * `A #> B #> C` is equivalent to `C { B { A } }`.
 *
 * If combined with `experimentalSuffixedNumbers`, a `#>` directly following a
 * number is parsed as a number suffix.
 *
 * @prop {boolean} experimentalSuffixedNumbers
 * Support suffixed numbers using a proposal that might not make it into the language
 *
 * If enabled, decimal numbers and can have a suffix.
 * This suffix is used as tag for the value, which implies a number cannot have both a tag and a suffix.
 *
 * The following limitations apply:
 * - Binary, octal, and hexadecimal numbers cannot have a suffix, only decimal numbers
 * - Decimal numbers cannot have both an exponent and a suffix, e.g. `1e1lorem` is invalid
 * - A suffix cannot start with a letter followed by a digit or an underscore (`_`)
 * - A suffix cannot start with `x` or `X` followed by the letter a through f or A through F
 * - A suffix cannot start on a dot (`.`) or comma (`,`)
 *
 * A suffix can start with a `#` character, in which case none of the limitations above apply.
 * The `#` itself is a separator character, and not part of the suffix itself.
 */

/**
 * @param {Partial<Readonly<ParserFlags>>} [flags]
 * @returns {ParserFlags}
 */
export function resolveFlags({
	experimentalNodePipes = false,
	experimentalSuffixedNumbers = false,
} = {}) {
	return {experimentalNodePipes, experimentalSuffixedNumbers};
}
