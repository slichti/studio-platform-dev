import { Hono } from 'hono';

const app = new Hono();

app.post('/', (c) => {
    return c.text('Create Location');
});

app.get('/', (c) => {
    return c.text('List Locations');
});

export default app;
