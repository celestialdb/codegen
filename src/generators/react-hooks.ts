import ts from "typescript";
import { getOperationName } from "oazapfts/generate";
import { capitalize, isQuery } from "../utils";
import type {
  ConfigFile,
  EndpointOverrides,
  OperationDefinition,
} from "../types";
import { getOverrides } from "../generate";
import { factory } from "../utils/factory";

type HooksConfigOptions = NonNullable<ConfigFile["hooks"]>;

type GetReactHookNameParams = {
  operationDefinition: OperationDefinition;
  endpointOverrides: EndpointOverrides[] | undefined;
  config: HooksConfigOptions;
};

export function createHookIdentifier({
  operationDefinition: operationDefinition,
  overrides,
  isLazy = false,
}: CreateBindingParams) {
  const { verb, path, operation } = operationDefinition;
  return `use${isLazy ? "Lazy" : ""}${capitalize(getOperationName(verb, path, operation.operationId))}${
    isQuery(verb, overrides) ? "Query" : "Mutation"
  }`;
}

type CreateBindingParams = {
  operationDefinition: OperationDefinition;
  overrides?: EndpointOverrides;
  isLazy?: boolean;
};

const createBinding = ({
  operationDefinition: operationDefinition,
  overrides,
  isLazy = false,
}: CreateBindingParams) =>
  factory.createBindingElement(
    undefined,
    undefined,
    factory.createIdentifier(
      createHookIdentifier({ operationDefinition, overrides }),
    ),
    undefined,
  );

export const getReactHookName = ({
  operationDefinition,
  endpointOverrides,
  config,
}: GetReactHookNameParams) => {
  const overrides = getOverrides(operationDefinition, endpointOverrides);

  const baseParams = {
    operationDefinition,
    overrides,
  };

  const _isQuery = isQuery(operationDefinition.verb, overrides);

  // If `config` is true, just generate everything
  if (typeof config === "boolean") {
    return createBinding(baseParams);
  }

  // `config` is an object and we need to check for the configuration of each property
  if (_isQuery) {
    return [
      ...(config.queries ? [createBinding(baseParams)] : []),
      ...(config.lazyQueries
        ? [createBinding({ ...baseParams, isLazy: true })]
        : []),
    ];
  }

  return config.mutations ? createBinding(baseParams) : [];
};

type GenerateReactHooksParams = {
  exportName: string;
  operationDefinitions: OperationDefinition[];
  endpointOverrides: EndpointOverrides[] | undefined;
  config: HooksConfigOptions;
};
export const generateReactHooks = ({
  exportName,
  operationDefinitions,
  endpointOverrides,
  config,
}: GenerateReactHooksParams) =>
  factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createObjectBindingPattern(
            operationDefinitions
              .map((operationDefinition) =>
                getReactHookName({
                  operationDefinition,
                  endpointOverrides,
                  config,
                }),
              )
              .flat(),
          ),
          undefined,
          undefined,
          factory.createIdentifier(exportName),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
