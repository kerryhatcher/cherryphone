// Auth is fail-closed: identity MUST come from a verified Cloudflare
// Access JWT, never from the forgeable Cf-Access-Authenticated-User-Email
// header. These tests exercise the real HTTP surface (GET /api/config,
// which requireAuth() gates) rather than calling internals directly, so
// they prove what an actual request sees.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { callWorker, mintAccessJwt, saveConfig, makeConfig } from "./helpers";

const CONFIG_URL = "https://cherryphone.example.com/api/config";

describe("auth (fail-closed)", () => {
	it("rejects a request with no Cf-Access-Jwt-Assertion header and no CF_Authorization cookie", async () => {
		const response = await callWorker(new Request(CONFIG_URL));
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ ok: false });
	});

	it("REGRESSION: rejects a forged Cf-Access-Authenticated-User-Email header with no valid JWT", async () => {
		// This is the original vulnerability: that header is a plain HTTP
		// header anyone can set. It must never be trusted on its own.
		const response = await callWorker(
			new Request(CONFIG_URL, {
				headers: { "Cf-Access-Authenticated-User-Email": "attacker@evil.example.com" },
			}),
		);
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ ok: false });
	});

	it("rejects an otherwise-plausible token when ACCESS_TEAM_DOMAIN/ACCESS_AUD are unset", async () => {
		const jwt = await mintAccessJwt("alice@example.com");
		const originalDomain = env.ACCESS_TEAM_DOMAIN;
		const originalAud = env.ACCESS_AUD;
		env.ACCESS_TEAM_DOMAIN = "";
		env.ACCESS_AUD = "";
		try {
			const response = await callWorker(
				new Request(CONFIG_URL, { headers: { "Cf-Access-Jwt-Assertion": jwt } }),
			);
			expect(response.status).toBe(401);
		} finally {
			env.ACCESS_TEAM_DOMAIN = originalDomain;
			env.ACCESS_AUD = originalAud;
		}
	});

	it("rejects a JWT with a bad signature", async () => {
		const jwt = await mintAccessJwt("alice@example.com", { badSignature: true });
		const response = await callWorker(
			new Request(CONFIG_URL, { headers: { "Cf-Access-Jwt-Assertion": jwt } }),
		);
		expect(response.status).toBe(401);
	});

	it("rejects a JWT with the wrong audience", async () => {
		const jwt = await mintAccessJwt("alice@example.com", { aud: "some-other-application" });
		const response = await callWorker(
			new Request(CONFIG_URL, { headers: { "Cf-Access-Jwt-Assertion": jwt } }),
		);
		expect(response.status).toBe(401);
	});

	it("accepts a valid JWT and uses its email claim as identity", async () => {
		const jwt = await mintAccessJwt("alice@example.com");
		const response = await callWorker(
			new Request(CONFIG_URL, { headers: { "Cf-Access-Jwt-Assertion": jwt } }),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true, data: null });
	});

	it("uses the verified JWT's identity even when a forged header claims someone else", async () => {
		const saveResponse = await saveConfig("alice@example.com", makeConfig());
		expect(saveResponse.status).toBe(200);

		const aliceJwt = await mintAccessJwt("alice@example.com");
		const response = await callWorker(
			new Request(CONFIG_URL, {
				headers: {
					"Cf-Access-Jwt-Assertion": aliceJwt,
					// Forged header claiming a different identity — must be ignored.
					"Cf-Access-Authenticated-User-Email": "bob@example.com",
				},
			}),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { ok: boolean; data: { identity: string } | null };
		expect(body.data).not.toBeNull();
		expect(body.data!.identity).not.toBe("bob@example.com");
	});
});
