import { Context, Next } from 'hono';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';

type ValidationTarget = 'json' | 'form' | 'query' | 'param';

export const zValidator = <T extends z.ZodType<any, any>>(
    target: ValidationTarget,
    schema: T
) => {
    return async (c: Context, next: Next) => {
        let value;

        try {
            switch (target) {
                case 'json':
                    value = await c.req.json();
                    break;
                case 'form':
                    value = await c.req.parseBody();
                    break;
                case 'query':
                    value = c.req.query();
                    break;
                case 'param':
                    value = c.req.param();
                    break;
            }

            const result = schema.safeParse(value);

            if (!result.success) {
                const validationError = fromError(result.error);
                return c.json(
                    {
                        success: false,
                        error: 'Validation Error',
                        details: validationError.toString(),
                        issues: result.error.issues
                    },
                    400
                );
            }

            // Store validated data in context for use in handler
            c.set(`validated_${target}`, result.data);

            await next();
        } catch (e) {
            console.error("Validation Middleware Error:", e);
            if (e instanceof SyntaxError) {
                return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
            }
            return c.json({ success: false, error: 'Internal Server Error during validation' }, 500);
        }
    };
};
