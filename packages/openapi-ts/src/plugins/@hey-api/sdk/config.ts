import type { Plugin } from '../../types';
import { handler } from './plugin';
import { handlerLegacy } from './plugin-legacy';
import type { Config } from './types';

export const defaultConfig: Plugin.Config<Config> = {
  _dependencies: ['@hey-api/typescript'],
  _handler: handler,
  _handlerLegacy: handlerLegacy,
  _infer: (config, context) => {
    if (config.client) {
      if (typeof config.client === 'boolean') {
        config.client = context.pluginByTag({
          defaultPlugin: '@hey-api/client-fetch',
          tag: 'client',
        }) as unknown as typeof config.client;
      }

      context.ensureDependency(config.client);
    }

    if (config.transformer) {
      if (typeof config.transformer === 'boolean') {
        config.transformer = context.pluginByTag({
          tag: 'transformer',
        }) as unknown as typeof config.transformer;
      }

      context.ensureDependency(config.transformer);
    }

    if (config.validator) {
      if (typeof config.validator === 'boolean') {
        config.validator = context.pluginByTag({
          tag: 'validator',
        }) as unknown as typeof config.validator;
      }

      context.ensureDependency(config.validator);
    }

    if (config.instance) {
      if (typeof config.instance !== 'string') {
        config.instance = 'Sdk';
      }

      config.asClass = true;
    }

    // TODO: add responseStyle field to all clients
    if (config.client !== '@hey-api/client-fetch') {
      config.responseStyle = 'fields';
    }
  },
  asClass: false,
  auth: true,
  classStructure: 'auto',
  client: true,
  exportFromIndex: true,
  instance: false,
  name: '@hey-api/sdk',
  operationId: true,
  output: 'sdk',
  response: 'body',
  responseStyle: 'fields',
};

/**
 * Type helper for `@hey-api/sdk` plugin, returns {@link Plugin.Config} object
 */
export const defineConfig: Plugin.DefineConfig<Config> = (config) => ({
  ...defaultConfig,
  ...config,
});
