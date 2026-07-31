// Shared helpers for exercising the Worker's HTTP surface from test files.
// These run inside workerd (same as the test files that import them), so
// they can use Web Crypto and `jose` directly.
import { exports } from "cloudflare:workers";
import { SignJWT, exportJWK, generateKeyPair, importJWK } from "jose";
import { inject } from "vitest";
import { TEST_ACCESS_AUD } from "./constants";

export function accessTeamDomain(): string {
	return `http://127.0.0.1:${inject("jwksPort")}`;
}

interface MintOptions {
	/** Overrides the `aud` claim — set to something other than TEST_ACCESS_AUD to simulate a wrong-audience token. */
	aud?: string;
	/** Overrides the `iss` claim. */
	issuer?: string;
	/** Seconds from now the token expires. Defaults to 1 hour. */
	expiresInSeconds?: number;
	/** Sign with a throwaway key instead of the real test JWKS key, to simulate a forged/bad-signature token. The kid still matches the real key so the Worker's JWKS resolver picks the real (non-matching) public key. */
	badSignature?: boolean;
}

// Mints a Cloudflare Access-style JWT (RS256, `email` claim) for use as the
// `Cf-Access-Jwt-Assertion` header. By default it is signed with the real
// test JWKS private key and carries valid claims, so it is accepted by the
// Worker.
async function resolveSigningKey(badSignature?: boolean) {
	if (badSignature) {
		// A completely different keypair — same kid as the real key, so the
		// Worker looks up the correct public key by kid but verification
		// against it fails because this JWT was signed with a different
		// private key.
		const throwaway = await generateKeyPair("RS256", { extractable: true });
		return throwaway.privateKey;
	}
	return importJWK(inject("privateJwk"), "RS256");
}

export async function mintAccessJwt(email: string, options: MintOptions = {}): Promise<string> {
	const keyId = inject("jwksKeyId");
	const signingKey = await resolveSigningKey(options.badSignature);

	const now = Math.floor(Date.now() / 1000);
	const expiresIn = options.expiresInSeconds ?? 3600;

	return new SignJWT({ email })
		.setProtectedHeader({ alg: "RS256", typ: "JWT", kid: keyId })
		.setIssuer(options.issuer ?? accessTeamDomain())
		.setAudience(options.aud ?? TEST_ACCESS_AUD)
		.setIssuedAt(now)
		.setExpirationTime(now + expiresIn)
		.sign(signingKey);
}

// Exported for completeness / potential future use (e.g. asserting a token
// signed by a wholly unrelated JWKS is rejected). Not currently used by any
// test but kept next to mintAccessJwt since it shares the throwaway-key
// logic.
export async function exportThrowawayPublicJwk() {
	const { publicKey } = await generateKeyPair("RS256", { extractable: true });
	return exportJWK(publicKey);
}

// Calls the Worker's fetch handler in-process (no real network hop).
export function callWorker(request: Request): Promise<Response> {
	return exports.default.fetch(request);
}

// Twilio signs webhook requests with HMAC-SHA1, keyed with the account's
// Auth Token, over: the full request URL, followed by every POST param
// sorted by key and concatenated as key+value (no separators). Mirrors
// src/worker.ts's computeTwilioSignature so tests can construct requests
// with a signature the Worker will accept (or deliberately won't).
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
export async function computeTwilioSignature(
	url: string,
	params: Record<string, string>,
	authToken: string,
): Promise<string> {
	let data = url;
	for (const key of Object.keys(params).sort()) {
		data += key + params[key];
	}

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(authToken),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));

	let binary = "";
	new Uint8Array(mac).forEach((b) => (binary += String.fromCharCode(b)));
	return btoa(binary);
}

export interface TestTwilioConfig {
	apiKeySid: string;
	apiKeySecret: string;
	twimlAppSid: string;
	accountSid: string;
	authToken: string;
	twilioNumber: string;
	identity: string;
}

export function makeConfig(overrides: Partial<TestTwilioConfig> = {}): TestTwilioConfig {
	return {
		apiKeySid: "SKtestapikeysid00000000000000",
		apiKeySecret: "test-api-key-secret",
		twimlAppSid: "APtesttwimlappsid000000000000",
		accountSid: "ACtestaccountsid0000000000000",
		authToken: "test-auth-token",
		twilioNumber: "+15550100000",
		identity: "test_identity",
		...overrides,
	};
}

// Saves a config as the given (authenticated) user via the real
// POST /api/config endpoint — exercising the same encryption path
// production traffic uses, rather than writing to D1 directly.
export async function saveConfig(email: string, config: TestTwilioConfig): Promise<Response> {
	const jwt = await mintAccessJwt(email);
	return callWorker(
		new Request("https://cherryphone.example.com/api/config", {
			method: "POST",
			headers: {
				"Cf-Access-Jwt-Assertion": jwt,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(config),
		}),
	);
}
