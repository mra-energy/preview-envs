import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    {
      "https://api.fly.io/graphql": {headers: {}},
    },
  ],
  documents: ["src/fly/fly.graphql"],
  generates: {
    "./src/fly/sdk.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-graphql-request",
        {
          // related to https://github.com/dotansimha/graphql-code-generator/issues/9046
          add: {
            content: `type GraphQLError = {};`,
          },
        },
      ],
      config: { rawRequest: true },
    },
  },
  hooks: {
    afterAllFileWrite: [
      // related to https://github.com/dotansimha/graphql-code-generator/issues/9046
      `replace-in-file "import { GraphQLClientRequestHeaders } from 'graphql-request/build/cjs/types'" 'type GraphQLClientRequestHeaders = Record<string, string>' ./src/fly/sdk.ts`,
      "prettier -w ./src/fly/sdk.ts",
    ],
  },
};

export default config;
