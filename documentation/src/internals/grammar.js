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
			const node = new Sequence(
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

	// nonTerminal("line-space"),
	// new ZeroOrMore(
	// 	,
	// 	new Sequence(nonTerminal("line-space"), ),
	// ),
);

addDiagram(
	"plain-node-space",
	new OneOrMore(
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
	new ZeroOrMore(
		new Choice(
			0,
			terminal("InlineWhiteSpace"),
			terminal("NewLine"),
			nonTerminal("multiline-comment"),
			nonTerminal("single-line-comment"),
			new Sequence(
				terminal("/-"),
				new Optional(nonTerminal("plain-node-space")),
				nonTerminal("node"),
			),
		),
	),
);

addDiagram(
	"node-space",
	new ZeroOrMore(
		new Sequence(
			nonTerminal("plain-node-space"),
			new Optional(
				new Sequence(
					terminal("/-"),
					new Optional(nonTerminal("plain-node-space")),
					new Choice(
						0,
						nonTerminal("node-prop-or-arg"),
						nonTerminal("node-children"),
					),
				),
			),
		),
	),
);

addDiagram(
	"base-node",
	new Choice(1, nonTerminal("tag"), new Skip()),
	new Stack(
		new Sequence(
			nonTerminal("node-space"),
			nonTerminal("string"),
			nonTerminal("node-space"),
		),
		new Sequence(
			new ZeroOrMore(
				new Group(nonTerminal("node-prop-or-arg"), "requires plain-node-space"),
			),
			new Optional(
				new Group(nonTerminal("node-children"), "requires plain-node-space"),
			),
		),
	),
);

addDiagram(
	"node",
	nonTerminal("base-node"),
	nonTerminal("node-space"),
	nonTerminal("node-terminator"),
);

addDiagram(
	"node-prop-or-arg",
	new Choice(
		0,
		new Sequence(
			nonTerminal("string"),
			nonTerminal("node-space"),
			new Optional(
				new Sequence(
					terminal("equals"),
					nonTerminal("node-space"),
					nonTerminal("value"),
					nonTerminal("node-space"),
				),
			),
		),
		new Sequence(
			nonTerminal("tag"),
			nonTerminal("node-space"),
			nonTerminal("value"),
			nonTerminal("node-space"),
		),
		new Sequence(nonTerminal("keyword"), nonTerminal("node-space")),
		new Sequence(nonTerminal("number"), nonTerminal("node-space")),
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
	nonTerminal("node-space"),
	nonTerminal("string"),
	nonTerminal("node-space"),
	terminal(")"),
);

addDiagram(
	"escline",
	terminal("\\"),
	new ZeroOrMore(
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
	new ZeroOrMore(
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
	new Optional(terminal("[+-]"), "skip"),
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
