const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Usage: node scripts/setup-tenant-mobile.js <slug> [api-url]
const args = process.argv.slice(2);
const slug = args[0];
const apiUrl = args[1] || 'https://studio-platform-api.slichti.workers.dev';

if (!slug) {
    console.error("❌ Error: Tenant slug is required.");
    process.exit(1);
}

const assetsDir = path.join(__dirname, '../apps/mobile/assets/tenant');
const configPath = path.join(__dirname, '../apps/mobile/tenant.config.json');

async function downloadFile(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(arrayBuffer));
}

async function main() {
    console.log(`🚀 Setting up mobile environment for tenant: ${slug}`);

    // 1. Fetch Tenant Config
    console.log(`fetching config from ${apiUrl}/public/tenant/${slug}...`);
    try {
        const res = await fetch(`${apiUrl}/public/tenant/${slug}`);
        if (!res.ok) {
            if (res.status === 404) {
                console.error(`❌ Tenant '${slug}' not found.`);
            } else {
                console.error(`❌ API Error: ${res.statusText}`);
            }
            process.exit(1);
        }

        const data = await res.json();
        const mobileConfig = data.mobileAppConfig || {};
        const branding = data.branding || {};

        console.log(`✅ Config found for: ${data.name}`);

        // 2. Prepare Assets Directory
        if (fs.existsSync(assetsDir)) {
            fs.rmSync(assetsDir, { recursive: true, force: true });
        }
        fs.mkdirSync(assetsDir, { recursive: true });

        // 3. Download Assets
        const iconPath = path.join(assetsDir, 'icon.png');
        const splashPath = path.join(assetsDir, 'splash.png');

        if (mobileConfig.iconUrl) {
            console.log(`Downloading icon: ${mobileConfig.iconUrl}`);
            await downloadFile(mobileConfig.iconUrl, iconPath);
        } else {
            console.log("Using default icon.");
        }

        if (mobileConfig.splashUrl) {
            console.log(`Downloading splash: ${mobileConfig.splashUrl}`);
            await downloadFile(mobileConfig.splashUrl, splashPath);
        } else {
            console.log("Using default splash.");
        }

        // 4. Write Local Config for app.config.ts
        const localConfig = {
            slug,
            name: mobileConfig.appName || data.name,
            scheme: `studio-${slug}`,
            bundleIdentifier: `com.studio.${slug}`,
            primaryColor: mobileConfig.primaryColor || branding.primaryColor || "#000000",
            iconPath: mobileConfig.iconUrl ? './assets/tenant/icon.png' : null,
            splashPath: mobileConfig.splashUrl ? './assets/tenant/splash.png' : null,
            apiUrl,
            version: '1.0.0'
        };

        fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2));
        console.log(`✅ Tenant config saved to ${configPath}`);

    } catch (error) {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    }
}

main();
