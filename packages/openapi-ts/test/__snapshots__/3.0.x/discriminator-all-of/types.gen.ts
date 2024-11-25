// This file is auto-generated by @hey-api/openapi-ts

export type Foo = {
    id: string;
};

export type Bar = Foo & {
    id?: 'Bar';
} & {
    bar?: string;
};

export type Baz = Foo & {
    id?: 'Baz';
} & {
    baz?: string;
};

export type Qux = Foo & {
    id?: 'Qux';
} & {
    qux?: boolean;
};

export type FooMapped = {
    id: string;
};

export type BarMapped = FooMapped & {
    id?: 'bar';
} & {
    bar?: string;
};

export type BazMapped = FooMapped & {
    id?: 'baz';
} & {
    baz?: string;
};

export type QuxMapped = FooMapped & {
    id?: 'QuxMapped';
} & {
    qux?: boolean;
};