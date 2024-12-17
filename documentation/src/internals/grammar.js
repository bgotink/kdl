import {
	Choice,
	NonTerminal,
	Terminal,
	ZeroOrMore,
	FakeSVG,
	Optional,
	Sequence,
	OneOrMore,
	Group,
	ComplexDiagram,
	Stack,
	Skip,
	DiagramMultiContainer,
	Options,
	Path,
} from "./railroad-diagram.js";

function nonTerminal(name) {
	return new NonTerminal(name, {href: `#${name.toLowerCase()}`});
}

function terminal(name) {
	return new Terminal(name);
}

function zeroOrMore(element, rep, skip) {
	return new ZeroOrMore(element, rep, skip);
}

function oneOrMore(element, rep) {
	return new OneOrMore(element, rep);
}

function sequence(...elements) {
	return new Sequence(...elements);
}

function optional(element, skip) {
	return new Optional(element, skip);
}

/**
 * @param {string} title
 * @param {...FakeSVG} diagram
 */
function addDiagram(title, ...diagram) {
	document
		.getElementById(title.toLowerCase())
		.insertAdjacentElement("afterend", new ComplexDiagram(...diagram).toSVG());
}

addDiagram(
	"document",
	new (class extends DiagramMultiContainer {
		constructor() {
			const lineSpace = nonTerminal("line-space");
			const node = sequence(
				nonTerminal("base-node"),
				nonTerminal("node-space"),
			);
			const returnLine = nonTerminal("node-terminator");

			super("g", [lineSpace, node, returnLine]);

			this.needsSpace = true;
			this.lineSpace = lineSpace;
			this.node = node;
			this.returnLine = returnLine;

			const arc = Options.AR;

			this.up = Math.max(lineSpace.up, node.up) + arc;
			this.height = lineSpace.height + node.height;

			this.down = Math.max(node.down + 10, arc + 10 + arc) + returnLine.down;

			this.width =
				arc +
				10 +
				Math.max(
					lineSpace.width + 10 + arc + 10 + node.width + 10 + arc + 10,
					returnLine.width + 10 + arc,
				) +
				arc;
		}

		/** @override */
		format(x, y, width) {
			const arc = Options.AR;

			new Path(x, y).h(arc + 10).addTo(this);

			this.lineSpace.format(x + arc + 10, y, this.lineSpace.width).addTo(this);
			new Path(x + arc + 10 + this.lineSpace.width, y)
				.h(10)
				.arc("se")
				.up(this.up - 2 * arc)
				.arc("wn")
				.h(10 + this.node.width + 10)
				.arc("ne")
				.down(this.up - 2 * arc)
				.arc("ws")
				.addTo(this);
			new Path(x + arc + 10 + this.lineSpace.width, y)
				.h(10 + arc + 10)
				.addTo(this);

			this.node
				.format(
					x + arc + 10 + this.lineSpace.width + 10 + arc + 10,
					y,
					this.node.width,
				)
				.addTo(this);
			new Path(
				x + arc + 10 + this.lineSpace.width + 10 + arc + 10 + this.node.width,
				y,
			)
				.h(10 + 2 * arc + 10)
				.addTo(this);

			const linesDiff =
				Math.max(this.lineSpace.down, this.node.down) + 10 + this.returnLine.up;

			const itemWidth = Math.max(
				this.lineSpace.width + 10 + arc + 10 + this.node.width,
				this.returnLine.width,
			);

			new Path(
				x + arc + 10 + this.lineSpace.width + 10 + arc + 10 + this.node.width,
				y,
			)
				.h(10)
				.arc("ne")
				.down(linesDiff - 2 * arc)
				.arc("es")
				.h(-10)
				.addTo(this);

			this.returnLine
				.format(x + arc + 10, y + linesDiff, itemWidth)
				.addTo(this);

			new Path(x + arc + 10, y + linesDiff)
				.h(-10)
				.arc("sw")
				.up(linesDiff - 2 * arc)
				.arc("wn")
				.h(10)
				.addTo(this);

			return this;
		}
	})(),
);

addDiagram(
	"node-space",
	oneOrMore(
		new Choice(
			0,
			terminal("InlineWhiteSpace"),
			nonTerminal("escline"),
			nonTerminal("single-line-comment"),
		),
	),
);

addDiagram(
	"line-space",
	zeroOrMore(
		new Choice(
			0,
			terminal("InlineWhiteSpace"),
			nonTerminal("escline"),
			nonTerminal("single-line-comment"),
			terminal("NewLine"),
			nonTerminal("multiline-comment"),
		),
	),
);

addDiagram("slashdash", terminal("/-"), zeroOrMore(nonTerminal("line-space")));

addDiagram(
	"base-node",
	new (class extends DiagramMultiContainer {
		constructor() {
			const tag = new Choice(
				1,
				sequence(nonTerminal("tag"), optional(nonTerminal("node-space"))),
				new Skip(),
			);
			const name = nonTerminal("string");
			const entrySpace = nonTerminal("node-space");
			const entrySlashdash = nonTerminal("slashdash");
			const entry = nonTerminal("node-prop-or-arg");
			const intermediaryChildren = nonTerminal("node-children");
			const lastLine = sequence(
				nonTerminal("node-space"),
				optional(nonTerminal("slashdash"), "skip"),
				nonTerminal("node-children"),
			);

			super("g", [
				tag,
				name,
				entrySpace,
				entrySlashdash,
				entry,
				intermediaryChildren,
				lastLine,
			]);

			this.tag = tag;
			this.name = name;
			this.entrySpace = entrySpace;
			this.entrySlashdash = entrySlashdash;
			this.entry = entry;
			this.intermediaryChildren = intermediaryChildren;
			this.lastLine = lastLine;

			this.tag = tag;
			this.name = name;

			this.up = Math.max(tag.up, name.up);
			this.height = 0;
			this.down =
				Math.max(Math.max(tag.down, name.down) + Options.VS, 2 * Options.AR) +
				Options.AR +
				Math.max(
					Math.max(entrySpace.up, entry.up) + Options.VS,
					2 * Options.AR,
				) +
				4 * Options.AR +
				Math.max(intermediaryChildren.down + Options.VS, 2 * Options.AR) +
				Options.AR +
				Math.max(lastLine.up + Options.VS, 2 * Options.AR) +
				lastLine.height +
				lastLine.down;

			this.width = Math.max(
				tag.width + name.width + Options.AR,
				Options.AR +
					entrySpace.width +
					Options.AR +
					Options.AR +
					entrySlashdash.width +
					Options.AR +
					Options.AR +
					Math.max(entry.width, intermediaryChildren.width) +
					Options.AR,
				Options.AR + lastLine.width + Options.AR,
			);
		}

		format(x, y, width) {
			this.tag.format(x, y, this.tag.width).addTo(this);
			this.name.format(x + this.tag.width, y, this.name.width).addTo(this);

			new Path(x + this.tag.width + this.name.width, y)
				.h(this.width - this.tag.width - this.name.width)
				.addTo(this);

			const yLineAfterName =
				y + Math.max(this.tag.down, this.name.down) + Options.AR;
			const yEntry =
				yLineAfterName +
				Math.max(this.entrySpace.up, this.entry.up) +
				Options.VS +
				Options.AR;
			new Path(x + this.tag.width + this.name.width, y)
				.arc("ne")
				.v(Math.max(0, yLineAfterName - y - 2 * Options.AR))
				.arc("es")
				.h(-this.tag.width - this.name.width + Options.AR)
				.arc("nw")
				.v(Math.max(0, yEntry - yLineAfterName - 2 * Options.AR))
				.arc("ws")
				.h(Options.AR)
				.addTo(this);

			const xEntrySpace = x + Options.AR;
			const xEntrySlashdash =
				xEntrySpace + this.entrySpace.width + 2 * Options.AR;
			const yEntrySlashdash =
				yEntry + Math.max(Options.VS + this.entrySpace.up, 2 * Options.AR);
			const xEntry =
				xEntrySlashdash + this.entrySlashdash.width + 2 * Options.AR;

			this.entrySpace
				.format(xEntrySpace, yEntry, this.entrySpace.width)
				.addTo(this);
			new Path(xEntrySpace + this.entrySpace.width, yEntry)
				.h(2 * Options.AR + this.entrySlashdash.width + 2 * Options.AR)
				.addTo(this);
			this.entry.format(xEntry, yEntry, this.entry.width).addTo(this);
			new Path(xEntry + this.entry.width, yEntry)
				.arc("se")
				.v(
					-Math.max(
						0,
						Math.max(this.entry.up, this.entrySpace.up) +
							Options.VS -
							2 * Options.AR,
					),
				)
				.arc("en")
				.h(xEntrySpace - (xEntry + this.entry.width))
				.arc("nw")
				.v(
					Math.max(
						0,
						Math.max(this.entry.up, this.entrySpace.up) +
							Options.VS -
							2 * Options.AR,
					),
				)
				.arc("ws")
				.addTo(this);
			new Path(xEntry + this.entry.width, yEntry)
				.h(Options.AR)
				.arc("se")
				.v(y - yEntry + 2 * Options.AR)
				.arc("wn")
				.addTo(this);

			new Path(xEntrySpace + this.entrySpace.width, yEntry)
				.arc("ne")
				.v(Math.max(0, yEntrySlashdash - yEntry - 2 * Options.AR))
				.arc("ws")
				.addTo(this);
			this.entrySlashdash
				.format(xEntrySlashdash, yEntrySlashdash, this.entrySlashdash.width)
				.addTo(this);
			new Path(xEntrySlashdash + this.entrySlashdash.width, yEntrySlashdash)
				.arc("se")
				.v(-Math.max(0, yEntrySlashdash - yEntry - 2 * Options.AR))
				.arc("wn")
				.addTo(this);

			new Path(xEntrySlashdash + this.entrySlashdash.width, yEntrySlashdash)
				.arc("ne")
				.arc("ws")
				.addTo(this);
			new Path(xEntrySpace + this.entrySpace.width, yEntry)
				.arc("ne")
				.v(2 * Options.AR)
				.arc("ws")
				.h(this.entrySlashdash.width + 2 * Options.AR)
				.addTo(this);
			const yIntermediaryChildren = yEntrySlashdash + 2 * Options.AR;
			this.intermediaryChildren
				.format(xEntry, yIntermediaryChildren, this.intermediaryChildren.width)
				.addTo(this);
			new Path(xEntry + this.intermediaryChildren.width, yIntermediaryChildren)
				.h(
					Math.max(
						0,
						this.entry.width + Options.AR - this.intermediaryChildren.width,
					),
				)
				.arc("se")
				.v(y - yIntermediaryChildren + 2 * Options.AR)
				.arc("wn")
				.addTo(this);
			new Path(xEntry + this.intermediaryChildren.width, yIntermediaryChildren)
				.arc("ne")
				.arc("es")
				.h(xEntrySpace - (xEntry + this.intermediaryChildren.width))
				.arc("nw")
				.v(Options.AR)
				.arc("ws")
				.addTo(this);

			const yLastLine = yIntermediaryChildren + 5 * Options.AR;
			this.lastLine
				.format(xEntrySpace, yLastLine, this.lastLine.width)
				.addTo(this);
			new Path(xEntrySpace + this.lastLine.width, yLastLine)
				.arc("se")
				.arc("en")
				.h(-this.lastLine.width)
				.arc("nw")
				.arc("ws")
				.addTo(this);
			new Path(xEntrySpace + this.lastLine.width, yLastLine)
				.h(
					Math.max(
						0,
						xEntry +
							this.entry.width +
							Options.AR -
							(xEntrySpace + this.lastLine.width),
					),
				)
				.arc("se")
				.v(y - yLastLine + 2 * Options.AR)
				.arc("wn")
				.addTo(this);

			return this;
		}
	})(),
	// new Choice(1, sequence(nonTerminal("tag"), optional(nonTerminal("node-space"))), new Skip()),
	// new Stack(
	// 	nonTerminal("string"),
	// 	// dit gaat custom moeten...
	// 	sequence(
	// 		zeroOrMore(
	// 			new Group(nonTerminal("node-prop-or-arg"), "requires plain-node-space"),
	// 		),
	// 		optional(
	// 			new Group(nonTerminal("node-children"), "requires plain-node-space"),
	// 		),
	// 	),
	// ),
);

addDiagram(
	"node",
	nonTerminal("base-node"),
	optional(nonTerminal("node-space")),
	nonTerminal("node-terminator"),
);

addDiagram(
	"node-prop-or-arg",
	new Choice(
		0,
		sequence(
			nonTerminal("string"),
			optional(nonTerminal("node-space")),
			optional(
				sequence(
					terminal("equals"),
					optional(nonTerminal("node-space")),
					nonTerminal("value"),
					optional(nonTerminal("node-space")),
				),
			),
		),
		sequence(
			nonTerminal("tag"),
			optional(nonTerminal("node-space")),
			nonTerminal("value"),
			optional(nonTerminal("node-space")),
		),
		sequence(nonTerminal("keyword"), optional(nonTerminal("node-space"))),
		sequence(nonTerminal("number"), optional(nonTerminal("node-space"))),
	),
);

addDiagram(
	"node-children",
	terminal("{"),
	nonTerminal("document"),
	terminal("}"),
);

addDiagram(
	"node-terminator",
	new Choice(
		0,
		terminal("NewLine"),
		terminal(";"),
		nonTerminal("single-line-comment"),
	),
);

addDiagram(
	"tag",
	terminal("("),
	optional(nonTerminal("node-space")),
	nonTerminal("string"),
	optional(nonTerminal("node-space")),
	terminal(")"),
);

addDiagram(
	"escline",
	terminal("\\"),
	zeroOrMore(
		new Choice(
			0,
			terminal("InlineWhiteSpace"),
			nonTerminal("multiline-comment"),
		),
	),
	new Choice(0, terminal("Newline"), nonTerminal("single-line-comment")),
);

addDiagram(
	"multiline-comment",
	terminal("/*"),
	zeroOrMore(
		new Choice(
			0,
			terminal("MultilineCommentContent"),
			nonTerminal("multiline-comment"),
		),
	),
	terminal("*/"),
);

addDiagram(
	"single-line-comment",
	terminal("//"),
	terminal("SingleLineContent"),
	new Choice(0, terminal("Newline"), terminal("EOF")),
);

addDiagram(
	"value",
	new Choice(
		0,
		nonTerminal("string"),
		nonTerminal("number"),
		nonTerminal("keyword"),
	),
);

addDiagram(
	"keyword",
	new Choice(
		0,
		terminal("#true"),
		terminal("#false"),
		terminal("#null"),
		terminal("#-?inf"),
		terminal("#nan"),
	),
);

addDiagram(
	"number",
	optional(terminal("[+-]"), "skip"),
	new Choice(
		1,
		terminal("BinaryNumber"),
		terminal("DecimalNumber"),
		terminal("OctalNumber"),
		terminal("HexadecimalNumber"),
	),
);

addDiagram(
	"string",
	new Choice(
		1,
		terminal("PlainIdentifier"),
		terminal("QuotedString"),
		terminal("RawString"),
	),
);
