import type { ConfigFile } from '@celestial/codegen-openapi';

const config: ConfigFile = {
  schemaFile: './fixtures/petstore.yaml',
  apiFile: './fixtures/emptyApi.ts',
  outputFile: './tmp/example.ts',
  useEnumType: true,
};

export default config;