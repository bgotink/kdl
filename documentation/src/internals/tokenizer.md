# Tokenizer Optimization

The parser's tokenizer has gone through a few iterations improving the performance and error handling.

## Overview

The tokenizer runs through every codepoint in the source text and compares the codepoint value.
If the `graphemeLocations` option is set to `true`, then the tokenizer iterates over graphemes instead, with the tokenizer exclusively looking at the first codepoint in each grapheme.

The tokenizer is a generator function yielding every individual token, rather than returning an array of tokens.
This decision gives a few benefits in error reporting:

- In case there is a fatal error in the parser the tokenizer won't tokenize the entire document, it'll stop at the point of the error.
- If there is a fatal error in the tokenizer, any non-fatal errors in the parser up to that fatal error can still be reported.

## Lookup Table

The tokenizer uses a lookup table the first codepoint in every token.
This is noticeably faster than doing a series of comparisons.

All special characters are ASCII characters, i.e. with a codepoint below `0xFF`.
Codepoints outside of the ASCII range are either whitespace, identifier characters, or invalid.
It just so happens that arrays are highly optimized for lengths up to 256, which
happens to mean we can put `0x00` - `0xFF` in a lookup table.
The tokenizer contains a lookup table for every initial ASCII character in a token, and if a token's first character is not ASCII then a simple "is this whitespace?" check is used to distinguish whitespace tokens from identifier tokens.
