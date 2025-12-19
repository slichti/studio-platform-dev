import { drizzle } from 'drizzle-orm/d1';
import * as schema from 'db/src/schema'; // We will adjust package.json/exports to allow this import or just import from relative path if we want to bundle.

// Since 'db' is in the workspace, we should import it properly.
// For now, let's assume we can import from the package. 
// If 'db' package.json doesn't export schema, we might need to fix it.
// Let's check 'packages/db/package.json' again. It has "main": "src/index.ts".
// We need to make sure src/index.ts exports schema.

export const createDb = (d1: D1Database) => {
    return drizzle(d1, { schema });
};
