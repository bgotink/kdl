# `@bgotink/kdl`

This package contains a parser and stringifier for the [KDL Document Language][kdl-site], a node-based, human-friendly configuration and serialization format.

The parser in this package focuses on parsing documents in a way that allows for format-preserving modifications. This is most useful when working with KDL files maintained by humans.

If you don't care about formatting or programmatic manipulation, you might want to check out the official parser [`kdljs`][kdljs] instead.

## Install

```sh
yarn add @bgotink/kdl
```

## Usage

```js
import {parse, format} from '@bgotink/kdl';

const doc = parse(String.raw`
	node "value" r#"other value"# 2.0 4 false \
			null -0 {
		child; "child too"
	}
`);

doc.nodes[0].children.nodes[0].entries.push(
	parse(
		String.raw`/-lorem="ipsum" \
			dolor=true`,
		{as: 'entry'},
	),
);

expect(format(doc)).toBe(String.raw`
	node "value" r#"other value"# 2.0 4 false \
			null -0 {
		child /-lorem="ipsum" \
			dolor=true; "child too"
	}
`);
```

## License & Notice

This package is licensed under the MIT license, which can be found in `LICENSE.md`.

The test suite at `test/upstream` is part of the [KDL specification][kdl-spec-repo] and is available under the Creative Commons Attribution-ShareAlike 4.0 International License.

This package wouldn't be possible without software that other people graciously made open source:

The code in this package is heavily influenced by the [`kdl` crate][kdl-rs], available under the Apache 2.0 license.  
Some token expressions have been copied out of the official [`kdljs`][kdljs] parser, available under the MIT license.

This package bundles it dependencies when published to npm, which includes:

- [Chevrotain](https://chevrotain.io/), available under the Apache 2.0 license  
  Copyright (c) 2021 the original author or authors from the Chevrotain project  
  Copyright (c) 2015-2020 SAP SE or an SAP affiliate company.
- [lodash](https://lodash.com/), available under the MIT license
- [`regexp-to-ast`](https://npm.im/regexp-to-ast), available under the MIT license

[kdl-site]: https://kdl.dev/
[kdl-spec-repo]: https://github.com/kdl-org/kdl
[kdl-rs]: https://github.com/kdl-org/kdl-rs
[kdljs]: https://github.com/kdl-org/kdljs
