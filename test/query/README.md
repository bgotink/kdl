# KDL Query Tests

The `test_cases` folder contains KDL files with the following structure:

- A single node called `source`. The test uses the children of this node as document to query.
- One or more `query` nodes.
  These have a single argument, a valid KDL Query.
  The node's children contain all children in the source document that match the query.
