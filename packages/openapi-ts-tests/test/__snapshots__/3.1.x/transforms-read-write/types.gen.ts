// This file is auto-generated by @hey-api/openapi-ts

export type FooReadWrite = BarRead;

export type FooRead = BarRead & {
    readonly foo?: string;
};

export type FooWrite = BarWrite;

export type BarRead = Baz | QuxAllRead | {
    readonly bar?: string;
};

export type BarWrite = Baz | QuxAllRead;

export type Baz = {
    baz?: string;
};

export type QuxAllWrite = {
    baz?: string;
};

export type QuxAllRead = {
    readonly baz?: string;
};

export type Quux = {
    baz?: Array<Baz>;
    qux?: QuxAllRead;
};

export type Corge = {
    bar?: {
        readonly baz?: boolean;
    };
};

export type FooReadWriteRef = {
    foo?: FooReadWrite;
    bar?: FooReadWriteRef;
};

export type FooReadWriteRef2 = FooReadWrite;

export type FooReadWriteWritable = BarReadWritable & {
    foo?: string;
};

export type FooReadWritable = BarReadWritable;

export type FooWriteWritable = BarWriteWritable & {
    foo?: string;
};

export type BarReadWritable = Baz | QuxAllWrite;

export type BarWriteWritable = Baz | QuxAllWrite | {
    bar?: string;
};

export type CorgeWritable = {
    foo?: {
        baz?: boolean;
    };
};

export type FooReadWriteRefWritable = {
    foo?: FooReadWriteWritable;
    bar?: FooReadWriteRefWritable;
};

export type FooReadWriteRef2Writable = FooReadWriteWritable;

/**
 * Query parameter
 */
export type Foo = string;

/**
 * PUT /foo-write payload
 */
export type Foo2 = {
    foo?: BarReadWritable;
};

export type PostFooReadWriteData = {
    body: FooReadWriteWritable;
    path?: never;
    query?: never;
    url: '/foo-read-write';
};

export type PostFooReadWriteResponses = {
    /**
     * OK
     */
    200: FooReadWrite;
};

export type PostFooReadWriteResponse = PostFooReadWriteResponses[keyof PostFooReadWriteResponses];

export type PostFooReadData = {
    body: FooReadWritable;
    path?: never;
    query?: never;
    url: '/foo-read';
};

export type PostFooReadResponses = {
    /**
     * OK
     */
    200: FooRead;
};

export type PostFooReadResponse = PostFooReadResponses[keyof PostFooReadResponses];

export type PostFooWriteData = {
    body: FooWriteWritable;
    path?: never;
    query?: never;
    url: '/foo-write';
};

export type PostFooWriteResponses = {
    /**
     * OK
     */
    200: FooWrite;
};

export type PostFooWriteResponse = PostFooWriteResponses[keyof PostFooWriteResponses];

export type PutFooWriteData = {
    /**
     * PUT /foo-write payload
     */
    body: Foo2;
    path?: never;
    query?: {
        /**
         * Query parameter
         */
        foo?: string;
    };
    url: '/foo-write';
};

export type PutFooWriteResponses = {
    /**
     * OK
     */
    200: FooWrite;
};

export type PutFooWriteResponse = PutFooWriteResponses[keyof PutFooWriteResponses];

export type ClientOptions = {
    baseUrl: `${string}://${string}` | (string & {});
};