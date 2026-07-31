// The /voice TwiML webhook — Twilio's servers POST here with no Cloudflare
// Access JWT, so it authenticates the caller itself via X-Twilio-Signature
// (see handleVoiceWebhook in src/worker.ts).
import { describe, expect, it } from "vitest";
import { callWorker, computeTwilioSignature, makeConfig, saveConfig } from "./helpers";

const VOICE_URL = "https://cherryphone.example.com/voice";

async function postVoice(params: Record<string, string>, signature?: string): Promise<Response> {
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};
	if (signature !== undefined) headers["X-Twilio-Signature"] = signature;

	return callWorker(
		new Request(VOICE_URL, {
			method: "POST",
			headers,
			body: new URLSearchParams(params).toString(),
		}),
	);
}

describe("POST /voice", () => {
	it("rejects a request with no X-Twilio-Signature header", async () => {
		const response = await postVoice({ From: "client:someone", To: "+15551234567" });
		expect(response.status).toBe(403);
	});

	it("rejects an invalid signature", async () => {
		const config = makeConfig();
		await saveConfig("alice@example.com", config);
		const params = { From: `client:${config.identity}`, To: "+15551234567" };

		const response = await postVoice(params, "not-the-real-signature");
		expect(response.status).toBe(403);
	});

	it("rejects an unknown identity in From", async () => {
		const params = { From: "client:nobody_registered", To: "+15551234567" };
		const signature = await computeTwilioSignature(VOICE_URL, params, "irrelevant-auth-token");
		const response = await postVoice(params, signature);
		expect(response.status).toBe(403);
	});

	it("rejects when AccountSid does not match the stored config", async () => {
		const config = makeConfig();
		await saveConfig("alice@example.com", config);
		const params = {
			From: `client:${config.identity}`,
			To: "+15551234567",
			AccountSid: "ACwrongaccountsid00000000000",
		};
		// Compute a signature that would otherwise be valid for these exact
		// params — the mismatch itself must be what causes the 403.
		const signature = await computeTwilioSignature(VOICE_URL, params, config.authToken);
		const response = await postVoice(params, signature);
		expect(response.status).toBe(403);
	});

	it("returns TwiML with a Dial to the caller on a valid signature", async () => {
		const config = makeConfig({ twilioNumber: "+15559998888" });
		await saveConfig("alice@example.com", config);
		const params = {
			From: `client:${config.identity}`,
			To: "+15551234567",
			AccountSid: config.accountSid,
		};
		const signature = await computeTwilioSignature(VOICE_URL, params, config.authToken);

		const response = await postVoice(params, signature);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/xml");
		const body = await response.text();
		expect(body).toContain(`<Dial callerId="${config.twilioNumber}">`);
		expect(body).toContain(params.To);
	});

	it("escapes special characters in To and callerId (TwiML injection)", async () => {
		const config = makeConfig({ twilioNumber: `+1555<caller>&"'` });
		await saveConfig("alice@example.com", config);
		const maliciousTo = `<Hangup/>&"'`;
		const params = { From: `client:${config.identity}`, To: maliciousTo };
		const signature = await computeTwilioSignature(VOICE_URL, params, config.authToken);

		const response = await postVoice(params, signature);
		expect(response.status).toBe(200);
		const body = await response.text();

		// Raw markup must never appear unescaped.
		expect(body).not.toContain(maliciousTo);
		expect(body).not.toContain(config.twilioNumber);

		expect(body).toContain("&lt;Hangup/&gt;&amp;&quot;&apos;");
		expect(body).toContain("+1555&lt;caller&gt;&amp;&quot;&apos;");
	});
});
