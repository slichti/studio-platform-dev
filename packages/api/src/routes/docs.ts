import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import tagsRoutes from './tags';
import customFieldRoutes from './custom-fields';

const app = new OpenAPIHono();

// Mount the OpenAPI-enabled routes
// Note: We mount them here appropriately so they are included in the doc generation
app.route('/tags', tagsRoutes);
app.route('/custom-fields', customFieldRoutes);

// Helper route to redirect to UI
app.get('/', (c) => c.redirect('/docs/ui'));

// The OpenAPI specification JSON
app.doc('/specification', {
    openapi: '3.0.0',
    info: {
        version: '1.0.0',
        title: 'Studio Platform API',
        description: 'API Documentation for Studio Platform',
    },
});

// Swagger UI
app.get('/ui', swaggerUI({ url: '/docs/specification' }));

export default app;
