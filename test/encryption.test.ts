// AES-GCM encryption helpers (src/worker.ts's encrypt/decrypt) and the
// ENCRYPTION_KEY validation they enforce.
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/worker";
import { TEST_ENCRYPTION_KEY } from "./constants";

describe("encrypt/decrypt", () => {
	it("round-trips plaintext through encrypt then decrypt", async () => {
		const plaintext = "SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
		const ciphertext = await encrypt(plaintext, env);
		expect(ciphertext).not.toBe(plaintext);
		expect(await decrypt(ciphertext, env)).toBe(plaintext);
	});

	it("produces a different ciphertext each time (random IV per call)", async () => {
		const plaintext = "same-secret-value";
		const a = await encrypt(plaintext, env);
		const b = await encrypt(plaintext, env);
		expect(a).not.toBe(b);
		// Both must still decrypt back to the same plaintext.
		expect(await decrypt(a, env)).toBe(plaintext);
		expect(await decrypt(b, env)).toBe(plaintext);
	});
});

describe("ENCRYPTION_KEY validation", () => {
	const originalKey = TEST_ENCRYPTION_KEY;

	afterEach(() => {
		env.ENCRYPTION_KEY = originalKey;
	});

	it("accepts exactly 64 hex characters", async () => {
		env.ENCRYPTION_KEY = "ab".repeat(32); // 64 hex chars
		await expect(encrypt("hello", env)).resolves.toBeTypeOf("string");
	});

	it("rejects a 32-hex-char key (16 bytes, not 32)", async () => {
		env.ENCRYPTION_KEY = "ab".repeat(16); // 32 hex chars
		await expect(encrypt("hello", env)).rejects.toThrow();
	});

	it("rejects a 65-char key", async () => {
		env.ENCRYPTION_KEY = `${"ab".repeat(32)}c`; // 65 chars
		await expect(encrypt("hello", env)).rejects.toThrow();
	});

	it("rejects a non-hex string of the right length", async () => {
		env.ENCRYPTION_KEY = "z".repeat(64); // 64 chars, not hex
		await expect(encrypt("hello", env)).rejects.toThrow();
	});

	it("rejects an unset key", async () => {
		env.ENCRYPTION_KEY = "";
		await expect(encrypt("hello", env)).rejects.toThrow("ENCRYPTION_KEY not configured");
	});
});
