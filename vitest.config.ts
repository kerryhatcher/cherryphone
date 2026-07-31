import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { TEST_ACCESS_AUD, TEST_ENCRYPTION_KEY } from "./test/constants.js";

export default defineConfig({
	plugins: [
		cloudflareTest(({ inject }) => ({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
					// Points at the local JWKS server started in
					// test/global-setup.ts — its port is only known at test
					// runtime, so it's threaded through via inject().
					ACCESS_TEAM_DOMAIN: `http://127.0.0.1:${inject("jwksPort")}`,
					ACCESS_AUD: TEST_ACCESS_AUD,
				},
			},
		})),
	],
	test: {
		globalSetup: ["./test/global-setup.ts"],
		setupFiles: ["./test/setup.ts"],
	},
});
