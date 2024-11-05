import { camelCase } from "lodash";
import path from "node:path";
import ApiGenerator, {
  getOperationName as _getOperationName,
  getReferenceName,
  isReference,
  supportDeepObjects,
  createPropertyAssignment,
  createQuestionToken,
  isValidIdentifier,
  keywordType,
} from "oazapfts/generate";
import type { OpenAPIV3 } from "openapi-types";
import ts from "typescript";
import {
  generateBaseSelectors,
  generateCreateEntityAdapterCall,
  generateInitializeInitialState,
  ObjectPropertyDefinitions,
} from "./codegen";
import {
  generateCreateApiCall,
  generateEndpointDefinition,
  generateImportNode,
} from "./codegen";
import { generateReactHooks } from "./generators/react-hooks";
import type {
  EndpointMatcher,
  EndpointOverrides,
  GenerationOptions,
  OperationDefinition,
  TextMatcher,
} from "./types";
import {
  capitalize,
  getOperationDefinitions,
  getV3Doc,
  removeUndefined,
  isQuery as testIsQuery,
} from "./utils";
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

function getTags({
  verb,
  pathItem,
}: Pick<OperationDefinition, "verb" | "pathItem">): string[] {
  return verb ? pathItem[verb]?.tags || [] : [];
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

function withQueryComment<T extends ts.Node>(
  node: T,
  def: QueryArgDefinition,
  hasTrailingNewLine: boolean,
): T {
  const comment =
    def.origin === "param" ? def.param.description : def.body.description;
  if (comment) {
    return ts.addSyntheticLeadingComment(
      node,
      ts.SyntaxKind.MultiLineCommentTrivia,
      `* ${comment} `,
      hasTrailingNewLine,
    );
  }
  return node;
}

export function getOverrides(
  operation: OperationDefinition,
  endpointOverrides?: EndpointOverrides[],
): EndpointOverrides | undefined {
  return endpointOverrides?.find((override) =>
    operationMatches(override.pattern)(operation),
  );
}

export async function generateApi(
  spec: string,
  {
    key,
    argSuffix = "ApiArg",
    responseSuffix = "ApiResponse",
    hooks = false,
    tag = false,
    isDataResponse = defaultIsDataResponse,
    filterEndpoints,
    endpointOverrides,
    unionUndefined,
    flattenArg = false,
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

  // user provides a custom configuration in open api config
  // called `x-endpoint-to-index` for the endpoint to index
  const endpointToIndexOp: OperationDefinition | undefined =
    subsetOperationDefinitions.find((operationDefinition) => {
      const temp = operationDefinition.operation;
      // @ts-ignore
      return !!temp["x-celestial-index-endpoint"];
    });

  if (!endpointToIndexOp) {
    throw new Error(`No endpoint to index found for ${key}`);
  }

  const endpointToIndex =
    endpointToIndexOp.verb + capitalize(endpointToIndexOp.path.slice(1));

  const resultFile = ts.createSourceFile(
    "someFileName.ts",
    "",
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  const interfaces: Record<
    string,
    ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  > = {};
  function registerInterface(
    declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  ) {
    const name = declaration.name.escapedText.toString();
    if (name in interfaces) {
      throw new Error(`interface/type alias ${name} already registered`);
    }
    interfaces[name] = declaration;
    return declaration;
  }

  return printer.printNode(
    ts.EmitHint.Unspecified,
    factory.createSourceFile(
      [
        generateImportNode("@reduxjs/toolkit", {
          ["createEntityAdapter"]: "createEntityAdapter",
          ["EntityState"]: "EntityState",
        }),
        generateImportNode("@reduxjs/toolkit/query/react", {
          ["createApi"]: "createApi",
        }),
        generateImportNode("@reduxjs/toolkit/query/react", {
          ["fetchBaseQuery"]: "fetchBaseQuery",
        }),
        generateCreateEntityAdapterCall(),
        generateInitializeInitialState(),
        generateCreateApiCall({
          // @ts-ignore
          server: apiGen.spec.servers[0].url,
          identifier: key,
          tags: tag
            ? extractAllTagTypes({
                operationDefinitions: subsetOperationDefinitions,
              })
            : [],
          endpointDefinitions: factory.createObjectLiteralExpression(
            subsetOperationDefinitions.map((operationDefinition) =>
              generateEndpoint({
                operationDefinition,
                overrides: getOverrides(operationDefinition, endpointOverrides),
              }),
            ),
            true,
          ),
        }),
        ...generateBaseSelectors(key, endpointToIndex),
        ...Object.values(interfaces),
        ...apiGen.aliases,
        ...apiGen.enumAliases,
        ...(hooks
          ? [
              generateReactHooks({
                exportName: generateApiSliceName(key),
                operationDefinitions: subsetOperationDefinitions,
                endpointOverrides,
                config: hooks,
              }),
            ]
          : []),
      ],
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    ),
    resultFile,
  );

  function extractAllTagTypes({
    operationDefinitions: subsetOperationDefinitions,
  }: {
    operationDefinitions: OperationDefinition[];
  }) {
    const allTagTypes = new Set<string>();

    for (const operationDefinition of subsetOperationDefinitions) {
      const { verb, pathItem } = operationDefinition;
      for (const tag of getTags({ verb, pathItem })) {
        allTagTypes.add(tag);
      }
    }
    return [...allTagTypes];
  }

  function generateEndpoint({
    operationDefinition,
    overrides,
  }: {
    operationDefinition: OperationDefinition;
    overrides?: EndpointOverrides;
  }) {
    const {
      verb,
      path,
      pathItem,
      operation,
      operation: { responses, requestBody },
    } = operationDefinition;
    const operationName = getOperationName({ verb, path, operation });
    const tags = tag ? getTags({ verb, pathItem }) : [];
    const isQuery = testIsQuery(verb, overrides);

    const returnsJson = apiGen.getResponseType(responses) === "json";
    let ResponseType: ts.TypeNode = factory.createKeywordTypeNode(
      ts.SyntaxKind.UnknownKeyword,
    );
    if (returnsJson) {
      const returnTypes = Object.entries(responses || {})
        .map(
          ([code, response]) =>
            [
              code,
              apiGen.resolve(response),
              apiGen.getTypeFromResponse(response, "readOnly") ||
                factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
            ] as const,
        )
        .filter(([status, response]) =>
          isDataResponse(status, apiGen.resolve(response), responses || {}),
        )
        .map(([code, response, type]) =>
          ts.addSyntheticLeadingComment(
            { ...type },
            ts.SyntaxKind.MultiLineCommentTrivia,
            `* status ${code} ${response.description} `,
            false,
          ),
        )
        .filter((type) => type !== keywordType.void);
      if (returnTypes.length > 0) {
        ResponseType = factory.createUnionTypeNode(returnTypes);
      }
    }

    const ResponseTypeName = factory.createTypeReferenceNode(
      registerInterface(
        factory.createTypeAliasDeclaration(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          capitalize(operationName + responseSuffix),
          undefined,
          ResponseType,
        ),
      ).name,
    );

    const parameters = supportDeepObjects([
      ...apiGen.resolveArray(pathItem.parameters),
      ...apiGen.resolveArray(operation.parameters),
    ]);

    const allNames = parameters.map((p) => p.name);
    const queryArg: QueryArgDefinitions = {};
    function generateName(name: string, potentialPrefix: string) {
      const isPureSnakeCase = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
      // prefix with `query`, `path` or `body` if there are multiple paramters with the same name
      const hasNamingConflict = allNames.filter((n) => n === name).length > 1;
      if (hasNamingConflict) {
        name = `${potentialPrefix}_${name}`;
      }
      // convert to camelCase if the name is pure snake_case and there are no naming conflicts
      const camelCaseName = camelCase(name);
      if (isPureSnakeCase && !allNames.includes(camelCaseName)) {
        name = camelCaseName;
      }
      // if there are still any naming conflicts, prepend with underscore
      while (name in queryArg) {
        name = `_${name}`;
      }
      return name;
    }

    for (const param of parameters) {
      const name = generateName(param.name, param.in);
      queryArg[name] = {
        origin: "param",
        name,
        originalName: param.name,
        type: apiGen.getTypeFromSchema(
          isReference(param) ? param : param.schema,
          undefined,
          "writeOnly",
        ),
        required: param.required,
        param,
      };
    }

    if (requestBody) {
      const body = apiGen.resolve(requestBody);
      const schema = apiGen.getSchemaFromContent(body.content);
      const type = apiGen.getTypeFromSchema(schema);
      let schemaName;
      if (
        typeof schema === "object" &&
        schema !== null &&
        !Array.isArray(schema)
      ) {
        schemaName = camelCase(
          (type as any).name ||
            getReferenceName(schema) ||
            ("title" in schema && schema.title) ||
            "body",
        );
      } else {
        schemaName = camelCase(
          (type as any).name || getReferenceName(schema) || "body",
        );
      }
      const name = generateName(
        schemaName in queryArg ? "body" : schemaName,
        "body",
      );

      queryArg[name] = {
        origin: "body",
        name,
        originalName: schemaName,
        type: apiGen.getTypeFromSchema(schema, undefined, "writeOnly"),
        required: true,
        body,
      };
    }

    const propertyName = (name: string | ts.PropertyName): ts.PropertyName => {
      if (typeof name === "string") {
        return isValidIdentifier(name)
          ? factory.createIdentifier(name)
          : factory.createStringLiteral(name);
      }
      return name;
    };

    const queryArgValues = Object.values(queryArg);

    const isFlatArg = flattenArg && queryArgValues.length === 1;

    const QueryArg = factory.createTypeReferenceNode(
      registerInterface(
        factory.createTypeAliasDeclaration(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          capitalize(operationName + argSuffix),
          undefined,
          queryArgValues.length > 0
            ? isFlatArg
              ? withQueryComment(
                  { ...queryArgValues[0].type },
                  queryArgValues[0],
                  false,
                )
              : factory.createTypeLiteralNode(
                  queryArgValues.map((def) =>
                    withQueryComment(
                      factory.createPropertySignature(
                        undefined,
                        propertyName(def.name),
                        createQuestionToken(!def.required),
                        def.type,
                      ),
                      def,
                      true,
                    ),
                  ),
                )
            : factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
        ),
      ).name,
    );

    // error: Type of operationDefinition.operation object does not have key x-celestial-updateByKey
    // would need to define new object inheriting OpenAPIV3.OperationObject
    let optimisticPatchToApplyPK = undefined;
    if (
      operationDefinition.operation.hasOwnProperty("x-celestial-updateByKey")
    ) {
      optimisticPatchToApplyPK =
        // @ts-ignore
        operationDefinition.operation["x-celestial-updateByKey"];
    }

    const optimisticPatchKeyIntermediate = Object.values(queryArg).find(
      (def) => def.origin === "body",
    );
    const optimisticPatchKey = optimisticPatchKeyIntermediate
      ? optimisticPatchKeyIntermediate.name
      : undefined;
    let indexResponseByKey = undefined;
    if (
      operationDefinition.operation.hasOwnProperty(
        "x-celestial-index-endpoint-by-key",
      )
    ) {
      // @ts-ignore
      indexResponseByKey =
        operationDefinition.operation["x-celestial-index-endpoint-by-key"];
    }

    return generateEndpointDefinition({
      operationName,
      verb: operationDefinition.verb,
      cacheKeyToOptimisticallyUpdate: endpointToIndex,
      optimisticPatchToApplyPK: optimisticPatchToApplyPK,
      optimisticPatchKey: optimisticPatchKey,
      isEndpointToIndex: operationName === endpointToIndex,
      indexResponseByKey: indexResponseByKey,
      type: isQuery ? "query" : "mutation",
      Response: ResponseTypeName,
      QueryArg,
      queryFn: generateQueryFn({
        operationDefinition,
        queryArg,
        isQuery,
        isFlatArg,
      }),
      extraEndpointsProps: isQuery
        ? generateQueryEndpointProps({ operationDefinition })
        : generateMutationEndpointProps({ operationDefinition }),
      tags,
    });
  }

  function generateQueryFn({
    operationDefinition,
    queryArg,
    isFlatArg,
    isQuery,
  }: {
    operationDefinition: OperationDefinition;
    queryArg: QueryArgDefinitions;
    isFlatArg: boolean;
    isQuery: boolean;
  }) {
    const { path, verb } = operationDefinition;

    const bodyParameter = Object.values(queryArg).find(
      (def) => def.origin === "body",
    );

    const rootObject = factory.createIdentifier("queryArg");

    function pickParams(paramIn: string) {
      return Object.values(queryArg).filter(
        (def) => def.origin === "param" && def.param.in === paramIn,
      );
    }

    function createObjectLiteralProperty(
      parameters: QueryArgDefinition[],
      propertyName: string,
    ) {
      return parameters.length === 0
        ? undefined
        : factory.createPropertyAssignment(
            factory.createIdentifier(propertyName),
            factory.createObjectLiteralExpression(
              parameters.map(
                (param) =>
                  createPropertyAssignment(
                    param.originalName,
                    isFlatArg
                      ? rootObject
                      : accessProperty(rootObject, param.name),
                  ),
                true,
              ),
            ),
          );
    }

    return factory.createArrowFunction(
      undefined,
      undefined,
      Object.keys(queryArg).length
        ? [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              rootObject,
              undefined,
              undefined,
              undefined,
            ),
          ]
        : [],
      undefined,
      factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      factory.createParenthesizedExpression(
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              factory.createIdentifier("url"),
              generatePathExpression(
                path,
                pickParams("path"),
                rootObject,
                isFlatArg,
              ),
            ),
            isQuery && verb.toUpperCase() === "GET"
              ? undefined
              : factory.createPropertyAssignment(
                  factory.createIdentifier("method"),
                  factory.createStringLiteral(verb.toUpperCase()),
                ),
            bodyParameter === undefined
              ? undefined
              : factory.createPropertyAssignment(
                  factory.createIdentifier("body"),
                  isFlatArg
                    ? rootObject
                    : factory.createPropertyAccessExpression(
                        rootObject,
                        factory.createIdentifier(bodyParameter.name),
                      ),
                ),
            createObjectLiteralProperty(pickParams("cookie"), "cookies"),
            createObjectLiteralProperty(pickParams("header"), "headers"),
            createObjectLiteralProperty(pickParams("query"), "params"),
          ].filter(removeUndefined),
          false,
        ),
      ),
    );
  }

  // eslint-disable-next-line no-empty-pattern
  function generateQueryEndpointProps({}: {
    operationDefinition: OperationDefinition;
  }): ObjectPropertyDefinitions {
    return {}; /* TODO needs implementation - skip for now */
  }

  // eslint-disable-next-line no-empty-pattern
  function generateMutationEndpointProps({}: {
    operationDefinition: OperationDefinition;
  }): ObjectPropertyDefinitions {
    return {}; /* TODO needs implementation - skip for now */
  }
}

function accessProperty(rootObject: ts.Identifier, propertyName: string) {
  return isValidIdentifier(propertyName)
    ? factory.createPropertyAccessExpression(
        rootObject,
        factory.createIdentifier(propertyName),
      )
    : factory.createElementAccessExpression(
        rootObject,
        factory.createStringLiteral(propertyName),
      );
}

function generatePathExpression(
  path: string,
  pathParameters: QueryArgDefinition[],
  rootObject: ts.Identifier,
  isFlatArg: boolean,
) {
  const expressions: Array<[string, string]> = [];

  const head = path.replace(
    /\{(.*?)}(.*?)(?=\{|$)/g,
    (_, expression, literal) => {
      const param = pathParameters.find((p) => p.originalName === expression);
      if (!param) {
        throw new Error(
          `path parameter ${expression} does not seem to be defined in '${path}'!`,
        );
      }
      expressions.push([param.name, literal]);
      return "";
    },
  );

  return expressions.length
    ? factory.createTemplateExpression(
        factory.createTemplateHead(head),
        expressions.map(([prop, literal], index) =>
          factory.createTemplateSpan(
            isFlatArg ? rootObject : accessProperty(rootObject, prop),
            index === expressions.length - 1
              ? factory.createTemplateTail(literal)
              : factory.createTemplateMiddle(literal),
          ),
        ),
      )
    : factory.createNoSubstitutionTemplateLiteral(head);
}

type QueryArgDefinition = {
  name: string;
  originalName: string;
  type: ts.TypeNode;
  required?: boolean;
  param?: OpenAPIV3.ParameterObject;
} & (
  | {
      origin: "param";
      param: OpenAPIV3.ParameterObject;
    }
  | {
      origin: "body";
      body: OpenAPIV3.RequestBodyObject;
    }
);
type QueryArgDefinitions = Record<string, QueryArgDefinition>;
