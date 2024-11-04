import ApiGenerator, {
  getOperationName as _getOperationName,
} from "oazapfts/generate";
import ts from "typescript";
import {
  generateExportNode,
  generateSelectorIdentifier,
  SelectorTypes,
} from "./codegen";
import { createHookIdentifier } from "./generators/react-hooks";
import type {
  EndpointMatcher,
  EndpointOverrides,
  GenerationOptions,
  OperationDefinition,
  TextMatcher,
} from "./types";
import { getOperationDefinitions, getV3Doc } from "./utils";
import { factory } from "./utils/factory";
import { generateApiSliceName } from "./utils/naming";

function defaultIsDataResponse(code: string) {
  const parsedCode = Number(code);
  return !Number.isNaN(parsedCode) && parsedCode >= 200 && parsedCode < 300;
}

function getOperationName({
  verb,
  path,
  operation,
}: Pick<OperationDefinition, "verb" | "path" | "operation">) {
  return _getOperationName(verb, path, operation.operationId);
}

function patternMatches(pattern?: TextMatcher) {
  const filters = Array.isArray(pattern) ? pattern : [pattern];
  return function matcher(operationName: string) {
    if (!pattern) return true;
    return filters.some((filter) =>
      typeof filter === "string"
        ? filter === operationName
        : filter?.test(operationName),
    );
  };
}

function operationMatches(pattern?: EndpointMatcher) {
  const checkMatch =
    typeof pattern === "function" ? pattern : patternMatches(pattern);
  return function matcher(operationDefinition: OperationDefinition) {
    if (!pattern) return true;
    const operationName = getOperationName(operationDefinition);
    return checkMatch(operationName, operationDefinition);
  };
}

function generateSelectorExports(collectionKey: string) {
  const allSelectors: string[] = Object.keys(SelectorTypes)
    .filter((key) => isNaN(Number(key)))
    .map(
      (
        selectorType, // @ts-ignore
      ) =>
        generateSelectorIdentifier(collectionKey, SelectorTypes[selectorType]),
    );
  return generateExportNode(
    `./${generateApiSliceName(collectionKey)}`,
    allSelectors,
  );
}

function generateHookExports(
  collectionKey: string,
  operationDefinitions: OperationDefinition[],
  endpointOverrides: EndpointOverrides[] | undefined,
) {
  const hooks: string[] = operationDefinitions.map((operationDefinition) => {
    const baseParams = {
      operationDefinition,
      endpointOverrides,
    };
    return createHookIdentifier(baseParams);
  });
  return generateExportNode(`./${generateApiSliceName(collectionKey)}`, hooks);
}

export async function generateIndexFile(
  spec: string,
  {
    key,
    hooks = false,
    filterEndpoints,
    endpointOverrides,
    unionUndefined,
    useEnumType = false,
    mergeReadWriteOnly = false,
  }: GenerationOptions,
) {
  const v3Doc = await getV3Doc(spec);

  const apiGen = new ApiGenerator(v3Doc, {
    unionUndefined,
    useEnumType,
    mergeReadWriteOnly,
  });

  // temporary workaround for https://github.com/oazapfts/oazapfts/issues/491
  if (apiGen.spec.components?.schemas) {
    apiGen.preprocessComponents(apiGen.spec.components.schemas);
  }

  const operationDefinitions = getOperationDefinitions(v3Doc).filter(
    operationMatches(filterEndpoints),
  );

  // code gen for endpoints of a particular grouping
  const subsetOperationDefinitions = operationDefinitions.filter(
    (operationDefinition) => {
      const temp = operationDefinition.operation;
      // @ts-ignore
      return temp["x-celestial-grouping"] === key;
    },
  );

  const resultFile = ts.createSourceFile(
    "someFileName.ts",
    "",
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  return printer.printNode(
    ts.EmitHint.Unspecified,
    factory.createSourceFile(
      [
        generateSelectorExports(key),
        generateHookExports(key, subsetOperationDefinitions, endpointOverrides),
        generateExportNode("./cache", [
          "useCacheInit",
          "useCacheUpdate",
          "selectCache",
        ]),
      ],
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    ),
    resultFile,
  );
}
