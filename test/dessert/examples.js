import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "uvu";

import {deserialize} from "../../src/dessert.js";
import {parse} from "../../src/index.js";

/** @import {DeserializeContext} from "../../src/dessert.js" */

const examplesFolder = new URL("../upstream/examples/", import.meta.url);

test("cargo", () => {
	/** @param {DeserializeContext} ctx */
	function singleStringArgument(ctx) {
		return ctx.argument.required("string");
	}

	class CargoPackage {
		/** @param {DeserializeContext} ctx */
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

	const document = parse(readFileSync(new URL("Cargo.kdl", examplesFolder)));

	/** @type {CargoPackage} */
	const cargoPackage = deserialize(document, CargoPackage);

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

test.run();
