import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';

export const createDb = (d1: D1Database) => {
    return drizzle(d1, { schema });
};
