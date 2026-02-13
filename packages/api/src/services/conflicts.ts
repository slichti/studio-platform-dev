import { createDb } from '../db';
import { classes, appointments } from '@studio/db/src/schema';
import { and, eq, sql, ne, lt, gt } from 'drizzle-orm';

export class ConflictService {
    constructor(private db: ReturnType<typeof createDb>) { }

    /**
     * Checks if an instructor has overlapping commitments.
     */
    async checkInstructorConflict(instructorId: string, startTime: Date, durationMinutes: number, excludeEventId?: string) {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const earliestStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000); // 24h look-back for safety

        const actualConflicts = await this.db.select().from(classes).where(and(
            eq(classes.instructorId, instructorId),
            excludeEventId ? ne(classes.id, excludeEventId) : undefined,
            eq(classes.status, 'active'),
            lt(classes.startTime, endTime),
            sql`datetime(${classes.startTime} / 1000, 'unixepoch', '+' || ${classes.durationMinutes} || ' minutes') > datetime(${startTime.getTime() / 1000}, 'unixepoch')`
        )).all();

        const actualAppConflicts = await this.db.select().from(appointments).where(and(
            eq(appointments.instructorId, instructorId),
            excludeEventId ? ne(appointments.id, excludeEventId) : undefined,
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, endTime),
            gt(appointments.endTime, startTime)
        )).all();

        return [
            ...actualConflicts.map((c: any) => ({ conflictEntity: 'class' as const, ...c })),
            ...actualAppConflicts.map((a: any) => ({ conflictEntity: 'appointment' as const, ...a }))
        ];
    }

    /**
     * Checks if a location has overlapping bookings.
     */
    async checkRoomConflict(locationId: string, startTime: Date, durationMinutes: number, excludeEventId?: string) {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const earliestStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);

        const classConflicts = await this.db.select().from(classes).where(and(
            eq(classes.locationId, locationId),
            excludeEventId ? ne(classes.id, excludeEventId) : undefined,
            eq(classes.status, 'active'),
            // Indexed filters first
            lt(classes.startTime, endTime),
            gt(classes.startTime, earliestStart),
            // Precise overlap logic
            sql`datetime(${classes.startTime} / 1000, 'unixepoch', '+' || ${classes.durationMinutes} || ' minutes') > datetime(${startTime.getTime() / 1000}, 'unixepoch')`
        )).all();

        const appointmentConflicts = await this.db.select().from(appointments).where(and(
            eq(appointments.locationId, locationId),
            excludeEventId ? ne(appointments.id, excludeEventId) : undefined,
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, endTime),
            gt(appointments.endTime, startTime)
        )).all();

        return [
            ...classConflicts.map(c => ({ conflictEntity: 'class' as const, ...c })),
            ...appointmentConflicts.map(a => ({ conflictEntity: 'appointment' as const, ...a }))
        ];
    }
}
