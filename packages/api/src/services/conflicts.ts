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
            // Optimized overlap: (startTime + duration) > inputStartTime
            sql`(${classes.startTime} / 1000 + ${classes.durationMinutes} * 60) > ${startTime.getTime() / 1000}`
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
            sql`(${classes.startTime} / 1000 + ${classes.durationMinutes} * 60) > ${startTime.getTime() / 1000}`
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

    /**
     * Batch checks if an instructor has overlapping commitments for multiple proposed classes.
     * Efficiently fetches all required data in a single DB query.
     */
    async checkInstructorConflictBatch(instructorId: string, proposedClasses: { id?: string, startTime: Date, durationMinutes: number }[]) {
        if (proposedClasses.length === 0) return [];

        const minStartTime = new Date(Math.min(...proposedClasses.map(p => p.startTime.getTime())) - 24 * 60 * 60 * 1000); // 24h lookback
        const maxEndTime = new Date(Math.max(...proposedClasses.map(p => p.startTime.getTime() + p.durationMinutes * 60 * 1000)));
        const excludeIds = proposedClasses.map(p => p.id).filter(Boolean) as string[];

        const existingClasses = await this.db.select().from(classes).where(and(
            eq(classes.instructorId, instructorId),
            excludeIds.length > 0 ? sql`${classes.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : undefined,
            eq(classes.status, 'active'),
            lt(classes.startTime, maxEndTime),
            sql`(${classes.startTime} / 1000 + ${classes.durationMinutes} * 60) > ${minStartTime.getTime() / 1000}`
        )).all();

        const existingAppointments = await this.db.select().from(appointments).where(and(
            eq(appointments.instructorId, instructorId),
            excludeIds.length > 0 ? sql`${appointments.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : undefined,
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, maxEndTime),
            gt(appointments.endTime, minStartTime)
        )).all();

        const conflicts: any[] = [];
        for (const proposed of proposedClasses) {
            const proposedStart = proposed.startTime.getTime();
            const proposedEnd = proposedStart + proposed.durationMinutes * 60 * 1000;

            const cConflicts = existingClasses.filter(c => {
                const cStart = c.startTime.getTime();
                const cEnd = cStart + c.durationMinutes * 60 * 1000;
                return cStart < proposedEnd && cEnd > proposedStart;
            });
            const aConflicts = existingAppointments.filter(a => {
                return a.startTime.getTime() < proposedEnd && a.endTime.getTime() > proposedStart;
            });

            if (cConflicts.length > 0 || aConflicts.length > 0) {
                conflicts.push({
                    proposedClass: proposed,
                    conflicts: [
                        ...cConflicts.map(c => ({ conflictEntity: 'class' as const, ...c })),
                        ...aConflicts.map(a => ({ conflictEntity: 'appointment' as const, ...a }))
                    ]
                });
            }
        }
        return conflicts;
    }

    /**
     * Batch checks if a room has overlapping bookings for multiple proposed classes.
     * Efficiently fetches all required data in a single DB query.
     */
    async checkRoomConflictBatch(locationId: string, proposedClasses: { id?: string, startTime: Date, durationMinutes: number }[]) {
        if (proposedClasses.length === 0) return [];

        const minStartTime = new Date(Math.min(...proposedClasses.map(p => p.startTime.getTime())) - 24 * 60 * 60 * 1000);
        const maxEndTime = new Date(Math.max(...proposedClasses.map(p => p.startTime.getTime() + p.durationMinutes * 60 * 1000)));
        const excludeIds = proposedClasses.map(p => p.id).filter(Boolean) as string[];

        const existingClasses = await this.db.select().from(classes).where(and(
            eq(classes.locationId, locationId),
            excludeIds.length > 0 ? sql`${classes.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : undefined,
            eq(classes.status, 'active'),
            lt(classes.startTime, maxEndTime),
            gt(classes.startTime, minStartTime),
            sql`(${classes.startTime} / 1000 + ${classes.durationMinutes} * 60) > ${minStartTime.getTime() / 1000}`
        )).all();

        const existingAppointments = await this.db.select().from(appointments).where(and(
            eq(appointments.locationId, locationId),
            excludeIds.length > 0 ? sql`${appointments.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : undefined,
            eq(appointments.status, 'confirmed'),
            lt(appointments.startTime, maxEndTime),
            gt(appointments.endTime, minStartTime)
        )).all();

        const conflicts: any[] = [];
        for (const proposed of proposedClasses) {
            const proposedStart = proposed.startTime.getTime();
            const proposedEnd = proposedStart + proposed.durationMinutes * 60 * 1000;

            const cConflicts = existingClasses.filter(c => {
                const cStart = c.startTime.getTime();
                const cEnd = cStart + c.durationMinutes * 60 * 1000;
                return cStart < proposedEnd && cEnd > proposedStart;
            });
            const aConflicts = existingAppointments.filter(a => {
                return a.startTime.getTime() < proposedEnd && a.endTime.getTime() > proposedStart;
            });

            if (cConflicts.length > 0 || aConflicts.length > 0) {
                conflicts.push({
                    proposedClass: proposed,
                    conflicts: [
                        ...cConflicts.map(c => ({ conflictEntity: 'class' as const, ...c })),
                        ...aConflicts.map(a => ({ conflictEntity: 'appointment' as const, ...a }))
                    ]
                });
            }
        }
        return conflicts;
    }
}
