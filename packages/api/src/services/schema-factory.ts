
export class SchemaFactory {
    static generateLocalBusiness(tenant: any) {
        const seoConfig = tenant.seoConfig || {};
        const schemaType = seoConfig.defaultSchemaType || 'ExerciseGym';

        const schema: any = {
            "@context": "https://schema.org",
            "@type": schemaType,
            "name": tenant.name,
            "url": `https://studio-platform.com/studios/${tenant.slug}`,
            "logo": tenant.branding?.logoUrl || undefined,
            "address": tenant.branding?.physicalAddress ? {
                "@type": "PostalAddress",
                "streetAddress": tenant.branding.physicalAddress.street,
                "addressLocality": tenant.branding.physicalAddress.city,
                "addressRegion": tenant.branding.physicalAddress.state,
                "postalCode": tenant.branding.physicalAddress.zip,
                "addressCountry": "US"
            } : undefined,
            "telephone": tenant.branding?.phone || undefined
        };

        return schema;
    }

    static generateEvent(cls: any, tenant: any) {
        const schema: any = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": cls.title,
            "startDate": cls.startTime,
            "location": {
                "@type": "Place",
                "name": tenant.name,
                "address": tenant.branding?.physicalAddress ? {
                    "@type": "PostalAddress",
                    "streetAddress": tenant.branding.physicalAddress.street,
                    "addressLocality": tenant.branding.physicalAddress.city,
                    "addressRegion": tenant.branding.physicalAddress.state,
                    "postalCode": tenant.branding.physicalAddress.zip,
                    "addressCountry": "US"
                } : undefined
            },
            "description": cls.description || `Fitness class hosted by ${tenant.name}`,
            "organizer": {
                "@type": "Organization",
                "name": tenant.name,
                "url": `https://studio-platform.com/studios/${tenant.slug}`
            }
        };

        return schema;
    }

    static generateVideoObject(video: any, tenant: any) {
        return {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": video.title,
            "description": video.description,
            "thumbnailUrl": video.thumbnailUrl,
            "uploadDate": video.createdAt,
            "duration": video.duration,
            "contentUrl": video.url,
            "publisher": {
                "@type": "Organization",
                "name": tenant.name,
                "logo": {
                    "@type": "ImageObject",
                    "url": tenant.branding?.logoUrl
                }
            }
        };
    }
}
