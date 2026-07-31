// Shared test-only constants. Kept in a plain module (no Node- or
// workerd-specific imports) so it can be imported both from
// vitest.config.ts (runs in Node) and from test files (run inside workerd).

// A fixed 64-hex-char AES-256 key used only in tests. Real deployments
// generate their own with `openssl rand -hex 32` and set it via
// `wrangler secret put ENCRYPTION_KEY` (see justfile's `secret-key` task).
export const TEST_ENCRYPTION_KEY =
	"b5ff4159046c8523f473bf481a500f4133443760ecea1199566aa8aacd965288";

// The Cloudflare Access Application Audience (AUD) tag tests pretend to be
// configured for.
export const TEST_ACCESS_AUD = "test-access-application-aud";

export const JWKS_PATH = "/cdn-cgi/access/certs";
