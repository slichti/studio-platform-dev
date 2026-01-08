#!/bin/bash

# Setup Secrets for Studio Platform API
# Usage: ./scripts/setup-secrets.sh

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Studio Platform Secrets Setup ===${NC}"
echo "This script will help you set production secrets for the Cloudflare Worker."
echo ""

# List of required secrets
SECRETS=(
  "STRIPE_SECRET_KEY"
  "CLERK_SECRET_KEY"
  "ZOOM_ACCOUNT_ID"
  "ZOOM_CLIENT_ID"
  "ZOOM_CLIENT_SECRET"
  "ZOOM_WEBHOOK_SECRET_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID"
  "CLOUDFLARE_API_TOKEN"
  "RESEND_API_KEY"
  "CLERK_WEBHOOK_SECRET"
  "ENCRYPTION_SECRET"
  "LIVEKIT_API_KEY"
  "LIVEKIT_API_SECRET"
)

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js and npm."
    exit 1
fi

for SECRET_NAME in "${SECRETS[@]}"; do
  echo -e "${BLUE}Configuring $SECRET_NAME${NC}"
  read -p "Enter value (leave empty to skip): " SECRET_VALUE
  
  if [ -n "$SECRET_VALUE" ]; then
    echo "Uploading $SECRET_NAME..."
    echo "$SECRET_VALUE" | npx wrangler secret put "$SECRET_NAME"
    echo -e "${GREEN}✓ $SECRET_NAME set${NC}"
  else
    echo "Skipping $SECRET_NAME"
  fi
  echo ""
done

echo -e "${GREEN}=== Secrets Configuration Complete ===${NC}"
echo "You can verify secrets by running: npx wrangler secret list"
