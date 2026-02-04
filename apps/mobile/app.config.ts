
import { ExpoConfig, ConfigContext } from 'expo/config';

// Fetches tenant config during build time (EAS)
async function fetchTenantConfig(slug: string) {
    try {
        // In a real CI, this URL would be the production API
        // For local dev, we might mock it or skip it
        const response = await fetch(`https://studio-platform-api.slichti.workers.dev/public/tenant/${slug}`);
        if (!response.ok) throw new Error("Failed to fetch tenant");
        const data: any = await response.json();
        return data;
    } catch (e) {
        console.warn("Could not fetch tenant config, using defaults", e);
        return null;
    }
}

export default ({ config }: ConfigContext): ExpoConfig => {
    const tenantSlug = process.env.TENANT_SLUG;
    let tenantConfig: any = null;

    if (tenantSlug) {
        console.log(`Building for tenant: ${tenantSlug}`);
        // tenantConfig = await fetchTenantConfig(tenantSlug);
        tenantConfig = { mobileAppConfig: { appName: `Studio ${tenantSlug}` } };
    }

    const mobileConfig = tenantConfig?.mobileAppConfig || {};

    return {
        ...config,
        name: mobileConfig.appName || "Studio Mobile",
        slug: tenantSlug ? `studio-${tenantSlug}` : "studio-mobile",
        version: "1.0.0",
        orientation: "portrait",
        icon: mobileConfig.iconUrl || "./assets/images/icon.png",
        scheme: "mobile",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        splash: {
            image: mobileConfig.splashUrl || "./assets/images/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: mobileConfig.primaryColor || "#ffffff"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: tenantConfig ? `com.studio.${tenantSlug}` : "com.studio.platform"
        },
        android: {
            package: tenantConfig ? `com.studio.${tenantSlug}` : "com.studio.platform",
            adaptiveIcon: {
                foregroundImage: mobileConfig.iconUrl || "./assets/images/adaptive-icon.png",
                backgroundColor: mobileConfig.primaryColor || "#ffffff"
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: [
            "expo-router",
            [
                "expo-notifications",
                {
                    "icon": "./assets/images/notification-icon.png",
                    "color": "#ffffff"
                }
            ]
        ],
        experiments: {
            typedRoutes: true
        },
        extra: {
            tenantSlug: tenantSlug,
            apiUrl: process.env.API_URL || "https://studio-platform-api.slichti.workers.dev"
        }
    };
};
