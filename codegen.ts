import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    {
      "https://api.fly.io/graphql": {headers: {}},
    },
  ],
  documents: ["queries.ts"],
  generates: {
    "./src/fly-graphql.ts": {
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
      "prettier -w ./src/index.ts",
      `replace-in-file 'import { GraphQLClientRequestHeaders } from "graphql-request/build/cjs/types";' 'type GraphQLClientRequestHeaders = Record<string, string>' ./src/index.ts`,
    ],
  },
};

export default config;
