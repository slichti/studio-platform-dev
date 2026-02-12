import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';

// Sub-routers
import schedulesRouter from './classes.schedules';
import bookingsRouter from './classes.bookings';
import managementRouter from './classes.management';
import bulkRouter from './classes.bulk';

const app = createOpenAPIApp<StudioVariables>();

// Mount Sub-routers
app.route('/', schedulesRouter); // Handles core CRUD: /, /:id, POST /, PATCH /:id, DELETE /:id
app.route('/', bookingsRouter);  // Handles: /:id/book, /:id/bookings, /:id/waitlist, etc.
app.route('/', managementRouter); // Handles recordings: /:id/recording
app.route('/', bulkRouter);      // Handles bulk operations: /bulk-cancel, /bulk-update

export default app;
