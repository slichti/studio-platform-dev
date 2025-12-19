import { Hono } from 'hono';

const app = new Hono();

app.post('/', (c) => {
    return c.text('Create Studio');
});

app.get('/:id', (c) => {
    const id = c.req.param('id');
    return c.text(`Get Studio ${id}`);
});

export default app;
