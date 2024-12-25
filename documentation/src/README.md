{{#include ../../README.md::5}}

## Try it out

{{ VERSION }} of the `@bgotink/kdl` package is available on this website via the console of your browser:

- `kdl` exposes the [`@bgotink/kdl`](./reference/index/index.md) export
- `jik` exposes the [`@bgotink/kdl/json`](./reference/json/index.md) export

```js
console.log(kdl.parse("node arg").findNodeByName("node").getArgument(0));
```

{{#include ../../README.md:6:}}
