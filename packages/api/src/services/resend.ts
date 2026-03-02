import { Resend } from 'resend';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@studio/db';
import { tenants } from '@studio/db';
import { eq } from 'drizzle-orm';

export class ResendManagementService {
    private resend: Resend;
    private db: DrizzleD1Database<typeof schema>;

    constructor(apiKey: string, db: DrizzleD1Database<typeof schema>) {
        this.resend = new Resend(apiKey);
        this.db = db;
    }

    async setupTenantDomain(tenantId: string, domainName: string) {
        // Create domain in Resend
        const response = await this.resend.domains.create({ name: domainName });

        if (response.error) {
            throw new Error(`Failed to create domain: ${response.error.message}`);
        }

        const domain = response.data;

        // Update tenant in DB
        await this.db.update(tenants).set({
            resendDomainId: domain?.id,
            resendDomainStatus: domain?.status,
            resendDomainRecords: JSON.stringify(domain?.records)
        }).where(eq(tenants.id, tenantId));

        return domain;
    }

    async verifyTenantDomain(tenantId: string) {
        // Get tenant
        const tenant = await this.db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });

        if (!tenant?.resendDomainId) {
            throw new Error('Tenant has no Resend domain setup');
        }

        // Check domain status
        const domainResponse = await this.resend.domains.get(tenant.resendDomainId);
        if (domainResponse.error) {
            throw new Error(`Failed to get domain: ${domainResponse.error.message}`);
        }

        let status = domainResponse.data?.status;

        // If not verified, try to verify
        if (status !== 'verified') {
            const verifyResponse = await this.resend.domains.verify(tenant.resendDomainId);
            if (!verifyResponse.error) {
                // Fetch again to get updated status
                const updatedDomain = await this.resend.domains.get(tenant.resendDomainId);
                status = updatedDomain.data?.status || status;
            }
        }

        const updates: Partial<typeof tenants.$inferInsert> = {
            resendDomainStatus: status
        };

        // If verified and no API key exists, create one
        if (status === 'verified' && !tenant.resendApiKeyId) {
            // Provide explicit typing or simply use the object
            const opts: any = {
                name: `tenant_${tenantId}_key`,
                permission: 'sending_access',
                domain_id: tenant.resendDomainId
            };
            const apiKeyResponse = await this.resend.apiKeys.create(opts);

            if (apiKeyResponse.error) {
                throw new Error(`Failed to create API key: ${apiKeyResponse.error.message}`);
            }

            updates.resendApiKeyId = apiKeyResponse.data?.id;
            updates.resendApiKey = apiKeyResponse.data?.token;

            // Create newsletter segment/audience
            const audienceResponse = await this.resend.audiences.create({
                name: `${tenant.name} Newsletter`
            });

            if (!audienceResponse.error) {
                updates.resendNewsletterSegmentId = audienceResponse.data?.id;
            }
        }

        // Update DB
        if (Object.keys(updates).length > 0) {
            await this.db.update(tenants).set(updates).where(eq(tenants.id, tenantId));
        }

        return updates;
    }

    async revokeTenantAccess(tenantId: string) {
        const tenant = await this.db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });

        if (!tenant) return;

        // Delete API Key
        if (tenant.resendApiKeyId) {
            await this.resend.apiKeys.remove(tenant.resendApiKeyId);
        }

        // Delete Domain
        if (tenant.resendDomainId) {
            await this.resend.domains.remove(tenant.resendDomainId);
        }

        // Delete Audience
        if (tenant.resendNewsletterSegmentId) {
            await this.resend.audiences.remove(tenant.resendNewsletterSegmentId);
        }

        // Clear DB fields
        await this.db.update(tenants).set({
            resendDomainId: null,
            resendDomainStatus: null,
            resendDomainRecords: null,
            resendApiKeyId: null,
            resendApiKey: null,
            resendNewsletterSegmentId: null
        }).where(eq(tenants.id, tenantId));
    }

    async sendBroadcast(tenantId: string, subject: string, htmlContent: string, fromEmail: string) {
        const tenant = await this.db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });

        if (!tenant || !tenant.resendApiKey || !tenant.resendNewsletterSegmentId) {
            throw new Error('Tenant is not configured for broadcasting');
        }

        // Use the tenant-specific API key for sending
        const tenantResend = new Resend(tenant.resendApiKey);

        const response = await tenantResend.emails.send({
            from: fromEmail, // Must be from the verified domain
            to: tenant.resendNewsletterSegmentId, // Send to the audience ID
            subject: subject,
            html: htmlContent
        });

        if (response.error) {
            throw new Error(`Broadcast failed: ${response.error.message}`);
        }

        return response.data;
    }

    async addContactToAudience(tenantId: string, email: string) {
        const tenant = await this.db.query.tenants.findFirst({
            where: eq(tenants.id, tenantId)
        });

        if (!tenant || !tenant.resendNewsletterSegmentId) {
            throw new Error('Tenant is not configured for newsletters');
        }

        const response = await this.resend.contacts.create({
            email,
            audienceId: tenant.resendNewsletterSegmentId,
            unsubscribed: false
        });

        if (response.error) {
            throw new Error(`Failed to add contact: ${response.error.message}`);
        }

        return response.data;
    }
}
