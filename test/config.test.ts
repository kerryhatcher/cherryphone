// /api/config CRUD: scoping by identity (derived from the verified JWT,
// never the request body) and never leaking secrets in plaintext.
import { describe, expect, it } from "vitest";
import { callWorker, makeConfig, mintAccessJwt, saveConfig } from "./helpers";

const CONFIG_URL = "https://cherryphone.example.com/api/config";

async function getConfig(email: string): Promise<{ status: number; body: any }> {
	const jwt = await mintAccessJwt(email);
	const response = await callWorker(
		new Request(CONFIG_URL, { headers: { "Cf-Access-Jwt-Assertion": jwt } }),
	);
	return { status: response.status, body: await response.json() };
}

async function deleteConfig(email: string): Promise<Response> {
	const jwt = await mintAccessJwt(email);
	return callWorker(
		new Request(CONFIG_URL, { method: "DELETE", headers: { "Cf-Access-Jwt-Assertion": jwt } }),
	);
}

describe("GET /api/config", () => {
	it("returns null when nothing has been saved", async () => {
		const { status, body } = await getConfig("nobody@example.com");
		expect(status).toBe(200);
		expect(body).toMatchObject({ ok: true, data: null });
	});

	it("never returns the API Key Secret or Auth Token in plaintext", async () => {
		const config = makeConfig({
			apiKeySecret: "super-secret-signing-key",
			authToken: "super-secret-auth-token",
		});
		await saveConfig("alice@example.com", config);

		const { status, body } = await getConfig("alice@example.com");
		expect(status).toBe(200);
		const raw = JSON.stringify(body);
		expect(raw).not.toContain(config.apiKeySecret);
		expect(raw).not.toContain(config.authToken);
		// The response should still indicate whether secrets are present,
		// just not their values.
		expect(body.data.hasApiKeySecret).toBe(true);
		expect(body.data.hasAuthToken).toBe(true);
	});
});

describe("config scoping between users", () => {
	it("user A cannot read user B's config", async () => {
		const configA = makeConfig({ identity: "user_a", twilioNumber: "+15550001111" });
		const configB = makeConfig({ identity: "user_b", twilioNumber: "+15552223333" });
		await saveConfig("alice@example.com", configA);
		await saveConfig("bob@example.com", configB);

		const { body: bodyA } = await getConfig("alice@example.com");
		const { body: bodyB } = await getConfig("bob@example.com");

		expect(bodyA.data.twilioNumber).toBe(configA.twilioNumber);
		expect(bodyB.data.twilioNumber).toBe(configB.twilioNumber);
		expect(bodyA.data.twilioNumber).not.toBe(bodyB.data.twilioNumber);
	});

	it("user A saving a config does not overwrite user B's row", async () => {
		const configA = makeConfig({ identity: "user_a", twilioNumber: "+15550001111" });
		const configB = makeConfig({ identity: "user_b", twilioNumber: "+15552223333" });
		await saveConfig("alice@example.com", configA);
		await saveConfig("bob@example.com", configB);

		// Alice saves again with different values.
		await saveConfig("alice@example.com", makeConfig({ twilioNumber: "+15559990000" }));

		const { body: bodyB } = await getConfig("bob@example.com");
		expect(bodyB.data.twilioNumber).toBe(configB.twilioNumber);
	});

	it("DELETE /api/config removes only the caller's row", async () => {
		await saveConfig("alice@example.com", makeConfig({ identity: "user_a" }));
		await saveConfig("bob@example.com", makeConfig({ identity: "user_b" }));

		const deleteResponse = await deleteConfig("alice@example.com");
		expect(deleteResponse.status).toBe(200);

		const { body: bodyA } = await getConfig("alice@example.com");
		expect(bodyA.data).toBeNull();

		const { body: bodyB } = await getConfig("bob@example.com");
		expect(bodyB.data).not.toBeNull();
	});
});
