// Runs before/after every test (all test files share this setupFile).
// Keeps D1 state isolated per test: fresh schema before each test, full
// wipe after — so nothing a test writes can leak into the next one.
import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, beforeEach, inject } from "vitest";

async function applySchema(): Promise<void> {
	// schema.sql's contents, read from disk in test/global-setup.ts (which
	// runs in real Node.js — workerd test files have no filesystem access)
	// and threaded through via inject(). Strip `-- ...` line comments before
	// splitting on `;` — schema.sql has at least one comment containing a
	// literal semicolon, which would otherwise split a statement in two.
	const withoutComments = inject("schemaSql")
		.split("\n")
		.map((line) => line.replace(/--.*$/, ""))
		.join("\n");

	const statements = withoutComments
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);

	await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
}

beforeEach(async () => {
	await applySchema();
});

afterEach(async () => {
	// Deletes all data from all attached bindings (D1 included), so the
	// next test's beforeEach starts from a genuinely empty database.
	await reset();
});
