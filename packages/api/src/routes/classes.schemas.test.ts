import { describe, it, expect } from 'vitest';
import { CreateClassSchema } from './classes.schedules';
import { BulkCreateSchema } from './classes.bulk';

describe('Classes request schemas', () => {
    it('accepts null gradient fields for create class', () => {
        const parsed = CreateClassSchema.safeParse({
            title: 'Test',
            startTime: new Date().toISOString(),
            durationMinutes: 60,
            type: 'class',
            gradientPreset: null,
            gradientColor1: null,
            gradientColor2: null,
            gradientDirection: null
        });
        expect(parsed.success).toBe(true);
    });

    it('rejects multiple instructors for regular class', () => {
        const parsed = CreateClassSchema.safeParse({
            title: 'Test',
            startTime: new Date().toISOString(),
            durationMinutes: 60,
            type: 'class',
            instructorIds: ['i1', 'i2'],
        });
        expect(parsed.success).toBe(false);
    });

    it('allows multiple instructors for events', () => {
        const parsed = CreateClassSchema.safeParse({
            title: 'Test',
            startTime: new Date().toISOString(),
            durationMinutes: 60,
            type: 'event',
            instructorIds: ['i1', 'i2'],
        });
        expect(parsed.success).toBe(true);
    });

    it('bulk-create schema enforces same instructor cardinality rule', () => {
        const ok = BulkCreateSchema.safeParse({
            title: 'Bulk',
            durationMinutes: 60,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            daysOfWeek: [1],
            startTime: '09:00',
            type: 'event',
            instructorIds: ['i1', 'i2'],
        });
        expect(ok.success).toBe(true);

        const bad = BulkCreateSchema.safeParse({
            title: 'Bulk',
            durationMinutes: 60,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            daysOfWeek: [1],
            startTime: '09:00',
            type: 'class',
            instructorIds: ['i1', 'i2'],
        });
        expect(bad.success).toBe(false);
    });
});

