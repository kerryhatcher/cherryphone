/**
 * CherryPhone Worker — serves frontend, handles auth, D1 storage, Twilio tokens.
 *
 * Protected by Cloudflare Access. User identity comes from the
 * Cf-Access-Authenticated-User-Email header set by Access.
 *
 * API endpoints:
 *   GET  /api/config  — get current user's Twilio config
 *   POST /api/config  — save current user's Twilio config
 *   POST /api/token   — generate a Twilio Access Token
 *   GET  /api/logs    — get call logs for current user
 *   POST /api/logs    — log a call event
 */

import { SignJWT } from "jose";

// ── Types ────────────────────────────────────────────────────────────

interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	ENCRYPTION_KEY: string;
}

interface TwilioConfig {
	accountSid: string;
	authToken: string;
	twilioNumber: string;
	identity: string;
}

interface CallLogEntry {
	toNumber: string;
	status: string;
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
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// ── Encryption helpers (AES-GCM) ─────────────────────────────────────
async function getEncryptionKey(env: Env): Promise<CryptoKey> {
	const raw = env.ENCRYPTION_KEY;
	if (!raw) throw new Error("ENCRYPTION_KEY not configured");
	const keyBytes = new TextEncoder().encode(raw).slice(0, 32);
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
function getUserEmail(request: Request): string | null {
	return request.headers.get("Cf-Access-Authenticated-User-Email") || null;
}

function requireAuth(request: Request): Response | null {
	const email = getUserEmail(request);
	if (!email) {
		return Response.json(
			{ ok: false, error: "Unauthorized" } satisfies ApiResponse,
			{ status: 401, headers: CORS_HEADERS },
		);
	}
	return null; // authenticated
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

async function getStoredConfig(
	db: D1Database,
	email: string,
	env: Env,
): Promise<TwilioConfig | null> {
	const row = await db
		.prepare("SELECT * FROM configs WHERE user_id = ?")
		.bind(email)
		.first<{
			account_sid_encrypted: string;
			auth_token_encrypted: string;
			twilio_number: string;
			identity: string | null;
		}>();

	if (!row) return null;

	return {
		accountSid: await decrypt(row.account_sid_encrypted, env),
		authToken: await decrypt(row.auth_token_encrypted, env),
		twilioNumber: row.twilio_number,
		identity: row.identity || email,
	};
}

async function saveStoredConfig(
	db: D1Database,
	email: string,
	config: TwilioConfig,
	env: Env,
) {
	const accountSidEncrypted = await encrypt(config.accountSid, env);
	const authTokenEncrypted = await encrypt(config.authToken, env);

	await db
		.prepare(
			`INSERT INTO configs (user_id, account_sid_encrypted, auth_token_encrypted, twilio_number, identity, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         account_sid_encrypted = excluded.account_sid_encrypted,
         auth_token_encrypted = excluded.auth_token_encrypted,
         twilio_number = excluded.twilio_number,
         identity = excluded.identity,
         updated_at = datetime('now')`,
		)
		.bind(
			email,
			accountSidEncrypted,
			authTokenEncrypted,
			config.twilioNumber,
			config.identity || email,
		)
		.run();
}

// ── Twilio Access Token generation ──────────────────────────────────
async function generateToken(config: TwilioConfig): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const identity = config.identity || `cherryphone_${crypto.randomUUID().slice(0, 8)}`;

	return new SignJWT({
		jti: crypto.randomUUID(),
		iss: config.accountSid,
		sub: config.accountSid,
		exp: now + TOKEN_TTL,
		nbf: now,
		iat: now,
		grants: {
			voice: {
				incoming: { allow: true },
				outgoing: { application_sid: true },
			},
			identity,
		},
	})
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.sign(new TextEncoder().encode(config.authToken));
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

		// ── API routes ──────────────────────────────────────────────
		if (url.pathname.startsWith("/api/")) {
			// Require auth for all API routes
			const authError = requireAuth(request);
			if (authError) return authError;

			const email = getUserEmail(request)!;
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
										accountSid: config.accountSid,
										twilioNumber: config.twilioNumber,
										identity: config.identity,
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
					if (!body.accountSid || !body.authToken || !body.twilioNumber) {
						return Response.json(
							{ ok: false, error: "Missing required fields" } satisfies ApiResponse,
							{ status: 400, headers: CORS_HEADERS },
						);
					}

					const config: TwilioConfig = {
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

			// POST /api/token — generate a Twilio Access Token
			if (method === "POST" && url.pathname === "/api/token") {
				try {
					// Try to use stored config first, fall back to request body
					let config = await getStoredConfig(env.DB, email, env);

					if (!config) {
						const body = (await request.json()) as Partial<TwilioConfig>;
						if (!body.accountSid || !body.authToken || !body.twilioNumber) {
							return Response.json(
								{ ok: false, error: "No config found. Save settings first." } satisfies ApiResponse,
								{ status: 400, headers: CORS_HEADERS },
							);
						}
						config = {
							accountSid: body.accountSid,
							authToken: body.authToken,
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
							`INSERT INTO call_logs (user_id, to_number, status, duration_seconds, call_sid, started_at, ended_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
						)
						.bind(
							email,
							body.toNumber,
							body.status,
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
