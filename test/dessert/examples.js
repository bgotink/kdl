import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "uvu";

import {parse} from "../../src/dessert.js";

/** @import {DeserializationContext, DeserializerFromContext, PrimitiveType} from "../../src/dessert.js" */
/** @import {Primitive} from "../../src/index.js" */

const examplesFolder = new URL("../upstream/examples/", import.meta.url);

test("cargo", () => {
	/** @param {DeserializationContext} ctx */
	function singleStringArgument(ctx) {
		return ctx.argument.required("string");
	}

	class CargoPackage {
		/** @param {DeserializationContext} ctx */
		static deserialize(ctx) {
			const result = ctx.child.required("package", (ctx) => {
				const name = ctx.child.single.required("name", singleStringArgument);
				const version = ctx.child.single.required(
					"version",
					singleStringArgument,
				);

				const result = new CargoPackage(name, version);

				result.description = ctx.child.single(
					"description",
					singleStringArgument,
				);
				result.authors = ctx.child.single("authors", singleStringArgument);
				result.licenseFile = ctx.child.single(
					"license-file",
					singleStringArgument,
				);
				result.edition = ctx.child.single("edition", singleStringArgument);

				return result;
			});

			result.dependencies = new Map(
				ctx.child("dependencies", (ctx) =>
					ctx.children.entries.unique(singleStringArgument),
				),
			);

			return result;
		}

		/** @type {string} */
		name;
		/** @type {string} */
		version;
		/** @type {string=} */
		description;
		/** @type {string | string[] | undefined} */
		authors;
		/** @type {string=} */
		licenseFile;
		/** @type {string=} */
		edition;
		/** @type {Map<string, string>} */
		dependencies;

		/**
		 * @param {string} name
		 * @param {string} version
		 */
		constructor(name, version) {
			this.name = name;
			this.version = version;

			this.dependencies = new Map();
		}
	}

	/** @type {CargoPackage} */
	const cargoPackage = parse(
		readFileSync(new URL("Cargo.kdl", examplesFolder)),
		CargoPackage,
	);

	assert.equal(cargoPackage.name, "kdl");
	assert.equal(cargoPackage.version, "0.0.0");
	assert.equal(cargoPackage.description, "The kdl document language");
	assert.equal(cargoPackage.authors, "Kat Marchán <kzm@zkat.tech>");
	assert.equal(cargoPackage.licenseFile, "LICENSE.md");
	assert.equal(cargoPackage.edition, "2018");

	assert.deepEqual(
		cargoPackage.dependencies,
		new Map([
			["nom", "6.0.1"],
			["thiserror", "1.0.22"],
		]),
	);
});

test("kdl-schema", () => {
	/**
	 * @template {PrimitiveType} T
	 * @param {T} type
	 */
	function primitive(type) {
		return /** @param {DeserializationContext} ctx */ (ctx) =>
			ctx.argument.required(type);
	}

	class Node {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Node}
		 */
		static deserialize(ctx) {
			const name = ctx.argument("string");
			const id = ctx.property("id", "string");
			const description = ctx.property("description", "string");
			const ref = ctx.property("ref", "string");

			const propNames = ctx.children("prop-names", Validations);
			const otherPropsAllowed = ctx.child.single(
				"other-props-allowed",
				primitive("boolean"),
			);
			const min = ctx.child.single("min", primitive("number"));
			const max = ctx.child.single("max", primitive("number"));

			const values = ctx.children("value", Value);
			const props = ctx.children("prop", Prop);
			const children = ctx.children("children", Children);

			return new Node(
				name,
				id,
				description,
				ref,
				propNames,
				otherPropsAllowed,
				min,
				max,
				values,
				props,
				children,
			);
		}

		/**
		 * @param {string | undefined} name
		 * @param {string | undefined} id
		 * @param {string | undefined} description
		 * @param {string | undefined} ref
		 * @param {Validations[]} propNames
		 * @param {boolean | undefined} otherPropsAllowed
		 * @param {number | undefined} min
		 * @param {number | undefined} max
		 * @param {Value[]} values
		 * @param {Prop[]} props
		 * @param {Children[]} children
		 */
		constructor(
			name,
			id,
			description,
			ref,
			propNames,
			otherPropsAllowed,
			min,
			max,
			values,
			props,
			children,
		) {
			this.name = name;

			this.id = id;
			this.description = description;
			this.ref = ref;
			this.propNames = propNames;
			this.otherPropsAllowed = otherPropsAllowed;
			this.min = min;
			this.max = max;

			this.values = values;
			this.props = props;
			this.children = children;
		}
	}

	/**
	 * @template T
	 * @param {DeserializerFromContext<T>} deserializer
	 * @returns {DeserializerFromContext<[string | undefined, T]>}
	 */
	function withLanguage(deserializer) {
		return (ctx) => [ctx.property("lang", "string"), ctx.run(deserializer)];
	}

	class Link {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Link}
		 */
		static deserialize(ctx) {
			const link = ctx.argument.required("string");
			const rel = ctx.property("rel", "string");
			const lang = ctx.property("lang", "string");

			return new Link(link, rel, lang);
		}

		/**
		 * @param {string} link
		 * @param {string | undefined} rel
		 * @param {string | undefined} lang
		 */
		constructor(link, rel, lang) {
			this.link = link;
			this.rel = rel;
			this.lang = lang;
		}
	}

	/** @param {DeserializationContext} ctx */
	function dateTime(ctx) {
		return {
			date: ctx.argument.required("string"),
			time: ctx.property("time", "string"),
		};
	}

	class Info {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Info}
		 */
		static deserialize(ctx) {
			const title = ctx.children("title", withLanguage(primitive("string")));
			const description = ctx.children(
				"description",
				withLanguage(primitive("string")),
			);

			const authors = ctx.children("author", (ctx) => ({
				name: ctx.argument.required("string"),
				orcid: ctx.property("orcid", "string"),
				links: ctx.children("link", Link),
			}));

			const contributors = ctx.children("contributor", (ctx) => ({
				name: ctx.argument.required("string"),
				orcid: ctx.property("orcid", "string"),
				links: ctx.children("link", Link),
			}));

			const links = ctx.children("link", Link);
			const licenses = ctx.children("license", (ctx) => {
				const license = ctx.argument.required("string");
				const spdx = ctx.property("spdx", "string");
				const links = ctx.children("link", Link);

				return {license, spdx, links};
			});

			const published = ctx.child.single("published", dateTime);
			const modified = ctx.child.single("modified", dateTime);
			const version = ctx.child.single("version", primitive("string"));

			return new Info(
				title,
				description,
				authors,
				contributors,
				links,
				licenses,
				published,
				modified,
				version,
			);
		}

		/**
		 * @param {[string | undefined, string][]} title
		 * @param {[string | undefined, string][]} description
		 * @param {{name: string; orcid: string | undefined; links: Link[]}[]} authors
		 * @param {{name: string; orcid: string | undefined; links: Link[]}[]} contributors
		 * @param {Link[]} links
		 * @param {{license: string; spdx: string | undefined; links: Link[]}[]} licenses
		 * @param {{date: string; time: string | undefined} | undefined} published
		 * @param {{date: string; time: string | undefined} | undefined} modified
		 * @param {string | undefined} version
		 */
		constructor(
			title,
			description,
			authors,
			contributors,
			links,
			licenses,
			published,
			modified,
			version,
		) {
			this.title = title;
			this.description = description;
			this.authors = authors;
			this.contributors = contributors;
			this.links = links;
			this.licenses = licenses;
			this.published = published;
			this.modified = modified;
			this.version = version;
		}
	}

	class Children {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Children}
		 */
		static deserialize(ctx) {
			const info = ctx.child.single("info", Info);

			const id = ctx.property("id", "string");
			const ref = ctx.property("ref", "string");
			const description = ctx.property("description", "string");
			const children = ctx.children("node", Node);

			const nodeNames = ctx.children("node-names", Validations);
			const otherNodesAllowed = ctx.child.single(
				"other-nodes-allowed",
				primitive("boolean"),
			);
			const tagNames = ctx.children("tag-names", Validations);
			const otherTagsAllowed = ctx.child.single(
				"other-tags-allowed",
				primitive("boolean"),
			);

			return new Children(
				info,
				children,
				id,
				ref,
				description,
				nodeNames,
				otherNodesAllowed,
				tagNames,
				otherTagsAllowed,
			);
		}

		/**
		 * @param {Info | undefined} info
		 * @param {Node[]} children
		 * @param {string | undefined} id
		 * @param {string | undefined} ref
		 * @param {string | undefined} description
		 * @param {Validations[]} nodeNames
		 * @param {boolean | undefined} otherNodesAllowed
		 * @param {Validations[]} tagNames
		 * @param {boolean | undefined} otherTagsAllowed
		 */
		constructor(
			info,
			children,
			id,
			ref,
			description,
			nodeNames,
			otherNodesAllowed,
			tagNames,
			otherTagsAllowed,
		) {
			this.info = info;
			this.children = children;
			this.id = id;
			this.ref = ref;
			this.description = description;
			this.nodeNames = nodeNames;
			this.otherNodesAllowed = otherNodesAllowed;
			this.tagNames = tagNames;
			this.otherTagsAllowed = otherTagsAllowed;
		}
	}

	class Value {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Value}
		 */
		static deserialize(ctx) {
			const id = ctx.property("id", "string");
			const ref = ctx.property("ref", "string");
			const description = ctx.property("description", "string");

			const min = ctx.child.single("min", primitive("number"));
			const max = ctx.child.single("max", primitive("number"));

			const validations = Validations.deserialize(ctx);

			return new Value(id, ref, description, min, max, validations);
		}

		/**
		 * @param {string | undefined} id
		 * @param {string | undefined} ref
		 * @param {string | undefined} description
		 * @param {number | undefined} min
		 * @param {number | undefined} max
		 * @param {Validations} validations
		 */
		constructor(id, ref, description, min, max, validations) {
			this.id = id;
			this.ref = ref;
			this.description = description;
			this.min = min;
			this.max = max;
			this.validations = validations;
		}
	}

	class Prop {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Prop}
		 */
		static deserialize(ctx) {
			const key = ctx.argument("string");

			const id = ctx.property("id", "string");
			const ref = ctx.property("ref", "string");
			const description = ctx.property("description", "string");

			const required = ctx.child.single("required", primitive("boolean"));
			const validations = Validations.deserialize(ctx);

			return new Prop(key, id, ref, description, required, validations);
		}

		/**
		 * @param {string | undefined} key
		 * @param {string | undefined} id
		 * @param {string | undefined} ref
		 * @param {string | undefined} description
		 * @param {boolean | undefined} required
		 * @param {Validations} validations
		 */
		constructor(key, id, ref, description, required, validations) {
			this.key = key;
			this.id = id;
			this.ref = ref;
			this.description = description;
			this.required = required;
			this.validations = validations;
		}
	}

	class Validations {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Validations}
		 */
		static deserialize(ctx) {
			const tag = ctx.child.single("tag", Validations);
			const types = ctx.child.single("type", (ctx) => [
				ctx.argument.required("string"),
				...ctx.argument.rest("string"),
			]);
			const enumeration = ctx.child.single("enum", (ctx) => [
				ctx.argument.required(),
				...ctx.argument.rest(),
			]);
			const patterns = ctx.children("pattern", (ctx) => [
				ctx.argument.required("string"),
				...ctx.argument.rest("string"),
			]);
			const formats = ctx.child.single("format", (ctx) => [
				ctx.argument.required("string"),
				...ctx.argument.rest("string"),
			]);

			const minLength = ctx.child.single("min-length", primitive("number"));
			const maxLength = ctx.child.single("max-length", primitive("number"));

			const numberValidations = {
				"%": ctx.child.single("%", (ctx) => [
					ctx.argument.required("number"),
					...ctx.argument.rest("number"),
				]),
				">": ctx.child.single(">", primitive("number")),
				">=": ctx.child.single(">=", primitive("number")),
				"<": ctx.child.single("<", primitive("number")),
				"<=": ctx.child.single("<=", primitive("number")),
			};

			return new Validations(
				tag,
				types,
				enumeration,
				patterns,
				formats,
				minLength,
				maxLength,
				numberValidations,
			);
		}

		/**
		 * @param {Validations | undefined} tag
		 * @param {string[] | undefined} types
		 * @param {Primitive[] | undefined} enumeration
		 * @param {string[][] | undefined} patterns
		 * @param {string[] | undefined} formats
		 * @param {number | undefined} minLength
		 * @param {number | undefined} maxLength
		 * @param {{"%"?: number[]; ">"?: number; ">="?: number; "<"?: number; "<="?: number}} numberValidations
		 */
		constructor(
			tag,
			types,
			enumeration,
			patterns,
			formats,
			minLength,
			maxLength,
			numberValidations,
		) {
			this.tag = tag;
			this.types = types;
			this.enumeration = enumeration;
			this.patterns = patterns;
			this.formats = formats;
			this.minLength = minLength;
			this.maxLength = maxLength;
			this.numberValidations = numberValidations;
		}
	}

	class Document extends Children {
		/**
		 * @param {DeserializationContext} ctx
		 * @returns {Document}
		 */
		static deserialize(ctx) {
			const children = ctx.child.single.required("document", Children);

			return new Document(
				children.info,
				children.children,
				children.id,
				children.ref,
				children.description,
				children.nodeNames,
				children.otherNodesAllowed,
				children.tagNames,
				children.otherTagsAllowed,
			);
		}
	}

	const schema = parse(
		readFileSync(new URL("kdl-schema.kdl", examplesFolder)),
		Document,
	);

	assert.deepEqual(schema.info?.title, [["en", "KDL Schema"]]);

	assert.equal(schema.children[0].children[0].id, "node-children");
});

test.run();
