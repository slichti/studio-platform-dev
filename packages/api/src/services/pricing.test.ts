import { describe, it, expect } from 'vitest';
import { PricingService, TIERS } from '../../src/services/pricing';

describe('PricingService (Business Logic)', () => {
    describe('getTierConfig', () => {
        it('should return basic config by default', () => {
            const config = PricingService.getTierConfig('unknown');
            expect(config.name).toBe('Launch');
            expect(config.price).toBe(0);
        });

        it('should return growth config', () => {
            const config = PricingService.getTierConfig('growth');
            expect(config.name).toBe('Growth');
            expect(config.price).toBe(4900);
            expect(config.limits.instructors).toBe(15);
        });

        it('should return scale config', () => {
            const config = PricingService.getTierConfig('scale');
            expect(config.name).toBe('Scale');
            expect(config.features).toContain('white_label');
        });
    });

    describe('isFeatureEnabled', () => {
        it('should identify enabled features', () => {
            expect(PricingService.isFeatureEnabled('scale', 'white_label')).toBe(true);
            expect(PricingService.isFeatureEnabled('growth', 'zoom')).toBe(true);
        });

        it('should identify disabled features', () => {
            expect(PricingService.isFeatureEnabled('basic', 'zoom')).toBe(false);
            expect(PricingService.isFeatureEnabled('growth', 'white_label')).toBe(false);
        });
    });
});
