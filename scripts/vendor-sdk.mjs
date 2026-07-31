// Copies the Twilio Voice SDK's UMD bundle from node_modules into public/,
// so it's served from the app's own origin instead of a third-party CDN.
// Run via `npm run vendor:sdk` (wired into postinstall/predev/predeploy).
//
// Uses Node's fs API rather than a shell `cp` so this works on any platform.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SDK_VERSION = "2.18.3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const src = join(
  repoRoot,
  "node_modules",
  "@twilio",
  "voice-sdk",
  "dist",
  "twilio.min.js",
);
const destDir = join(repoRoot, "public", "vendor");
const dest = join(destDir, `twilio-voice-${SDK_VERSION}.min.js`);

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);

console.log(`vendor:sdk copied ${src} -> ${dest}`);
