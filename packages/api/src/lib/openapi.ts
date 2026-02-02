import { OpenAPIHono, z } from '@hono/zod-openapi';
import { Bindings, Variables } from '../types';

/**
 * Standard Error Response Schema
 * Used for 4xx and 5xx responses.
 */
export const ErrorResponseSchema = z.object({
    error: z.string().openapi({ description: 'Error message' }),
    code: z.string().optional().openapi({ description: 'Error code' }),
    requestId: z.string().optional().openapi({ description: 'Request ID for tracing' }),
}).openapi('ErrorResponse');

/**
 * Standard Success Response Schema
 * Used for simple success confirmations (e.g. DELETE, PATCH).
 */
export const SuccessResponseSchema = z.object({
    success: z.boolean().openapi({ description: 'Operation success status' }),
}).openapi('SuccessResponse');

/**
 * Pagination Query Parameters Schema
 * Reusable for list endpoints.
 */
export const PaginationQuerySchema = z.object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    cursor: z.string().optional(),
});

/**
 * Standard Form Validation Error Schema
 * Used for 422 Unprocessable Entity responses.
 */
export const ValidationErrorSchema = z.object({
    error: z.string(),
    issues: z.array(z.object({
        code: z.string(),
        path: z.array(z.string().or(z.number())),
        message: z.string(),
    })),
}).openapi('ValidationError');

export function createOpenAPIApp<V extends Variables = Variables>() {
    return new OpenAPIHono<{ Bindings: Bindings, Variables: V }>();
}
