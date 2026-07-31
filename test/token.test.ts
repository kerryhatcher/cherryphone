// Twilio Access Token structure — see generateToken() in src/worker.ts.
// A Twilio Access Token is a "Flex/FPA" JWT: signed with the API Key
// Secret (never the Auth Token), iss = API Key SID, sub = Account SID, and
// a required `cty: "twilio-fpa;v=1"` header.
import { decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { callWorker, makeConfig, mintAccessJwt, saveConfig } from "./helpers";

const TOKEN_URL = "https://cherryphone.example.com/api/token";

async function fetchToken(email: string): Promise<string> {
	const jwt = await mintAccessJwt(email);
	const response = await callWorker(
		new Request(TOKEN_URL, {
			method: "POST",
			headers: { "Cf-Access-Jwt-Assertion": jwt },
		}),
	);
	expect(response.status).toBe(200);
	const body = (await response.json()) as { ok: boolean; data: { token: string } };
	expect(body.ok).toBe(true);
	return body.data.token;
}

describe("Twilio Access Token structure", () => {
	it("has the required header and payload shape", async () => {
		const config = makeConfig();
		const saveResponse = await saveConfig("alice@example.com", config);
		expect(saveResponse.status).toBe(200);

		const token = await fetchToken("alice@example.com");

		const header = decodeProtectedHeader(token);
		expect(header.alg).toBe("HS256");
		expect(header.typ).toBe("JWT");
		expect(header.cty).toBe("twilio-fpa;v=1");

		const payload = decodeJwt(token) as {
			iss: string;
			sub: string;
			nbf: number;
			exp: number;
			grants: { identity: string; voice: { outgoing: { application_sid: unknown } } };
		};
		expect(payload.iss).toBe(config.apiKeySid);
		expect(payload.sub).toBe(config.accountSid);
		expect(payload.grants.voice.outgoing.application_sid).toBe(config.twimlAppSid);
		expect(typeof payload.grants.voice.outgoing.application_sid).toBe("string");
		expect(payload.grants.identity).toBeTruthy();
		expect(payload.exp).toBeGreaterThan(payload.nbf);
	});

	it("verifies against the API Key Secret but NOT the Auth Token", async () => {
		const config = makeConfig({
			apiKeySecret: "correct-signing-secret",
			authToken: "unrelated-auth-token",
		});
		await saveConfig("bob@example.com", config);
		const token = await fetchToken("bob@example.com");

		await expect(
			jwtVerify(token, new TextEncoder().encode(config.apiKeySecret), {
				algorithms: ["HS256"],
			}),
		).resolves.toBeDefined();

		await expect(
			jwtVerify(token, new TextEncoder().encode(config.authToken), {
				algorithms: ["HS256"],
			}),
		).rejects.toThrow();
	});
});
