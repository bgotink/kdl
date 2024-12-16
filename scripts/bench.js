import bench from "benchmark";
import * as kdljs from "kdljs";

import * as self from "../src/index.js";

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
self.parse(document);

suite.add("kdljs #parse", () => {
	kdljs.parse(documentV1);
});

suite.add("development #parse", () => {
	self.parse(document);
});

suite.add("development #parse {graphemeLocations: true}", () => {
	self.parse(document, {graphemeLocations: true});
});

suite.add("development #parse {storeLocations: true}", () => {
	self.parse(document, {storeLocations: true});
});

try {
	const out = await import("../out/index.js");
	suite.add("built #parse", () => {
		out.parse(document);
	});
} catch {
	// ignore
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
