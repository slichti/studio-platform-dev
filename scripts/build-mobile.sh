#!/bin/bash

# Usage: ./scripts/build-mobile.sh <tenant-slug> <profile>
# Example: ./scripts/build-mobile.sh my-studio production

TENANT_SLUG=$1
PROFILE=${2:-preview}

if [ -z "$TENANT_SLUG" ]; then
  echo "Error: Tenant Slug is required."
  echo "Usage: ./scripts/build-mobile.sh <tenant-slug> [profile]"
  exit 1
fi

echo "🚀 Preparing build for tenant: $TENANT_SLUG (Profile: $PROFILE)"

# 1. Fetch Tenant Config & Assets
# We call the setup script from the root
echo "⚙️  Setting up tenant assets..."
node scripts/setup-tenant-mobile.js $TENANT_SLUG

# 2. Run EAS Build
echo "📱 Starting build..."

# We must run this from apps/mobile so EAS picks up the app.config.ts and assets
cd apps/mobile

# Run EAS Build
npx eas-cli build --platform ios --profile $PROFILE --local --non-interactive
