/**
 * A location in the source text
 */
export interface Location {
	/**
	 * Index of this location in the source text
	 *
	 * The first character in the source text has offset 0.
	 */
	offset: number;
	/**
	 * Line number in the source text
	 *
	 * The first line has number 1.
	 */
	line: number;
	/**
	 * Column in the line
	 *
	 * The first character of the line is column number 1.
	 */
	column: number;
}

/**
 * A single token in the KDL text
 */
export interface Token {
	/**
	 * Type of the token
	 *
	 * It is guaranteed to be equal for all tokens of the same type, but there are no other guarantees as to the value.
	 * Consider this an opaque value.
	 *
	 * @hidden
	 */
	type: number;

	/**
	 * The text of this token
	 *
	 * This could be computed if you have access to the source text using
	 *
	 * ```js
	 * sourceText.slice(token.start.offset, token.end.offset)
	 * ```
	 */
	text: string;

	/**
	 * The location of the first character of this token
	 */
	start: Location;

	/**
	 * The location after the last character of this token
	 */
	end: Location;

	/**
	 * Any recoverable error that popped up while extracting this token from the source text
	 *
	 * @hidden
	 */
	errors: Error[] | null;
}
