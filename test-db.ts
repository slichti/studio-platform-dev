import { createDb } from './packages/db/src';
import { classes } from './packages/db/src/schema';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

const sqlite = new Database('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite'); // Need to find the correct local db path, or just use wrangler d1 execute
