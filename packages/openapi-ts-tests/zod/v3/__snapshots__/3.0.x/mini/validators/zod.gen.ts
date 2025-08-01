// This file is auto-generated by @hey-api/openapi-ts

import * as z from 'zod/v4-mini';

export const zBar = z.object({
    get foo(): z.ZodMiniOptional {
        return z.optional(zFoo);
    }
});

export const zFoo = z._default(z.union([
    z.object({
        foo: z.optional(z.string().check(z.regex(/^\d{3}-\d{2}-\d{4}$/))),
        bar: z.optional(zBar),
        get baz(): z.ZodMiniOptional {
            return z.optional(z.array(z.lazy((): any => {
                return zFoo;
            })));
        },
        qux: z._default(z.optional(z.int().check(z.gt(0))), 0)
    }),
    z.null()
]), null);

export const zBaz = z._default(z.readonly(z.string().check(z.regex(/foo\nbar/))), 'baz');