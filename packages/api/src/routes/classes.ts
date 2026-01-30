import { Hono } from 'hono';
import type { HonoContext } from '../types';

// Sub-routers
import schedulesRouter from './classes.schedules';
import bookingsRouter from './classes.bookings';
import managementRouter from './classes.management';

const app = new Hono<HonoContext>();

// Mount Sub-routers
app.route('/', schedulesRouter); // Handles core CRUD: /, /:id, POST /, PATCH /:id, DELETE /:id
app.route('/', bookingsRouter);  // Handles: /:id/book, /:id/bookings, /:id/waitlist, etc.
app.route('/', managementRouter); // Handles recordings: /:id/recording

export default app;
