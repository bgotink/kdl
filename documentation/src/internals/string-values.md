# String Value Processing

Turning string values as written in a KDL document into correct JavaScript values requires quite a bit of processing.
Which steps are necessary differs for raw strings vs regular strings and for multiline strings vs single line strings:

1. Remove all escaped whitespace
1. Validate the string:
   - Multiline strings must start on a newline and end on a blank line
   - Single line strings must only contain a single line
1. For multiline strings: remove prefix and normalize newlines
1. For non-raw strings: replace escapes

The first implementation of these steps ran them as described above.
This means the code ran through every string multiple times, once for every step.

The current implementation is more optimized, it runs in two steps:

1. Validation:
   - Multiline strings: does the string start with a newline and does it end on an non-escaped newline followed by (escaped) whitespace?
   - Single line strings: does the string contain any non-escaped newlines?
1. Replace all escapes and normalize newlines if needed in a single [`String.prototype.replace`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace) pass using different very large and complex regular expressions depending on the exact type of string.

This new implementation has one big benefit, apart from being a lot faster.
All modifications to the value are done in a single pass, so we can easily keep track of where in the original string everything was.
This allows us to mark individual characters that are invalid in a string, rather than having to mark the entire string as invalid.
