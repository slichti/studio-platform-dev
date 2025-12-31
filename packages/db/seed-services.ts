
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { appointmentServices, tenants } from './src/schema'; // Adjust path as needed
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const url = process.env.DB_URL || 'file:local.db'; // Adjust if needed
    const client = createClient({ url });
    const db = drizzle(client);

    console.log("Seeding Private Yoga...");

    // Find first tenant
    const tenant = await db.select().from(tenants).limit(1).get();
    if (!tenant) {
        console.error("No tenant found to seed service into.");
        return;
    }
    console.log(`Using tenant: ${tenant.slug} (${tenant.id})`);

    // Check if exists
    const existing = await db.select().from(appointmentServices).where(eq(appointmentServices.title, "Private Yoga")).get();
    if (existing) {
        console.log("Private Yoga already exists.");
        return;
    }

    // Insert
    await db.insert(appointmentServices).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        title: "Private Yoga",
        description: "One-on-one personalized instruction",
        durationMinutes: 60,
        price: 80,
        currency: 'usd',
        isActive: true
    });

    console.log("Seeded Private Yoga Service!");
}

main().catch(console.error);
