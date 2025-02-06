import bench from "benchmark";
import * as v1 from "@bgotink/kdl-v1";

import * as self from "../src/index.js";
import * as compat from "../src/v1-compat.js";

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
self.parse(document);

suite.add("v1 #parse", () => {
	v1.parse(documentV1);
});

suite.add("v1 compat #parseAndTransform", () => {
	compat.parseAndTransform(documentV1);
});

suite.add("v1 compat #parseWithoutFormatting", () => {
	compat.parseWithoutFormatting(documentV1);
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
