// This file is auto-generated by @hey-api/openapi-ts

import { z } from 'zod/v4';

export const zFoo = z.object({
    foo: z.optional(z.coerce.bigint().gte(BigInt(0)).lte(BigInt(100)))
});