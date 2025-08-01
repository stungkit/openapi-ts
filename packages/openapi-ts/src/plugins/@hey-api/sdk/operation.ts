import type ts from 'typescript';

import { clientApi, clientModulePath } from '../../../generate/client';
import type { GeneratedFile } from '../../../generate/file';
import { statusCodeToGroup } from '../../../ir/operation';
import type { IR } from '../../../ir/types';
import { sanitizeNamespaceIdentifier } from '../../../openApi';
import { ensureValidIdentifier } from '../../../openApi/shared/utils/identifier';
import { tsc } from '../../../tsc';
import type { FunctionParameter, ObjectValue } from '../../../tsc/types';
import { reservedJavaScriptKeywordsRegExp } from '../../../utils/regexp';
import { stringCase } from '../../../utils/stringCase';
import { transformClassName } from '../../../utils/transform';
import type { Field, Fields } from '../client-core/bundle/params';
import { clientId, getClientPlugin } from '../client-core/utils';
import {
  operationTransformerIrRef,
  transformersId,
} from '../transformers/plugin';
import { typesId } from '../typescript/ref';
import type { PluginState } from '../typescript/types';
import { operationAuth } from './auth';
import { nuxtTypeComposable, nuxtTypeDefault, sdkId } from './constants';
import type { HeyApiSdkPlugin } from './types';
import { createRequestValidator, createResponseValidator } from './validator';

interface ClassNameEntry {
  /**
   * Name of the class where this function appears.
   */
  className: string;
  /**
   * Name of the function within the class.
   */
  methodName: string;
  /**
   * JSONPath-like array to class location.
   */
  path: ReadonlyArray<string>;
}

const operationClassName = ({
  context,
  value,
}: {
  context: IR.Context;
  value: string;
}) => {
  const name = stringCase({
    case: 'PascalCase',
    value: sanitizeNamespaceIdentifier(value),
  });
  return transformClassName({
    config: context.config,
    name,
  });
};

const getOperationMethodName = ({
  operation,
  plugin,
}: {
  operation: IR.OperationObject;
  plugin: {
    config: Pick<
      HeyApiSdkPlugin['Instance']['config'],
      'asClass' | 'methodNameBuilder'
    >;
  };
}) => {
  if (plugin.config.methodNameBuilder) {
    return plugin.config.methodNameBuilder(operation);
  }

  const handleIllegal = !plugin.config.asClass;
  if (handleIllegal && operation.id.match(reservedJavaScriptKeywordsRegExp)) {
    return `${operation.id}_`;
  }

  return operation.id;
};

/**
 * Returns a list of classes where this operation appears in the generated SDK.
 */
export const operationClasses = ({
  context,
  operation,
  plugin,
}: {
  context: IR.Context;
  operation: IR.OperationObject;
  plugin: {
    config: Pick<
      HeyApiSdkPlugin['Instance']['config'],
      'asClass' | 'classStructure' | 'instance'
    >;
  };
}): Map<string, ClassNameEntry> => {
  const classNames = new Map<string, ClassNameEntry>();

  let className: string | undefined;
  let methodName: string | undefined;
  let classCandidates: Array<string> = [];

  if (plugin.config.classStructure === 'auto' && operation.operationId) {
    classCandidates = operation.operationId.split(/[./]/).filter(Boolean);
    if (classCandidates.length > 1) {
      const methodCandidate = classCandidates.pop()!;
      methodName = stringCase({
        case: 'camelCase',
        value: sanitizeNamespaceIdentifier(methodCandidate),
      });
      className = classCandidates.pop()!;
    }
  }

  const rootClasses = plugin.config.instance
    ? [plugin.config.instance as string]
    : (operation.tags ?? ['default']);

  for (const rootClass of rootClasses) {
    const finalClassName = operationClassName({
      context,
      value: className || rootClass,
    });
    classNames.set(rootClass, {
      className: finalClassName,
      methodName: methodName || getOperationMethodName({ operation, plugin }),
      path: (className
        ? [rootClass, ...classCandidates, className]
        : [rootClass]
      ).map((value) =>
        operationClassName({
          context,
          value,
        }),
      ),
    });
  }

  return classNames;
};

export const operationOptionsType = ({
  file,
  operation,
  plugin,
  throwOnError,
}: {
  file: GeneratedFile;
  operation: IR.OperationObject;
  plugin: HeyApiSdkPlugin['Instance'];
  throwOnError?: string;
}) => {
  const client = getClientPlugin(plugin.context.config);
  const isNuxtClient = client.name === '@hey-api/client-nuxt';

  const pluginTypeScript = plugin.getPlugin('@hey-api/typescript')!;
  const fileTypeScript = plugin.context.file({ id: typesId })!;
  const dataImport = file.import({
    asType: true,
    module: file.relativePathToFile({ context: plugin.context, id: typesId }),
    name: fileTypeScript.getName(
      pluginTypeScript.api.getId({ operation, type: 'data' }),
    ),
  });
  const optionsName = clientApi.Options.name;

  if (isNuxtClient) {
    const responseImport = file.import({
      asType: true,
      module: file.relativePathToFile({ context: plugin.context, id: typesId }),
      name: fileTypeScript.getName(
        pluginTypeScript.api.getId({
          operation,
          type: isNuxtClient ? 'response' : 'responses',
        }),
      ),
    });
    return `${optionsName}<${nuxtTypeComposable}, ${dataImport.name || 'unknown'}, ${responseImport.name || 'unknown'}, ${nuxtTypeDefault}>`;
  }

  // TODO: refactor this to be more generic, works for now
  if (throwOnError) {
    return `${optionsName}<${dataImport.name || 'unknown'}, ${throwOnError}>`;
  }
  return dataImport.name ? `${optionsName}<${dataImport.name}>` : optionsName;
};

type OperationParameters = {
  argNames: Array<string>;
  fields: Array<Field | Fields>;
  parameters: Array<FunctionParameter>;
};

export const operationParameters = ({
  file,
  isRequiredOptions,
  operation,
  plugin,
}: {
  file: GeneratedFile;
  isRequiredOptions: boolean;
  operation: IR.OperationObject;
  plugin: HeyApiSdkPlugin['Instance'];
}): OperationParameters => {
  const result: OperationParameters = {
    argNames: [],
    fields: [],
    parameters: [],
  };

  const pluginTypeScript = plugin.getPlugin('@hey-api/typescript')!;
  const typescriptState: PluginState = {
    usedTypeIDs: new Set<string>(),
  };
  const client = getClientPlugin(plugin.context.config);
  const isNuxtClient = client.name === '@hey-api/client-nuxt';

  if (plugin.config.params_EXPERIMENTAL === 'experiment') {
    const fileTypeScript = plugin.context.file({ id: typesId })!;

    if (operation.parameters?.path) {
      for (const key in operation.parameters.path) {
        const parameter = operation.parameters.path[key]!;
        const name = ensureValidIdentifier(parameter.name);
        // TODO: detect duplicates
        result.argNames.push(name);
        result.fields.push({
          in: 'path',
          key: name,
        });
        result.parameters.push({
          isRequired: parameter.required,
          name,
          type: pluginTypeScript.api.schemaToType({
            onRef: (id) => {
              file.import({
                asType: true,
                module: file.relativePathToFile({
                  context: plugin.context,
                  id: typesId,
                }),
                name: fileTypeScript.getName(id),
              });
            },
            plugin: pluginTypeScript,
            schema: parameter.schema,
            state: typescriptState,
          }),
        });
      }
    }

    if (operation.parameters?.query) {
      for (const key in operation.parameters.query) {
        const parameter = operation.parameters.query[key]!;
        const name = ensureValidIdentifier(parameter.name);
        // TODO: detect duplicates
        result.argNames.push(name);
        result.fields.push({
          in: 'path',
          key: name,
        });
        result.parameters.push({
          isRequired: parameter.required,
          name,
          type: pluginTypeScript.api.schemaToType({
            onRef: (id) => {
              file.import({
                asType: true,
                module: file.relativePathToFile({
                  context: plugin.context,
                  id: typesId,
                }),
                name: fileTypeScript.getName(id),
              });
            },
            plugin: pluginTypeScript,
            schema: parameter.schema,
            state: typescriptState,
          }),
        });
      }
    }

    if (operation.body) {
      const name = 'body';
      // TODO: detect duplicates
      result.argNames.push(name);
      result.fields.push({ in: 'body' });
      result.parameters.push({
        isRequired: operation.body.required,
        name,
        type: pluginTypeScript.api.schemaToType({
          onRef: (id) => {
            file.import({
              asType: true,
              module: file.relativePathToFile({
                context: plugin.context,
                id: typesId,
              }),
              name: fileTypeScript.getName(id),
            });
          },
          plugin: pluginTypeScript,
          schema: operation.body.schema,
          state: typescriptState,
        }),
      });
    }
  }

  result.parameters.push({
    isRequired: isRequiredOptions,
    name: 'options',
    // TODO: ensure no path, body, query
    type: operationOptionsType({
      file,
      operation,
      plugin,
      throwOnError: isNuxtClient ? undefined : 'ThrowOnError',
    }),
  });

  return result;
};

/**
 * Infers `responseType` value from provided response content type. This is
 * an adapted version of `getParseAs()` from the Fetch API client.
 *
 * From Axios documentation:
 * `responseType` indicates the type of data that the server will respond with
 * options are: 'arraybuffer', 'document', 'json', 'text', 'stream'
 * browser only: 'blob'
 */
const getResponseType = (
  contentType: string | null | undefined,
):
  | 'arraybuffer'
  | 'blob'
  | 'document'
  | 'json'
  | 'stream'
  | 'text'
  | undefined => {
  if (!contentType) {
    return;
  }

  const cleanContent = contentType.split(';')[0]?.trim();

  if (!cleanContent) {
    return;
  }

  if (
    cleanContent.startsWith('application/json') ||
    cleanContent.endsWith('+json')
  ) {
    return 'json';
  }

  // Axios does not handle form data out of the box
  // if (cleanContent === 'multipart/form-data') {
  //   return 'formData';
  // }

  if (
    ['application/', 'audio/', 'image/', 'video/'].some((type) =>
      cleanContent.startsWith(type),
    )
  ) {
    return 'blob';
  }

  if (cleanContent.startsWith('text/')) {
    return 'text';
  }

  return;
};

export const operationStatements = ({
  isRequiredOptions,
  opParameters,
  operation,
  plugin,
}: {
  isRequiredOptions: boolean;
  opParameters: OperationParameters;
  operation: IR.OperationObject;
  plugin: HeyApiSdkPlugin['Instance'];
}): Array<ts.Statement> => {
  const file = plugin.context.file({ id: sdkId })!;
  const sdkOutput = file.nameWithoutExtension();

  const client = getClientPlugin(plugin.context.config);
  const isNuxtClient = client.name === '@hey-api/client-nuxt';

  const pluginTypeScript = plugin.getPlugin('@hey-api/typescript')!;
  const fileTypeScript = plugin.context.file({ id: typesId })!;
  const responseImport = file.import({
    asType: true,
    module: file.relativePathToFile({ context: plugin.context, id: typesId }),
    name: fileTypeScript.getName(
      pluginTypeScript.api.getId({
        operation,
        type: isNuxtClient ? 'response' : 'responses',
      }),
    ),
  });
  const errorImport = file.import({
    asType: true,
    module: file.relativePathToFile({ context: plugin.context, id: typesId }),
    name: fileTypeScript.getName(
      pluginTypeScript.api.getId({
        operation,
        type: isNuxtClient ? 'error' : 'errors',
      }),
    ),
  });

  // TODO: transform parameters
  // const query = {
  //   BarBaz: options.query.bar_baz,
  //   qux_quux: options.query.qux_quux,
  //   fooBar: options.query.foo_bar,
  // };

  // if (operation.parameters) {
  //   for (const name in operation.parameters.query) {
  //     const parameter = operation.parameters.query[name]
  //     if (parameter.name !== fieldName({ context, name: parameter.name })) {
  //       console.warn(parameter.name)
  //     }
  //   }
  // }

  const requestOptions: ObjectValue[] = [];

  if (operation.body) {
    switch (operation.body.type) {
      case 'form-data': {
        const imported = file.import({
          module: clientModulePath({
            config: plugin.context.config,
            sourceOutput: sdkOutput,
          }),
          name: 'formDataBodySerializer',
        });
        requestOptions.push({ spread: imported.name });
        break;
      }
      case 'json':
        // jsonBodySerializer is the default, no need to specify
        break;
      case 'text':
      case 'octet-stream':
        // ensure we don't use any serializer by default
        requestOptions.push({
          key: 'bodySerializer',
          value: null,
        });
        break;
      case 'url-search-params': {
        const imported = file.import({
          module: clientModulePath({
            config: plugin.context.config,
            sourceOutput: sdkOutput,
          }),
          name: 'urlSearchParamsBodySerializer',
        });
        requestOptions.push({ spread: imported.name });
        break;
      }
    }
  }

  // TODO: parser - set parseAs to skip inference if every response has the same
  // content type. currently impossible because successes do not contain
  // header information

  for (const name in operation.parameters?.query) {
    const parameter = operation.parameters.query[name]!;
    if (
      (parameter.schema.type === 'array' ||
        parameter.schema.type === 'tuple') &&
      (parameter.style !== 'form' || !parameter.explode)
    ) {
      // override the default settings for `querySerializer`
      requestOptions.push({
        key: 'querySerializer',
        value: [
          {
            key: 'array',
            value: [
              {
                key: 'explode',
                value: false,
              },
              {
                key: 'style',
                value: 'form',
              },
            ],
          },
        ],
      });
      break;
    }
  }

  const requestValidator = createRequestValidator({ operation, plugin });
  if (requestValidator) {
    requestOptions.push({
      key: 'requestValidator',
      value: requestValidator,
    });
  }

  if (plugin.config.transformer === '@hey-api/transformers') {
    const identifierTransformer = plugin.context
      .file({ id: transformersId })!
      .identifier({
        $ref: operationTransformerIrRef({ id: operation.id, type: 'response' }),
        namespace: 'value',
      });

    if (identifierTransformer.name) {
      file.import({
        module: file.relativePathToFile({
          context: plugin.context,
          id: transformersId,
        }),
        name: identifierTransformer.name,
      });

      requestOptions.push({
        key: 'responseTransformer',
        value: identifierTransformer.name,
      });
    }
  }

  if (client.name === '@hey-api/client-axios') {
    // try to infer `responseType` option for Axios. We don't need this in
    // Fetch API client because it automatically detects the correct response
    // during runtime.
    for (const statusCode in operation.responses) {
      // this doesn't handle default status code for now
      if (statusCodeToGroup({ statusCode }) === '2XX') {
        const response = operation.responses[statusCode];
        const responseType = getResponseType(response?.mediaType);
        if (responseType) {
          requestOptions.push({
            key: 'responseType',
            value: responseType,
          });
          break;
        }
      }
    }
  }

  const responseValidator = createResponseValidator({ operation, plugin });
  if (responseValidator) {
    requestOptions.push({
      key: 'responseValidator',
      value: responseValidator,
    });
  }

  if (plugin.config.responseStyle === 'data') {
    requestOptions.push({
      key: 'responseStyle',
      value: plugin.config.responseStyle,
    });
  }

  const auth = operationAuth({ context: plugin.context, operation, plugin });
  if (auth.length) {
    requestOptions.push({
      key: 'security',
      value: tsc.arrayLiteralExpression({ elements: auth }),
    });
  }

  requestOptions.push({
    key: 'url',
    value: operation.path,
  });

  // options must go last to allow overriding parameters above
  requestOptions.push({ spread: 'options' });

  const statements: Array<ts.Statement> = [];
  const hasParams = opParameters.argNames.length;

  if (hasParams) {
    const args: Array<unknown> = [];
    const config: Array<unknown> = [];
    for (const argName of opParameters.argNames) {
      args.push(tsc.identifier({ text: argName }));
    }
    for (const field of opParameters.fields) {
      const obj: Array<Record<string, unknown>> = [];
      if ('in' in field) {
        obj.push({
          key: 'in',
          value: field.in,
        });
        if (field.key) {
          obj.push({
            key: 'key',
            value: field.key,
          });
        }
        if (field.map) {
          obj.push({
            key: 'map',
            value: field.map,
          });
        }
      }
      config.push(tsc.objectExpression({ obj }));
    }
    const imported = file.import({
      module: clientModulePath({
        config: plugin.context.config,
        sourceOutput: sdkOutput,
      }),
      name: 'buildClientParams',
    });
    statements.push(
      tsc.constVariable({
        expression: tsc.callExpression({
          functionName: imported.name,
          parameters: [
            tsc.arrayLiteralExpression({ elements: args }),
            tsc.arrayLiteralExpression({ elements: config }),
          ],
        }),
        name: 'params',
      }),
    );
    requestOptions.push({ spread: 'params' });
  }

  if (operation.body) {
    const parameterContentType = operation.parameters?.header?.['content-type'];
    const hasRequiredContentType = Boolean(parameterContentType?.required);
    // spreading required Content-Type on generated header would throw a TypeScript error
    if (!hasRequiredContentType) {
      const headersValue: Array<unknown> = [
        {
          key: parameterContentType?.name ?? 'Content-Type',
          // form-data does not need Content-Type header, browser will set it automatically
          value:
            operation.body.type === 'form-data'
              ? null
              : operation.body.mediaType,
        },
        {
          spread: tsc.propertyAccessExpression({
            expression: tsc.identifier({ text: 'options' }),
            isOptional: !isRequiredOptions,
            name: 'headers',
          }),
        },
      ];
      if (hasParams) {
        headersValue.push({
          spread: tsc.propertyAccessExpression({
            expression: tsc.identifier({ text: 'params' }),
            name: 'headers',
          }),
        });
      }
      requestOptions.push({
        key: 'headers',
        value: headersValue,
      });
    }
  }

  const responseType = responseImport.name || 'unknown';
  const errorType = errorImport.name || 'unknown';

  const heyApiClient = plugin.config.client
    ? file.import({
        alias: '_heyApiClient',
        module: file.relativePathToFile({
          context: plugin.context,
          id: clientId,
        }),
        name: 'client',
      })
    : undefined;

  const optionsClient = tsc.propertyAccessExpression({
    expression: tsc.identifier({ text: 'options' }),
    isOptional: !isRequiredOptions,
    name: 'client',
  });

  let clientExpression: ts.Expression;

  if (plugin.config.instance) {
    clientExpression = tsc.binaryExpression({
      left: optionsClient,
      operator: '??',
      right: tsc.propertyAccessExpression({
        expression: tsc.this(),
        name: '_client',
      }),
    });
  } else if (heyApiClient?.name) {
    clientExpression = tsc.binaryExpression({
      left: optionsClient,
      operator: '??',
      right: tsc.identifier({ text: heyApiClient.name }),
    });
  } else {
    clientExpression = optionsClient;
  }

  const types: Array<string | ts.StringLiteral> = [];
  if (isNuxtClient) {
    types.push(
      nuxtTypeComposable,
      `${responseType} | ${nuxtTypeDefault}`,
      errorType,
      nuxtTypeDefault,
    );
  } else {
    types.push(responseType, errorType, 'ThrowOnError');
  }

  if (plugin.config.responseStyle === 'data') {
    types.push(tsc.stringLiteral({ text: plugin.config.responseStyle }));
  }

  statements.push(
    tsc.returnFunctionCall({
      args: [
        tsc.objectExpression({
          identifiers: ['responseTransformer'],
          obj: requestOptions,
        }),
      ],
      name: tsc.propertyAccessExpression({
        expression: clientExpression,
        name: tsc.identifier({ text: operation.method }),
      }),
      types,
    }),
  );

  return statements;
};
