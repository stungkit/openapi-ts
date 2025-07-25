// This file is auto-generated by @hey-api/openapi-ts

import { z } from 'zod/v3';

export const zBar: z.AnyZodObject = z.object({
    bar: z.union([
        z.array(z.lazy(() => {
            return zBar;
        })),
        z.null()
    ])
});

export const zFoo: z.AnyZodObject = z.object({
    foo: zBar
});