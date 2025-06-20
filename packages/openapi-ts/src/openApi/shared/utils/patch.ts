import type { Patch } from '../../../types/input';
import type { OpenApi } from '../../types';

export const patchOpenApiSpec = ({
  patchOptions,
  spec: _spec,
}: {
  patchOptions: Patch | undefined;
  spec: unknown;
}) => {
  if (!patchOptions) {
    return;
  }

  const spec = _spec as OpenApi.V2_0_X | OpenApi.V3_0_X | OpenApi.V3_1_X;

  if ('swagger' in spec) {
    if (patchOptions.version && spec.swagger) {
      spec.swagger = patchOptions.version(spec.swagger) as typeof spec.swagger;
    }

    if (patchOptions.meta && spec.info) {
      patchOptions.meta(spec.info);
    }

    if (patchOptions.schemas && spec.definitions) {
      for (const key in patchOptions.schemas) {
        const patchFn = patchOptions.schemas[key]!;
        const schema = spec.definitions[key];
        if (schema && typeof schema === 'object') {
          patchFn(schema);
        }
      }
    }
    return;
  }

  if (patchOptions.version && spec.openapi) {
    spec.openapi = patchOptions.version(spec.openapi) as typeof spec.openapi;
  }

  if (patchOptions.meta && spec.info) {
    patchOptions.meta(spec.info);
  }

  if (spec.components) {
    if (patchOptions.schemas && spec.components.schemas) {
      for (const key in patchOptions.schemas) {
        const patchFn = patchOptions.schemas[key]!;
        const schema = spec.components.schemas[key];
        if (schema && typeof schema === 'object') {
          patchFn(schema);
        }
      }
    }

    if (patchOptions.parameters && spec.components.parameters) {
      for (const key in patchOptions.parameters) {
        const patchFn = patchOptions.parameters[key]!;
        const schema = spec.components.parameters[key];
        if (schema && typeof schema === 'object') {
          patchFn(schema);
        }
      }
    }

    if (patchOptions.requestBodies && spec.components.requestBodies) {
      for (const key in patchOptions.requestBodies) {
        const patchFn = patchOptions.requestBodies[key]!;
        const schema = spec.components.requestBodies[key];
        if (schema && typeof schema === 'object') {
          patchFn(schema);
        }
      }
    }

    if (patchOptions.responses && spec.components.responses) {
      for (const key in patchOptions.responses) {
        const patchFn = patchOptions.responses[key]!;
        const schema = spec.components.responses[key];
        if (schema && typeof schema === 'object') {
          patchFn(schema);
        }
      }
    }
  }
};
