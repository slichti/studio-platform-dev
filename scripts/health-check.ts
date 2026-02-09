/**
 * Automated Health Check Script
 * 
 * Pings the /diagnostics endpoint to verify system status and database latency.
 * Exit code 0 if healthy, 1 if unhealthy.
 */

const API_URL = process.env.API_URL || 'https://studio-platform-api.slichti.workers.dev';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function runCheck() {
    if (!ADMIN_TOKEN) {
        console.error('❌ ADMIN_TOKEN is missing. Set it with: export ADMIN_TOKEN=your_token');
        process.exit(1);
    }

    console.log(`🔍 Starting health check for: ${API_URL}`);

    try {
        const start = Date.now();
        const res = await fetch(`${API_URL}/diagnostics`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'x-request-id': `health-check-${Date.now()}`
            }
        });
        const duration = Date.now() - start;

        if (!res.ok) {
            console.error(`❌ Health check FAILED with status ${res.status}`);
            const text = await res.text();
            console.error(`Details: ${text}`);
            process.exit(1);
        }

        const data: any = await res.json();

        console.log(`✅ API Responsive (${duration}ms)`);
        console.log(`✅ System Status: ${data.status.toUpperCase()}`);
        console.log(`📊 DB Latency: Read=${data.latency.database_read_ms}ms, Query=${data.latency.database_query_ms}ms`);
        console.log(`🌍 Edge Node: ${data.worker.colo} (${data.worker.city}, ${data.worker.country})`);

        if (data.status !== 'ok') {
            console.error('❌ System reporting degraded state!');
            process.exit(1);
        }

        if (data.latency.database_read_ms > 1000) {
            console.warn('⚠️ Warning: High database read latency (>1000ms)');
        }

        console.log('✨ System is healthy.');
        process.exit(0);

    } catch (e: any) {
        console.error(`❌ Health check EXCEPTION: ${e.message}`);
        process.exit(1);
    }
}

runCheck();
