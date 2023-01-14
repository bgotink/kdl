import bench from 'benchmark';
import * as kdljs from 'kdljs';
import {stderr} from 'node:process';

import * as dev from '../src/index.js';

let built;
try {
	built = await import('../out/index.cjs');
} catch {
	stderr.write(
		'No out folder found, run `yarn build` to include the built version of @bgotink/kdl\n',
	);
	built = null;
}

const suite = new bench.Suite();

const document = String.raw`
node \
{
	child; "child"; r###"child"###;
}

deeply { nested { node { but { like { really { deeply { nested { or { whatever; }; }; }; }; }; }; }; }; }

node \
  with="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
  r#"no really,"#="a lot" \
	"of" "arguments" 4.20;
`;

// sanity check: assert document parses
kdljs.parse(document);
dev.parse(document);
built?.parse(document);

suite.add('kdljs #parse', () => {
	kdljs.parse(document);
});

suite.add('development #parse', () => {
	dev.parse(document);
});

if (built) {
	const _built = built;
	suite.add('built #parse', () => {
		_built.parse(document);
	});
}

// add listeners
suite
	.on(
		'cycle',
		/** @param {bench.Event} event */ function (event) {
			console.log(String(event.target));
		},
	)
	.on(
		'complete',
		/** @this {bench.Suite} */ function () {
			console.log('Fastest is ' + this.filter('fastest').map('name'));
		},
	)
	.run();
