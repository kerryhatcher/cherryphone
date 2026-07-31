# CherryPhone — local dev commands

# Vendor the Twilio Voice SDK into public/ (see scripts/vendor-sdk.mjs)
vendor:
    node scripts/vendor-sdk.mjs

# Start local dev environment (wrangler dev with D1)
run: vendor
    npx wrangler dev --ip 0.0.0.0

# Deploy to production
deploy: vendor
    npx wrangler deploy

# Apply D1 schema locally (safe default — targets miniflare's local D1)
db-schema-local:
    npx wrangler d1 execute cherryphone --local --file=schema.sql

# Apply D1 schema to the REMOTE (production) database
db-schema:
    npx wrangler d1 execute cherryphone --remote --file=schema.sql

# Create D1 database (run once)
db-create:
    npx wrangler d1 create cherryphone

# Set encryption key secret
secret-key:
    @printf "Enter encryption key (64 hex chars): " && read key && echo "$$key" | npx wrangler secret put ENCRYPTION_KEY

# Install dependencies
setup:
    npm install

# Type-check
check:
    npx tsc --noEmit
