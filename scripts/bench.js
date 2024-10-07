import bench from "benchmark";
import * as kdljs from "kdljs";
import {stderr} from "node:process";

import * as dev from "../src/index.js";

let built;
try {
	built = await import("../out/index.js");
} catch {
	stderr.write(
		"No out folder found, run `yarn build` to include the built version of @bgotink/kdl\n",
	);
	built = null;
}

const suite = new bench.Suite();

const document = String.raw`
node \
{
	child; "child"; ###"child"###;
}

deeply { nested { node { but { like { really { deeply { nested { or { whatever; }; }; }; }; }; }; }; }; }

node \
  with="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
  #"no really,"#="a lot" \
	"of" "children" 4.20;
`;

const documentV1 = document.replace(/(\s)(#+")/g, "$1r$2");

// sanity check: assert document parses
if (kdljs.parse(documentV1).errors?.length)
	throw new Error("kdljs failed to parse");
dev.parse(document);
built?.parse(document);

suite.add("kdljs #parse", () => {
	kdljs.parse(documentV1);
});

suite.add("development #parse", () => {
	dev.parse(document);
});

suite.add("development #parse {graphemeLocations: true}", () => {
	dev.parse(document, {graphemeLocations: true});
});

suite.add("development #parse {storeLocations: true}", () => {
	dev.parse(document, {storeLocations: true});
});

if (built) {
	const _built = built;
	suite.add("built #parse", () => {
		_built.parse(document);
	});
}

// add listeners
suite
	.on(
		"cycle",
		/** @param {bench.Event} event */ function (event) {
			console.log(String(event.target));
		},
	)
	.on(
		"complete",
		/** @this {bench.Suite} */ function () {
			console.log("Fastest is " + this.filter("fastest").map("name"));
		},
	)
	.run();
