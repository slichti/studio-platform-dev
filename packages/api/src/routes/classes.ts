import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
    return c.text('List Classes');
});

app.post('/', (c) => {
    return c.text('Create Class');
});

app.post('/:id/book', (c) => {
    const id = c.req.param('id');
    return c.text(`Book Class ${id}`);
});

export default app;
