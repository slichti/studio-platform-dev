import { describe, it, expect } from 'vitest';
import { PdfService } from './pdf';

describe('PdfService', () => {
    const service = new PdfService('Test Studio', { primaryColor: '#2563EB' });

    it('should generate a PDF for revenue report', async () => {
        const data = {
            grossVolume: 100000,
            mrr: 50000,
            breakdown: {
                retail: 20000,
                packs: 30000,
                renewals: 50000
            }
        };
        const buffer = await service.generateReportPdf('revenue', data, { start: '2024-01-01', end: '2024-01-07' });
        expect(buffer).toBeDefined();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should generate a PDF for attendance report', async () => {
        const data = {
            totalBookings: 100,
            totalCheckins: 85,
            topClasses: [
                { title: 'Yoga Flow', attendees: 50 },
                { title: 'HIIT Blast', attendees: 35 }
            ]
        };
        const buffer = await service.generateReportPdf('attendance', data, { start: '2024-01-01', end: '2024-01-07' });
        expect(buffer).toBeDefined();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should generate a PDF for journal report', async () => {
        const data = [
            { date: '2024-01-01', description: 'Sale 1', account: 'Revenue', debit: 0, credit: 100 },
            { date: '2024-01-01', description: 'Payment 1', account: 'Assets', debit: 100, credit: 0 }
        ];
        const buffer = await service.generateReportPdf('journal', data, { start: '2024-01-01', end: '2024-01-07' });
        expect(buffer).toBeDefined();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });
});
