// This file is auto-generated by @hey-api/openapi-ts

import * as v from 'valibot';

export const vFoo = v.object({
    foo: v.optional(v.pipe(v.union([
        v.number(),
        v.string(),
        v.bigint()
    ]), v.transform(x => BigInt(x)), v.minValue(BigInt('-9223372036854775808'), 'Invalid value: Expected int64 to be >= -2^63'), v.maxValue(BigInt('9223372036854775807'), 'Invalid value: Expected int64 to be <= 2^63-1'), v.minValue(BigInt(0)), v.maxValue(BigInt(100))))
});