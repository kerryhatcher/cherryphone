// Types for the Worker environment as seen from inside tests, and for
// values threaded from global-setup.ts into test files via inject().
// Declared by hand (rather than generated with `wrangler types`) to avoid
// depending on a committed worker-configuration.d.ts; kept in sync with the
// Env interface in src/worker.ts.
//
// The `export {}` below makes this file a module rather than a global
// script — required for the `declare module`/`declare namespace` blocks to
// augment the real types instead of replacing them.
import type { JWK } from "jose";

export {};

// `declare namespace` inside a module file creates a *local* namespace
// unless wrapped in `declare global` — needed to actually augment the
// ambient `Cloudflare` namespace from workers-types.
declare global {
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			ASSETS: Fetcher;
			ENCRYPTION_KEY: string;
			ACCESS_TEAM_DOMAIN: string;
			ACCESS_AUD: string;
		}

		// Lets `exports.default.fetch(...)` (from "cloudflare:workers")
		// resolve to the real Worker's exports — see
		// test/helpers.ts's callWorker().
		interface GlobalProps {
			mainModule: typeof import("../src/worker");
		}
	}
}

declare module "vitest" {
	interface ProvidedContext {
		jwksPort: number;
		jwksKeyId: string;
		privateJwk: JWK;
		schemaSql: string;
	}
}
