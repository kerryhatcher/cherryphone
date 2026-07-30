# CherryPhone — local dev commands

# Start local dev environment (wrangler dev with D1)
run:
    npx wrangler dev --ip 0.0.0.0

# Deploy to production
deploy:
    npx wrangler deploy

# Apply D1 schema
db-schema:
    npx wrangler d1 execute cherryphone --file=schema.sql

# Create D1 database (run once)
db-create:
    npx wrangler d1 create cherryphone

# Set encryption key secret
secret-key:
    @printf "Enter encryption key (32 hex chars): " && read key && echo "$$key" | npx wrangler secret put ENCRYPTION_KEY

# Install dependencies
setup:
    npm install

# Type-check
check:
    npx tsc --noEmit
