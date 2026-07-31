/**
 * CherryPhone Worker — serves frontend, handles auth, D1 storage, Twilio tokens.
 *
 * Protected by Cloudflare Access. User identity is derived from the
 * Cf-Access-Jwt-Assertion header, which is verified against the Access
 * team's JWKS before trusting any claim in it. The
 * Cf-Access-Authenticated-User-Email header is NEVER trusted directly —
 * it is a plain HTTP header that anyone can forge on unprotected routes.
 *
 * API endpoints:
 *   GET    /api/config — get current user's Twilio config
 *   POST   /api/config — save current user's Twilio config
 *   DELETE /api/config — clear current user's Twilio config
 *   POST   /api/token  — generate a Twilio Access Token
 *   GET    /api/logs   — get call logs for current user
 *   POST   /api/logs   — log a call event
 *
 * Webhook (unauthenticated by Cloudflare Access — see /voice handler):
 *   POST /voice        — TwiML App Voice URL, called by Twilio's servers
 */

import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

// ── Types ────────────────────────────────────────────────────────────

interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	ENCRYPTION_KEY: string;
	ACCESS_TEAM_DOMAIN: string;
	ACCESS_AUD: string;
}

interface TwilioConfig {
	apiKeySid: string; // SKxxxx — signs the Access Token, iss claim
	apiKeySecret: string; // signing key for the Access Token
	twimlAppSid: string; // APxxxx — outgoing.application_sid grant
	accountSid: string; // ACxxxx — sub claim
	authToken: string; // used ONLY to validate X-Twilio-Signature on /voice
	twilioNumber: string;
	identity: string;
}

interface ConfigRow {
	user_id: string;
	api_key_sid_encrypted: string;
	api_key_secret_encrypted: string;
	twiml_app_sid_encrypted: string;
	account_sid_encrypted: string;
	auth_token_encrypted: string;
	twilio_number: string;
	identity: string | null;
}

interface CallLogEntry {
	toNumber: string;
	status: string;
	direction?: string; // 'outbound' | 'inbound' — defaults to 'outbound'
	durationSeconds?: number;
	callSid?: string;
	startedAt?: string;
	endedAt?: string;
}

interface ApiResponse {
	ok: boolean;
	data?: unknown;
	error?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const TOKEN_TTL = 3600; // 1 hour

// This app is same-origin only — the Worker serves its own frontend via
// the ASSETS binding, so no cross-origin caller should ever need these
// endpoints. No Access-Control-Allow-Origin header is set.
const CORS_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// ── Encryption helpers (AES-GCM) ─────────────────────────────────────
async function getEncryptionKey(env: Env): Promise<CryptoKey> {
	const raw = env.ENCRYPTION_KEY;
	if (!raw) throw new Error("ENCRYPTION_KEY not configured");
	// Must be 64 hex characters decoding to exactly 32 bytes (AES-256).
	// Fail closed on any mismatch — never truncate or pad the key.
	if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
		throw new Error(
			"ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes for AES-256); generate one with `openssl rand -hex 32`",
		);
	}
	const keyBytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		keyBytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
	}
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "AES-GCM" },
		false,
		["encrypt", "decrypt"],
	);
}

async function encrypt(plaintext: string, env: Env): Promise<string> {
	const key = await getEncryptionKey(env);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	// Return base64(iv + ciphertext)
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	let binary = "";
	combined.forEach((b) => (binary += String.fromCharCode(b)));
	return btoa(binary);
}

async function decrypt(encoded: string, env: Env): Promise<string> {
	const key = await getEncryptionKey(env);
	const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext,
	);
	return new TextDecoder().decode(decrypted);
}

// ── Auth helper ──────────────────────────────────────────────────────
//
// Cloudflare Access sets the Cf-Access-Authenticated-User-Email header,
// but that is a plain HTTP header — it is only trustworthy on a hostname
// that sits behind Access, and it is directly forgeable everywhere else
// (e.g. the workers.dev route). Identity MUST instead come from the
// Cf-Access-Jwt-Assertion header (or CF_Authorization cookie), verified
// against the Access team's JWKS. The email is then read from the
// VERIFIED payload, never from the header.
//
// createRemoteJWKSet caches fetched keys in memory and re-fetches only as
// needed, so the JWKS resolver is created once at module scope rather
// than per-request.
let jwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeamDomain: string | null = null;

function getJwks(teamDomain: string) {
	if (!jwksResolver || jwksTeamDomain !== teamDomain) {
		jwksResolver = createRemoteJWKSet(
			new URL("/cdn-cgi/access/certs", teamDomain),
		);
		jwksTeamDomain = teamDomain;
	}
	return jwksResolver;
}

function getCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
	}
	return null;
}

async function getUserEmail(request: Request, env: Env): Promise<string | null> {
	// Fail closed: a misconfigured deployment (missing team domain/AUD)
	// must reject requests, not fall back to trusting the header.
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

	const token =
		request.headers.get("Cf-Access-Jwt-Assertion") ||
		getCookie(request, "CF_Authorization");
	if (!token) return null;

	try {
		const JWKS = getJwks(env.ACCESS_TEAM_DOMAIN);
		const { payload } = await jwtVerify(token, JWKS, {
			issuer: env.ACCESS_TEAM_DOMAIN,
			audience: env.ACCESS_AUD,
		});
		return typeof payload.email === "string" ? payload.email : null;
	} catch {
		// Invalid signature, expired, wrong audience, malformed, JWKS fetch
		// failure, etc. — all treated as unauthenticated.
		return null;
	}
}

async function requireAuth(request: Request, env: Env): Promise<{ email: string } | Response> {
	const email = await getUserEmail(request, env);
	if (!email) {
		return Response.json(
			{ ok: false, error: "Unauthorized" } satisfies ApiResponse,
			{ status: 401, headers: CORS_HEADERS },
		);
	}
	return { email };
}

// ── D1 helpers ───────────────────────────────────────────────────────
async function ensureUser(db: D1Database, email: string) {
	await db
		.prepare(
			"INSERT OR IGNORE INTO users (id, display_name) VALUES (?, ?)",
		)
		.bind(email, email.split("@")[0])
		.run();
}

async function decryptConfigRow(row: ConfigRow, env: Env): Promise<TwilioConfig> {
	return {
		apiKeySid: await decrypt(row.api_key_sid_encrypted, env),
		apiKeySecret: await decrypt(row.api_key_secret_encrypted, env),
		twimlAppSid: await decrypt(row.twiml_app_sid_encrypted, env),
		accountSid: await decrypt(row.account_sid_encrypted, env),
		authToken: await decrypt(row.auth_token_encrypted, env),
		twilioNumber: row.twilio_number,
		identity: row.identity || row.user_id,
	};
}

async function getStoredConfig(
	db: D1Database,
	email: string,
	env: Env,
): Promise<TwilioConfig | null> {
	const row = await db
		.prepare("SELECT * FROM configs WHERE user_id = ?")
		.bind(email)
		.first<ConfigRow>();

	if (!row) return null;
	return decryptConfigRow(row, env);
}

// Used by the /voice webhook: Twilio sends From=client:<identity>, so the
// config has to be found by identity rather than by the authenticated
// user's email (that route has no Access JWT to read email from).
async function getStoredConfigByIdentity(
	db: D1Database,
	identity: string,
	env: Env,
): Promise<TwilioConfig | null> {
	const row = await db
		.prepare("SELECT * FROM configs WHERE identity = ?")
		.bind(identity)
		.first<ConfigRow>();

	if (!row) return null;
	return decryptConfigRow(row, env);
}

async function saveStoredConfig(
	db: D1Database,
	email: string,
	config: TwilioConfig,
	env: Env,
) {
	const apiKeySidEncrypted = await encrypt(config.apiKeySid, env);
	const apiKeySecretEncrypted = await encrypt(config.apiKeySecret, env);
	const twimlAppSidEncrypted = await encrypt(config.twimlAppSid, env);
	const accountSidEncrypted = await encrypt(config.accountSid, env);
	const authTokenEncrypted = await encrypt(config.authToken, env);

	await db
		.prepare(
			`INSERT INTO configs (user_id, api_key_sid_encrypted, api_key_secret_encrypted, twiml_app_sid_encrypted, account_sid_encrypted, auth_token_encrypted, twilio_number, identity, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         api_key_sid_encrypted = excluded.api_key_sid_encrypted,
         api_key_secret_encrypted = excluded.api_key_secret_encrypted,
         twiml_app_sid_encrypted = excluded.twiml_app_sid_encrypted,
         account_sid_encrypted = excluded.account_sid_encrypted,
         auth_token_encrypted = excluded.auth_token_encrypted,
         twilio_number = excluded.twilio_number,
         identity = excluded.identity,
         updated_at = datetime('now')`,
		)
		.bind(
			email,
			apiKeySidEncrypted,
			apiKeySecretEncrypted,
			twimlAppSidEncrypted,
			accountSidEncrypted,
			authTokenEncrypted,
			config.twilioNumber,
			config.identity || email,
		)
		.run();
}

// ── Twilio Access Token generation ──────────────────────────────────
//
// A Twilio Access Token is a "Flex/FPA" JWT: signed with an API Key
// Secret (never the Auth Token), iss = API Key SID, sub = Account SID,
// and a required `cty: "twilio-fpa;v=1"` header. outgoing.application_sid
// must be the real TwiML App SID that Twilio will POST /voice to.
async function generateToken(config: TwilioConfig): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const identity = config.identity || `cherryphone_${crypto.randomUUID().slice(0, 8)}`;

	return new SignJWT({
		grants: {
			identity,
			voice: {
				incoming: { allow: true },
				outgoing: { application_sid: config.twimlAppSid },
			},
		},
	})
		.setProtectedHeader({ alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" })
		.setJti(crypto.randomUUID())
		.setIssuer(config.apiKeySid)
		.setSubject(config.accountSid)
		.setIssuedAt(now)
		.setNotBefore(now)
		.setExpirationTime(now + TOKEN_TTL)
		.sign(new TextEncoder().encode(config.apiKeySecret));
}

// ── Twilio webhook signature validation ─────────────────────────────
//
// Twilio signs webhook requests with HMAC-SHA1, keyed with the account's
// Auth Token, over: the full request URL, followed by every POST param
// sorted by key and concatenated as key+value (no separators). See
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
async function computeTwilioSignature(
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

// Constant-time string comparison — avoids leaking the expected signature
// byte-by-byte through response-time differences.
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case "<": return "&lt;";
			case ">": return "&gt;";
			case "&": return "&amp;";
			case "'": return "&apos;";
			case '"': return "&quot;";
			default: return c;
		}
	});
}

// ── /voice TwiML webhook ────────────────────────────────────────────
//
// This is the TwiML App's Voice URL. Twilio's servers POST here whenever
// the browser client places an outgoing call. It is called BEFORE the
// /api/* auth block and must never call requireAuth — Twilio cannot
// present a Cloudflare Access JWT, so this hostname needs an Access
// bypass policy for this exact path (see README). Instead, Twilio's
// identity is verified directly via X-Twilio-Signature.
async function handleVoiceWebhook(request: Request, env: Env): Promise<Response> {
	const signature = request.headers.get("X-Twilio-Signature");
	if (!signature) {
		return new Response("Forbidden", { status: 403 });
	}

	const formData = await request.formData();
	const params: Record<string, string> = {};
	formData.forEach((value, key) => {
		params[key] = String(value);
	});

	// client.js sets params.To; Twilio sets From to "client:<identity>"
	// for calls originating from the Voice SDK.
	const from = params.From || "";
	const identity = from.startsWith("client:") ? from.slice("client:".length) : null;
	if (!identity) {
		return new Response("Forbidden", { status: 403 });
	}

	const config = await getStoredConfigByIdentity(env.DB, identity, env);
	if (!config) {
		return new Response("Forbidden", { status: 403 });
	}

	if (params.AccountSid && params.AccountSid !== config.accountSid) {
		return new Response("Forbidden", { status: 403 });
	}

	const expected = await computeTwilioSignature(request.url, params, config.authToken);
	if (!timingSafeEqual(expected, signature)) {
		return new Response("Forbidden", { status: 403 });
	}

	const to = escapeXml(params.To || "");
	const callerId = escapeXml(config.twilioNumber);
	const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}">${to}</Dial></Response>`;

	return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

// ── Request handler ──────────────────────────────────────────────────
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

		// CORS preflight
		if (method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		// POST /voice — TwiML App Voice URL, called by Twilio's servers.
		// MUST stay outside the /api/* auth block: Twilio can't present a
		// Cloudflare Access JWT, so this route authenticates the caller
		// itself via X-Twilio-Signature instead of requireAuth().
		if (method === "POST" && url.pathname === "/voice") {
			return handleVoiceWebhook(request, env);
		}

		// ── API routes ──────────────────────────────────────────────
		if (url.pathname.startsWith("/api/")) {
			// Require auth for all API routes
			const auth = await requireAuth(request, env);
			if (auth instanceof Response) return auth;
			const { email } = auth;
			await ensureUser(env.DB, email);

			// GET /api/config — get user's Twilio config
			if (method === "GET" && url.pathname === "/api/config") {
				try {
					const config = await getStoredConfig(env.DB, email, env);
					return Response.json(
						{
							ok: true,
							data: config
								? {
										apiKeySid: config.apiKeySid,
										twimlAppSid: config.twimlAppSid,
										accountSid: config.accountSid,
										twilioNumber: config.twilioNumber,
										identity: config.identity,
										hasApiKeySecret: !!config.apiKeySecret,
										hasAuthToken: !!config.authToken,
									}
								: null,
						} satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to load config: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// POST /api/config — save user's Twilio config
			if (method === "POST" && url.pathname === "/api/config") {
				try {
					const body = (await request.json()) as Partial<TwilioConfig>;
					if (
						!body.apiKeySid ||
						!body.apiKeySecret ||
						!body.twimlAppSid ||
						!body.accountSid ||
						!body.authToken ||
						!body.twilioNumber
					) {
						return Response.json(
							{ ok: false, error: "Missing required fields" } satisfies ApiResponse,
							{ status: 400, headers: CORS_HEADERS },
						);
					}

					const config: TwilioConfig = {
						apiKeySid: body.apiKeySid,
						apiKeySecret: body.apiKeySecret,
						twimlAppSid: body.twimlAppSid,
						accountSid: body.accountSid,
						authToken: body.authToken,
						twilioNumber: body.twilioNumber,
						identity: body.identity || email,
					};

					await saveStoredConfig(env.DB, email, config, env);

					return Response.json(
						{ ok: true, data: { message: "Config saved" } } satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to save config: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// DELETE /api/config — clear user's Twilio config
			if (method === "DELETE" && url.pathname === "/api/config") {
				try {
					await env.DB
						.prepare("DELETE FROM configs WHERE user_id = ?")
						.bind(email)
						.run();

					return Response.json(
						{ ok: true, data: { message: "Config cleared" } } satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to clear config: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// POST /api/token — generate a Twilio Access Token
			if (method === "POST" && url.pathname === "/api/token") {
				try {
					// Try to use stored config first, fall back to request body
					let config = await getStoredConfig(env.DB, email, env);

					if (!config) {
						const body = (await request.json()) as Partial<TwilioConfig>;
						if (
							!body.apiKeySid ||
							!body.apiKeySecret ||
							!body.twimlAppSid ||
							!body.accountSid ||
							!body.twilioNumber
						) {
							return Response.json(
								{ ok: false, error: "No config found. Save settings first." } satisfies ApiResponse,
								{ status: 400, headers: CORS_HEADERS },
							);
						}
						config = {
							apiKeySid: body.apiKeySid,
							apiKeySecret: body.apiKeySecret,
							twimlAppSid: body.twimlAppSid,
							accountSid: body.accountSid,
							authToken: body.authToken || "",
							twilioNumber: body.twilioNumber,
							identity: body.identity || email,
						};
					}

					const token = await generateToken(config);
					return Response.json(
						{
							ok: true,
							data: { token, twilioNumber: config.twilioNumber },
						} satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to generate token: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// GET /api/logs — get call logs
			if (method === "GET" && url.pathname === "/api/logs") {
				try {
					const { results } = await env.DB
						.prepare(
							"SELECT * FROM call_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
						)
						.bind(email)
						.all();

					return Response.json(
						{ ok: true, data: results } satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to load logs: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// POST /api/logs — log a call event
			if (method === "POST" && url.pathname === "/api/logs") {
				try {
					const body = (await request.json()) as CallLogEntry;
					await env.DB
						.prepare(
							`INSERT INTO call_logs (user_id, to_number, status, direction, duration_seconds, call_sid, started_at, ended_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
						)
						.bind(
							email,
							body.toNumber,
							body.status,
							body.direction || "outbound",
							body.durationSeconds || null,
							body.callSid || null,
							body.startedAt || null,
							body.endedAt || null,
						)
						.run();

					return Response.json(
						{ ok: true, data: { message: "Call logged" } } satisfies ApiResponse,
						{ headers: CORS_HEADERS },
					);
				} catch (e) {
					return Response.json(
						{ ok: false, error: `Failed to log call: ${e}` } satisfies ApiResponse,
						{ status: 500, headers: CORS_HEADERS },
					);
				}
			}

			// Unknown API route
			return Response.json(
				{ ok: false, error: "Not found" } satisfies ApiResponse,
				{ status: 404, headers: CORS_HEADERS },
			);
		}

		// ── Serve frontend ──────────────────────────────────────────
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
