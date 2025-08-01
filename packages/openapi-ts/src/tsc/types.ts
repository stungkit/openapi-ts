import ts from 'typescript';

import { escapeName } from '../utils/escape';
import { validTypescriptIdentifierRegExp } from '../utils/regexp';
import {
  addLeadingComments,
  type Comments,
  createIdentifier,
  createModifier,
  isTsNode,
  isType,
  ots,
} from './utils';

export type AccessLevel = 'private' | 'protected' | 'public';

export type FunctionParameter =
  | {
      accessLevel?: AccessLevel;
      default?: any;
      isReadOnly?: boolean;
      isRequired?: boolean;
      name: string;
      type?: any | ts.TypeNode;
    }
  | {
      destructure: ReadonlyArray<FunctionParameter>;
      type?: any | ts.TypeNode;
    };

export interface FunctionTypeParameter {
  default?: any;
  extends?: string | ts.TypeNode;
  name: string | ts.Identifier;
}

export const createTypeNode = (
  base: any | ts.TypeNode,
  args?: (any | ts.TypeNode)[],
): ts.TypeNode => {
  if (ts.isTypeNode(base)) {
    return base;
  }

  if (typeof base === 'number') {
    return ts.factory.createLiteralTypeNode(ots.number(base));
  }

  return createTypeReferenceNode({
    typeArguments: args?.map((arg) => createTypeNode(arg)),
    typeName: ts.isIdentifier(base) ? base.text : base,
  });
};

export const createPropertyAccessChain = ({
  expression,
  name,
}: {
  expression: ts.Expression;
  name: string | ts.MemberName;
}) => {
  const node = ts.factory.createPropertyAccessChain(
    expression,
    ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
    name,
  );
  return node;
};

export const createPropertyAccessExpression = ({
  expression,
  isOptional,
  name,
}: {
  expression: string | ts.Expression;
  isOptional?: boolean;
  name: string | number | ts.MemberName;
}):
  | ts.PropertyAccessChain
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression => {
  const nodeExpression =
    typeof expression === 'string'
      ? createIdentifier({ text: expression })
      : expression;

  if (isOptional && typeof name !== 'number') {
    return createPropertyAccessChain({
      expression: nodeExpression,
      name,
    });
  }

  if (typeof name === 'string') {
    validTypescriptIdentifierRegExp.lastIndex = 0;
    if (!validTypescriptIdentifierRegExp.test(name)) {
      // TODO: parser - this should escape name only for new parser
      if (!name.startsWith("'") && !name.endsWith("'")) {
        // eslint-disable-next-line no-useless-escape
        name = `\'${name}\'`;
      }
      const nodeName = createIdentifier({ text: name });
      return ts.factory.createElementAccessExpression(nodeExpression, nodeName);
    }

    const nodeName = createIdentifier({ text: name });
    return ts.factory.createPropertyAccessExpression(nodeExpression, nodeName);
  }

  if (typeof name === 'number') {
    const nodeName = ts.factory.createNumericLiteral(name);
    return ts.factory.createElementAccessExpression(nodeExpression, nodeName);
  }

  return ts.factory.createPropertyAccessExpression(nodeExpression, name);
};

export const createNull = (): ts.NullLiteral => ts.factory.createNull();

/**
 * Convert an unknown value to an expression.
 * @param identifiers - list of keys that are treated as identifiers.
 * @param shorthand - if shorthand syntax is allowed.
 * @param unescape - if string should be unescaped.
 * @param value - the unknown value.
 * @returns ts.Expression
 */
export const toExpression = <T = unknown>({
  identifiers = [],
  isValueAccess,
  shorthand,
  unescape,
  value,
}: {
  identifiers?: string[];
  isValueAccess?: boolean;
  shorthand?: boolean;
  unescape?: boolean;
  value: T;
}): ts.Expression | undefined => {
  if (value === null) {
    return createNull();
  }

  if (Array.isArray(value)) {
    return createArrayLiteralExpression({ elements: value });
  }

  if (typeof value === 'object') {
    return createObjectType({
      identifiers,
      obj: value,
      shorthand,
    });
  }

  if (typeof value === 'number') {
    return ots.number(value);
  }

  if (typeof value === 'boolean') {
    return ots.boolean(value);
  }

  if (typeof value === 'string') {
    if (isValueAccess) {
      // TODO; handle more than single nested level, i.e. foo.bar.baz
      const parts = value.split('.');
      return createPropertyAccessExpression({
        expression: parts[0]!,
        name: parts[1]!,
      });
    }
    return ots.string(value, unescape);
  }

  return;
};

/**
 * Convert parameters to the declaration array expected by TypeScript
 * Compiler API.
 * @param parameters - the parameters to convert to declarations
 * @returns ts.ParameterDeclaration[]
 */
export const toParameterDeclarations = (
  parameters: ReadonlyArray<FunctionParameter>,
) =>
  parameters.map((parameter) => {
    if ('destructure' in parameter) {
      return createParameterDeclaration({
        name: ts.factory.createObjectBindingPattern(
          parameter.destructure
            .map((param) => {
              // TODO: add support for nested destructuring, not needed at the moment
              if ('destructure' in param) {
                return;
              }

              const result = ts.factory.createBindingElement(
                undefined,
                undefined,
                createIdentifier({ text: param.name }),
                undefined,
              );
              return result;
            })
            .filter(Boolean) as ts.BindingElement[],
        ),
        type:
          parameter.type !== undefined
            ? createTypeNode(parameter.type)
            : undefined,
      });
    }

    const modifiers = parameter.accessLevel
      ? [createModifier({ keyword: parameter.accessLevel })]
      : [];

    if (parameter.isReadOnly) {
      modifiers.push(createModifier({ keyword: 'readonly' }));
    }

    return createParameterDeclaration({
      initializer:
        parameter.default !== undefined
          ? toExpression({ value: parameter.default })
          : undefined,
      modifiers,
      name: createIdentifier({ text: parameter.name }),
      required: parameter.isRequired !== false,
      type:
        parameter.type !== undefined
          ? createTypeNode(parameter.type)
          : undefined,
    });
  });

export type SyntaxKindKeyword =
  | 'any'
  | 'async'
  | 'boolean'
  | 'export'
  | 'never'
  | 'number'
  | 'private'
  | 'protected'
  | 'public'
  | 'readonly'
  | 'static'
  | 'string'
  | 'undefined'
  | 'unknown'
  | 'void';

export const syntaxKindKeyword = <T extends SyntaxKindKeyword>({
  keyword,
}: {
  keyword: T;
}): T extends 'protected'
  ? ts.SyntaxKind.ProtectedKeyword
  : T extends 'public'
    ? ts.SyntaxKind.PublicKeyword
    : T extends 'private'
      ? ts.SyntaxKind.PrivateKeyword
      : T extends 'export'
        ? ts.SyntaxKind.ExportKeyword
        : T extends 'async'
          ? ts.SyntaxKind.ExportKeyword
          : T extends 'readonly'
            ? ts.SyntaxKind.ExportKeyword
            : T extends 'static'
              ? ts.SyntaxKind.ExportKeyword
              :
                  | ts.SyntaxKind.AnyKeyword
                  | ts.SyntaxKind.BooleanKeyword
                  | ts.SyntaxKind.NeverKeyword
                  | ts.SyntaxKind.NumberKeyword
                  | ts.SyntaxKind.StringKeyword
                  | ts.SyntaxKind.UndefinedKeyword
                  | ts.SyntaxKind.UnknownKeyword
                  | ts.SyntaxKind.VoidKeyword => {
  switch (keyword) {
    case 'any':
      return ts.SyntaxKind.AnyKeyword as any;
    case 'async':
      return ts.SyntaxKind.AsyncKeyword as any;
    case 'boolean':
      return ts.SyntaxKind.BooleanKeyword as any;
    case 'export':
      return ts.SyntaxKind.ExportKeyword as any;
    case 'never':
      return ts.SyntaxKind.NeverKeyword as any;
    case 'number':
      return ts.SyntaxKind.NumberKeyword as any;
    case 'private':
      return ts.SyntaxKind.PrivateKeyword as any;
    case 'protected':
      return ts.SyntaxKind.ProtectedKeyword as any;
    case 'public':
      return ts.SyntaxKind.PublicKeyword as any;
    case 'readonly':
      return ts.SyntaxKind.ReadonlyKeyword as any;
    case 'static':
      return ts.SyntaxKind.StaticKeyword as any;
    case 'string':
      return ts.SyntaxKind.StringKeyword as any;
    case 'undefined':
      return ts.SyntaxKind.UndefinedKeyword as any;
    case 'unknown':
      return ts.SyntaxKind.UnknownKeyword as any;
    case 'void':
      return ts.SyntaxKind.VoidKeyword as any;
    default:
      throw new Error(`unsupported syntax kind keyword "${keyword}"`);
  }
};

export const createKeywordTypeNode = ({
  keyword,
}: {
  keyword: Extract<
    SyntaxKindKeyword,
    | 'any'
    | 'boolean'
    | 'never'
    | 'number'
    | 'string'
    | 'undefined'
    | 'unknown'
    | 'void'
  >;
}) => {
  const kind = syntaxKindKeyword({ keyword });
  return ts.factory.createKeywordTypeNode(kind);
};

export const toTypeParameters = (
  types: (FunctionTypeParameter | ts.TypeParameterDeclaration)[],
) =>
  types.map((node) => {
    // @ts-expect-error
    if (ts.isTypeParameterDeclaration(node)) {
      return node;
    }

    return createTypeParameterDeclaration({
      // TODO: support other extends values
      constraint: node.extends
        ? typeof node.extends === 'string'
          ? createKeywordTypeNode({ keyword: 'boolean' })
          : node.extends
        : undefined,
      // TODO: support other default types
      defaultType:
        node.default !== undefined
          ? isTsNode(node.default)
            ? (node.default as unknown as ts.TypeNode)
            : ts.factory.createLiteralTypeNode(
                node.default
                  ? ts.factory.createTrue()
                  : ts.factory.createFalse(),
              )
          : undefined,
      name: node.name,
    });
  });

export const createTypeOperatorNode = ({
  operator,
  type,
}: {
  operator: 'keyof' | 'readonly' | 'unique';
  type: ts.TypeNode;
}) => {
  const operatorKeyword =
    operator === 'keyof'
      ? ts.SyntaxKind.KeyOfKeyword
      : operator === 'readonly'
        ? ts.SyntaxKind.ReadonlyKeyword
        : ts.SyntaxKind.UniqueKeyword;
  return ts.factory.createTypeOperatorNode(operatorKeyword, type);
};

export const createTypeParameterDeclaration = ({
  constraint,
  defaultType,
  modifiers,
  name,
}: {
  constraint?: ts.TypeNode;
  defaultType?: ts.TypeNode;
  modifiers?: Array<ts.Modifier>;
  name: string | ts.Identifier;
}) =>
  ts.factory.createTypeParameterDeclaration(
    modifiers,
    name,
    constraint,
    defaultType,
  );

export const createMappedTypeNode = ({
  members,
  nameType,
  questionToken,
  readonlyToken,
  type,
  typeParameter,
}: {
  members?: ts.NodeArray<ts.TypeElement>;
  nameType?: ts.TypeNode;
  questionToken?: ts.QuestionToken | ts.PlusToken | ts.MinusToken;
  readonlyToken?: ts.ReadonlyKeyword | ts.PlusToken | ts.MinusToken;
  type?: ts.TypeNode;
  typeParameter: ts.TypeParameterDeclaration;
}) =>
  ts.factory.createMappedTypeNode(
    readonlyToken,
    typeParameter,
    nameType,
    questionToken,
    type,
    members,
  );

export const createLiteralTypeNode = ({
  literal,
}: {
  literal: ts.LiteralTypeNode['literal'];
}) => {
  const node = ts.factory.createLiteralTypeNode(literal);
  return node;
};

/**
 * Create arrow function type expression.
 */
export const createArrowFunction = ({
  async,
  comment,
  multiLine,
  parameters = [],
  returnType,
  statements = [],
  types = [],
}: {
  async?: boolean;
  comment?: Comments;
  multiLine?: boolean;
  parameters?: ReadonlyArray<FunctionParameter>;
  returnType?: string | ts.TypeNode;
  statements?: ts.Statement[] | ts.Expression;
  types?: FunctionTypeParameter[];
}) => {
  const expression = ts.factory.createArrowFunction(
    async ? [createModifier({ keyword: 'async' })] : undefined,
    types ? toTypeParameters(types) : undefined,
    toParameterDeclarations(parameters),
    returnType ? createTypeNode(returnType) : undefined,
    undefined,
    Array.isArray(statements)
      ? createBlock({ multiLine, statements })
      : statements,
  );

  addLeadingComments({
    comments: comment,
    node: expression,
  });

  return expression;
};

/**
 * Create anonymous function type expression.
 */
export const createAnonymousFunction = ({
  async,
  comment,
  multiLine,
  parameters = [],
  returnType,
  statements = [],
  types = [],
}: {
  async?: boolean;
  comment?: Comments;
  multiLine?: boolean;
  parameters?: FunctionParameter[];
  returnType?: string | ts.TypeNode;
  statements?: ReadonlyArray<ts.Statement>;
  types?: FunctionTypeParameter[];
}) => {
  const expression = ts.factory.createFunctionExpression(
    async ? [createModifier({ keyword: 'async' })] : undefined,
    undefined,
    undefined,
    types ? toTypeParameters(types) : undefined,
    toParameterDeclarations(parameters),
    returnType ? createTypeNode(returnType) : undefined,
    createBlock({ multiLine, statements }),
  );

  addLeadingComments({
    comments: comment,
    node: expression,
  });

  return expression;
};

/**
 * Create Array type expression.
 */
export const createArrayLiteralExpression = <T>({
  elements,
  multiLine = false,
}: {
  /**
   * The array to create.
   */
  elements: T[];
  /**
   * Should the array be multi line?
   *
   * @default false
   */
  multiLine?: boolean;
}): ts.ArrayLiteralExpression => {
  const expression = ts.factory.createArrayLiteralExpression(
    elements
      .map((value) => (isTsNode(value) ? value : toExpression({ value })))
      .filter(isType<ts.Expression>),
    // multiline if array contains objects
    multiLine ||
      (!Array.isArray(elements[0]) && typeof elements[0] === 'object'),
  );
  return expression;
};

export const createAwaitExpression = ({
  expression,
}: {
  expression: ts.Expression;
}) => ts.factory.createAwaitExpression(expression);

export const createFunctionTypeNode = ({
  parameters = [],
  returnType,
  typeParameters,
}: {
  parameters?: ts.ParameterDeclaration[];
  returnType: ts.TypeNode;
  typeParameters?: ts.TypeParameterDeclaration[];
}) => {
  const node = ts.factory.createFunctionTypeNode(
    typeParameters,
    parameters,
    returnType,
  );
  return node;
};

export type ObjectValue =
  | {
      assertion?: 'any' | ts.TypeNode;
      comments?: Comments;
      spread: string;
    }
  | {
      comments?: Comments;
      isValueAccess?: boolean;
      key: string;
      shorthand?: boolean;
      value: any;
    };

type ObjectAssignment =
  | ts.PropertyAssignment
  | ts.ShorthandPropertyAssignment
  | ts.SpreadAssignment;

/**
 * Create Object type expression.
 * @param comments - comments to add to each property.
 * @param identifier - keys that should be treated as identifiers.
 * @param multiLine - if the object should be multiline.
 * @param obj - the object to create expression with.
 * @param shorthand - if shorthand syntax should be used.
 * @param unescape - if properties strings should be unescaped.
 * @returns ts.ObjectLiteralExpression
 */
export const createObjectType = <
  T extends Record<string, any> | Array<ObjectValue>,
>({
  comments,
  identifiers = [],
  multiLine = true,
  obj,
  shorthand,
  unescape = false,
}: {
  comments?: Comments;
  identifiers?: string[];
  multiLine?: boolean;
  obj: T;
  shorthand?: boolean;
  unescape?: boolean;
}): ts.ObjectLiteralExpression => {
  const properties = Array.isArray(obj)
    ? obj
        .map((value: ObjectValue) => {
          // Check key value equality before possibly modifying it
          let canShorthand = false;
          if ('key' in value) {
            const { key } = value;
            canShorthand = key === value.value;
            const firstDigitAndNonDigits =
              key.match(/^[0-9]/) && key.match(/\D+/g);
            if (
              (firstDigitAndNonDigits || key.match(/\W/g) || key === '') &&
              !key.startsWith("'") &&
              !key.endsWith("'")
            ) {
              value.key = `'${key}'`;
            }
          }
          let assignment: ObjectAssignment;
          if ('spread' in value) {
            const nameIdentifier = isTsNode(value.spread)
              ? value.spread
              : createIdentifier({ text: value.spread });
            assignment = ts.factory.createSpreadAssignment(
              value.assertion
                ? createAsExpression({
                    expression: nameIdentifier,
                    type:
                      typeof value.assertion === 'string'
                        ? createKeywordTypeNode({ keyword: value.assertion })
                        : value.assertion,
                  })
                : nameIdentifier,
            );
          } else if (value.shorthand || (shorthand && canShorthand)) {
            assignment = ts.factory.createShorthandPropertyAssignment(
              value.value,
            );
          } else {
            let initializer: ts.Expression | undefined = isTsNode(value.value)
              ? value.value
              : Array.isArray(value.value) &&
                  (!value.value.length || typeof value.value[0] === 'object')
                ? createObjectType({
                    multiLine,
                    obj: value.value,
                    shorthand,
                    unescape,
                  })
                : toExpression({
                    identifiers: identifiers.includes(value.key)
                      ? Object.keys(value.value)
                      : [],
                    isValueAccess: value.isValueAccess,
                    shorthand,
                    unescape,
                    value: value.value,
                  });
            if (!initializer) {
              return;
            }
            // Create a identifier if the current key is one and it is not an object
            if (
              identifiers.includes(value.key) &&
              !ts.isObjectLiteralExpression(initializer)
            ) {
              initializer = createIdentifier({ text: value.value as string });
            }
            assignment = createPropertyAssignment({
              initializer,
              name: value.key,
            });
          }

          addLeadingComments({
            comments: value.comments,
            node: assignment,
          });

          return assignment;
        })
        .filter(isType<ObjectAssignment>)
    : Object.entries(obj)
        .map(([key, value]) => {
          // Pass all object properties as identifiers if the whole object is an identifier
          let initializer: ts.Expression | undefined = toExpression({
            identifiers: identifiers.includes(key) ? Object.keys(value) : [],
            shorthand,
            unescape,
            value,
          });
          if (!initializer) {
            return;
          }
          // Create a identifier if the current key is one and it is not an object
          if (
            identifiers.includes(key) &&
            !ts.isObjectLiteralExpression(initializer)
          ) {
            initializer = createIdentifier({ text: value as string });
          }
          // Check key value equality before possibly modifying it
          const canShorthand = key === value;
          if (
            key.match(/^[0-9]/) &&
            key.match(/\D+/g) &&
            !key.startsWith("'") &&
            !key.endsWith("'")
          ) {
            key = `'${key}'`;
          }
          if (key.match(/\W/g) && !key.startsWith("'") && !key.endsWith("'")) {
            key = `'${key}'`;
          }
          const assignment =
            shorthand && canShorthand
              ? ts.factory.createShorthandPropertyAssignment(value)
              : createPropertyAssignment({ initializer, name: key });

          return assignment;
        })
        .filter(isType<ObjectAssignment>);

  const node = ts.factory.createObjectLiteralExpression(
    properties as any[],
    multiLine,
  );

  addLeadingComments({
    comments,
    node,
  });

  return node;
};

/**
 * Create enum declaration. Example `export enum T = { X, Y };`
 * @param comments - comments to add to each property.
 * @param leadingComment - leading comment to add to enum.
 * @param name - the name of the enum.
 * @param obj - the object representing the enum.
 * @returns ts.EnumDeclaration
 */
export const createEnumDeclaration = <
  T extends Record<string, any> | Array<ObjectValue>,
>({
  comments: enumMemberComments = {},
  leadingComment: comments,
  name,
  obj,
}: {
  comments?: Record<string | number, Comments>;
  leadingComment?: Comments;
  name: string | ts.TypeReferenceNode;
  obj: T;
}): ts.EnumDeclaration => {
  const members: Array<ts.EnumMember> = Array.isArray(obj)
    ? obj.map((value) => {
        const enumMember = createEnumMember({
          initializer: toExpression({
            value: value.value,
          }),
          name: value.key,
        });

        addLeadingComments({
          comments: value.comments,
          node: enumMember,
        });

        return enumMember;
      })
    : // TODO: parser - deprecate object syntax
      Object.entries(obj).map(([key, value]) => {
        const enumMember = ts.factory.createEnumMember(
          key,
          toExpression({
            unescape: true,
            value,
          }),
        );

        addLeadingComments({
          comments: enumMemberComments[key],
          node: enumMember,
        });

        return enumMember;
      });

  const node = ts.factory.createEnumDeclaration(
    [createModifier({ keyword: 'export' })],
    typeof name === 'string'
      ? createIdentifier({ text: name })
      : // TODO: https://github.com/hey-api/openapi-ts/issues/2289
        (name as unknown as ts.Identifier),
    members,
  );

  addLeadingComments({
    comments,
    node,
  });

  return node;
};

const createEnumMember = ({
  initializer,
  name,
}: {
  initializer?: ts.Expression;
  name: string | ts.PropertyName;
}) => {
  let key = name;
  if (typeof key === 'string') {
    if (key.includes("'")) {
      key = createStringLiteral({
        isSingleQuote: false,
        text: key,
      });
    } else {
      key = escapeName(key);
    }
  }
  return ts.factory.createEnumMember(key, initializer);
};

/**
 * Create namespace declaration. Example `export namespace MyNamespace { ... }`
 * @param name - the name of the namespace.
 * @param nodes - the nodes in the namespace.
 * @returns
 */
export const createNamespaceDeclaration = ({
  name,
  statements,
}: {
  name: string;
  statements: Array<ts.Statement>;
}) =>
  ts.factory.createModuleDeclaration(
    [createModifier({ keyword: 'export' })],
    createIdentifier({ text: name }),
    ts.factory.createModuleBlock(statements),
    ts.NodeFlags.Namespace,
  );

export const createIndexedAccessTypeNode = ({
  indexType,
  objectType,
}: {
  indexType: ts.TypeNode;
  objectType: ts.TypeNode;
}) => {
  const node = ts.factory.createIndexedAccessTypeNode(objectType, indexType);
  return node;
};

export const createGetAccessorDeclaration = ({
  name,
  returnType,
  statements,
}: {
  name: string | ts.PropertyName;
  returnType?: string | ts.Identifier;
  statements: ReadonlyArray<ts.Statement>;
}) =>
  ts.factory.createGetAccessorDeclaration(
    undefined, // modifiers
    name,
    [], // parameters
    returnType ? createTypeReferenceNode({ typeName: returnType }) : undefined,
    createBlock({ statements }),
  );

export const createStringLiteral = ({
  isSingleQuote,
  text,
}: {
  isSingleQuote?: boolean;
  text: string;
}) => {
  if (isSingleQuote === undefined) {
    isSingleQuote = !text.includes("'");
  }
  const node = ts.factory.createStringLiteral(text, isSingleQuote);
  return node;
};

export const createConditionalExpression = ({
  condition,
  whenFalse,
  whenTrue,
}: {
  condition: ts.Expression;
  whenFalse: ts.Expression;
  whenTrue: ts.Expression;
}) => {
  const expression = ts.factory.createConditionalExpression(
    condition,
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    whenTrue,
    ts.factory.createToken(ts.SyntaxKind.ColonToken),
    whenFalse,
  );
  return expression;
};

export const createTypeOfExpression = ({
  text,
}: {
  text: string | ts.Identifier;
}) => {
  const expression = ts.factory.createTypeOfExpression(
    typeof text === 'string' ? createIdentifier({ text }) : text,
  );
  return expression;
};

/**
 * Create a type alias declaration. Example `export type X = Y;`.
 * @param comment (optional) comments to add
 * @param name the name of the type
 * @param type the type
 * @returns ts.TypeAliasDeclaration
 */
export const createTypeAliasDeclaration = ({
  comment,
  exportType,
  name,
  type,
  typeParameters = [],
}: {
  comment?: Comments;
  exportType?: boolean;
  name: string | ts.TypeReferenceNode;
  type: string | ts.TypeNode | ts.Identifier;
  typeParameters?: FunctionTypeParameter[];
}): ts.TypeAliasDeclaration => {
  const node = ts.factory.createTypeAliasDeclaration(
    exportType ? [createModifier({ keyword: 'export' })] : undefined,
    // TODO: https://github.com/hey-api/openapi-ts/issues/2289
    // passing type reference node seems to work and allows for dynamic renaming
    // @ts-expect-error
    typeof name === 'string' ? createIdentifier({ text: name }) : name,
    toTypeParameters(typeParameters),
    createTypeNode(type),
  );

  addLeadingComments({
    comments: comment,
    node,
  });

  return node;
};

export const createTypeReferenceNode = ({
  typeArguments,
  typeName,
}: {
  typeArguments?: ts.TypeNode[];
  typeName: string | ts.EntityName;
}) => ts.factory.createTypeReferenceNode(typeName, typeArguments);

export const createTypeParenthesizedNode = ({ type }: { type: ts.TypeNode }) =>
  ts.factory.createParenthesizedType(type);

export const createParameterDeclaration = ({
  initializer,
  modifiers,
  name,
  required = true,
  type,
}: {
  initializer?: ts.Expression;
  modifiers?: ReadonlyArray<ts.ModifierLike>;
  name: string | ts.BindingName;
  required?: boolean;
  type?: ts.TypeNode;
}) => {
  const node = ts.factory.createParameterDeclaration(
    modifiers,
    undefined,
    name,
    required ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    type,
    initializer,
  );
  return node;
};

export const createNewExpression = ({
  argumentsArray,
  expression,
  typeArguments,
}: {
  argumentsArray?: Array<ts.Expression>;
  expression: ts.Expression;
  typeArguments?: Array<ts.TypeNode>;
}) => {
  const node = ts.factory.createNewExpression(
    expression,
    typeArguments,
    argumentsArray,
  );
  return node;
};

export const createForOfStatement = ({
  awaitModifier,
  expression,
  initializer,
  statement,
}: {
  // TODO: parser - simplify this to be await?: boolean
  awaitModifier?: ts.AwaitKeyword;
  expression: ts.Expression;
  initializer: ts.ForInitializer;
  statement: ts.Statement;
}) => {
  const node = ts.factory.createForOfStatement(
    awaitModifier,
    initializer,
    expression,
    statement,
  );
  return node;
};

export const createAssignment = ({
  left,
  right,
}: {
  left: ts.Expression;
  right: ts.Expression;
}) => ts.factory.createAssignment(left, right);

export const createBlock = ({
  multiLine = true,
  statements,
}: {
  multiLine?: boolean;
  statements: ReadonlyArray<ts.Statement>;
}) => ts.factory.createBlock(statements, multiLine);

export const createPropertyAssignment = ({
  initializer,
  name,
}: {
  initializer: ts.Expression;
  name: string | ts.PropertyName;
}) => ts.factory.createPropertyAssignment(name, initializer);

export const createRegularExpressionLiteral = ({
  flags = [],
  text,
}: {
  flags?: ReadonlyArray<'g' | 'i' | 'm' | 's' | 'u' | 'y'>;
  text: string;
}) => {
  const textWithSlashes =
    text.startsWith('/') && text.endsWith('/') ? text : `/${text}/`;
  return ts.factory.createRegularExpressionLiteral(
    `${textWithSlashes}${flags.join('')}`,
  );
};

export const createAsExpression = ({
  expression,
  type,
}: {
  expression: ts.Expression;
  type: ts.TypeNode;
}) => ts.factory.createAsExpression(expression, type);

export const createTemplateLiteralType = ({
  value,
}: {
  value: ReadonlyArray<string | ts.TypeNode>;
}) => {
  const spans: Array<ts.TemplateLiteralTypeSpan> = [];
  let spanText = '';

  for (const item of value.slice(0).reverse()) {
    if (typeof item === 'string') {
      spanText = `${item}${spanText}`;
    } else {
      const literal = spans.length
        ? ts.factory.createTemplateMiddle(spanText)
        : ts.factory.createTemplateTail(spanText);
      const span = ts.factory.createTemplateLiteralTypeSpan(item, literal);
      spans.push(span);
      spanText = '';
    }
  }

  const templateLiteralType = ts.factory.createTemplateLiteralType(
    ts.factory.createTemplateHead(spanText),
    spans.reverse(),
  );
  return templateLiteralType;
};
