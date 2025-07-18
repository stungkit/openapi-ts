import { compiler } from '../../../compiler';
import { clientModulePath } from '../../../generate/client';
import type { FileImportResult } from '../../../generate/file/types';
import { getClientPlugin } from '../client-core/utils';
import { nuxtTypeDefault, nuxtTypeResponse, sdkId } from './constants';
import type { HeyApiSdkPlugin } from './types';

export const createTypeOptions = ({
  clientOptions,
  plugin,
}: {
  clientOptions: FileImportResult<string, string>;
  plugin: HeyApiSdkPlugin['Instance'];
}) => {
  const file = plugin.context.file({ id: sdkId })!;
  const client = getClientPlugin(plugin.context.config);
  const isNuxtClient = client.name === '@hey-api/client-nuxt';

  const clientModule = clientModulePath({
    config: plugin.context.config,
    sourceOutput: file.nameWithoutExtension(),
  });
  const tDataShape = file.import({
    asType: true,
    module: clientModule,
    name: 'TDataShape',
  });
  const clientType = file.import({
    asType: true,
    module: clientModule,
    name: 'Client',
  });

  const typeOptions = compiler.typeAliasDeclaration({
    exportType: true,
    name: 'Options',
    type: compiler.typeIntersectionNode({
      types: [
        compiler.typeReferenceNode({
          typeArguments: isNuxtClient
            ? [
                compiler.typeReferenceNode({ typeName: 'TComposable' }),
                compiler.typeReferenceNode({ typeName: 'TData' }),
                compiler.typeReferenceNode({ typeName: nuxtTypeResponse }),
                compiler.typeReferenceNode({ typeName: nuxtTypeDefault }),
              ]
            : [
                compiler.typeReferenceNode({ typeName: 'TData' }),
                compiler.typeReferenceNode({ typeName: 'ThrowOnError' }),
              ],
          typeName: clientOptions.name,
        }),
        compiler.typeInterfaceNode({
          properties: [
            {
              comment: [
                'You can provide a client instance returned by `createClient()` instead of',
                'individual options. This might be also useful if you want to implement a',
                'custom client.',
              ],
              isRequired: !plugin.config.client,
              name: 'client',
              type: compiler.typeReferenceNode({ typeName: clientType.name }),
            },
            {
              comment: [
                'You can pass arbitrary values through the `meta` object. This can be',
                "used to access values that aren't defined as part of the SDK function.",
              ],
              isRequired: false,
              name: 'meta',
              type: compiler.typeReferenceNode({
                typeArguments: [
                  compiler.keywordTypeNode({ keyword: 'string' }),
                  compiler.keywordTypeNode({ keyword: 'unknown' }),
                ],
                typeName: 'Record',
              }),
            },
          ],
          useLegacyResolution: false,
        }),
      ],
    }),
    typeParameters: isNuxtClient
      ? [
          compiler.typeParameterDeclaration({
            constraint: compiler.typeReferenceNode({ typeName: 'Composable' }),
            name: 'TComposable',
          }),
          compiler.typeParameterDeclaration({
            constraint: compiler.typeReferenceNode({
              typeName: tDataShape.name,
            }),
            defaultType: compiler.typeReferenceNode({
              typeName: tDataShape.name,
            }),
            name: 'TData',
          }),
          compiler.typeParameterDeclaration({
            defaultType: compiler.keywordTypeNode({ keyword: 'unknown' }),
            name: nuxtTypeResponse,
          }),
          compiler.typeParameterDeclaration({
            defaultType: compiler.keywordTypeNode({ keyword: 'undefined' }),
            name: nuxtTypeDefault,
          }),
        ]
      : [
          compiler.typeParameterDeclaration({
            constraint: compiler.typeReferenceNode({
              typeName: tDataShape.name,
            }),
            defaultType: compiler.typeReferenceNode({
              typeName: tDataShape.name,
            }),
            name: 'TData',
          }),
          compiler.typeParameterDeclaration({
            constraint: compiler.keywordTypeNode({ keyword: 'boolean' }),
            defaultType: compiler.keywordTypeNode({ keyword: 'boolean' }),
            name: 'ThrowOnError',
          }),
        ],
  });

  file.add(typeOptions);
};
