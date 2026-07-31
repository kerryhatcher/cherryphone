// Vitest global setup — runs once in Node.js, BEFORE any workerd test files
// start. Its job is to stand up a real JWKS HTTP server that the Worker
// (running inside workerd) can fetch from during auth tests, since
// `createRemoteJWKSet` makes a genuine outbound HTTP request and workerd
// cannot bind a listening socket itself.
//
// The RSA keypair is generated here (Node has WebCrypto too) and handed to
// test files via Vitest's provide/inject mechanism: the port and the public
// JWK are needed to run the server and answer requests; the private JWK is
// exported (JSON-serializable) so test files can re-import it with `jose`
// and mint Access Tokens signed by the "real" key.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair } from "jose";
import type { ProvidedContext } from "vitest";
import { JWKS_PATH } from "./constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_KEY_ID = "test-key-1";

// Vitest doesn't currently export a named `GlobalSetupContext` type (this
// file's default export is loaded dynamically and typed structurally), so
// this is declared by hand to match what `provide` needs.
interface GlobalSetupContext {
	provide: <T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]) => void;
}

export default async function setup({ provide }: GlobalSetupContext) {
	// Read once here (real Node.js fs access) and hand the contents to test
	// files as a string — workerd test files have no filesystem access, even
	// with nodejs_compat.
	const schemaSql = await readFile(path.join(__dirname, "..", "schema.sql"), "utf-8");
	provide("schemaSql", schemaSql);

	const { publicKey, privateKey } = await generateKeyPair("RS256", {
		extractable: true,
	});

	const publicJwk = await exportJWK(publicKey);
	const privateJwk = await exportJWK(privateKey);
	publicJwk.kid = privateJwk.kid = TEST_KEY_ID;
	publicJwk.alg = privateJwk.alg = "RS256";
	publicJwk.use = "sig";

	const server = createServer((req, res) => {
		if (req.url === JWKS_PATH) {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ keys: [publicJwk] }));
			return;
		}
		res.writeHead(404);
		res.end();
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to start test JWKS server");
	}

	provide("jwksPort", address.port);
	provide("jwksKeyId", TEST_KEY_ID);
	provide("privateJwk", privateJwk);

	return () => {
		server.close();
	};
}
