import { factory } from "./utils/factory";
import ts from "typescript";
import { capitalize } from "./utils";
import { reduxIdentifiers } from "./utils/reduxIdentifiers";
import { generateApiSliceName, generateReducerPath } from "./utils/naming";
import { OptimisticUpdateCodeGenerator } from "./generators/optimistic-updates";

const defaultEndpointBuilder = factory.createIdentifier("build");

export type ObjectPropertyDefinitions = Record<
  string,
  ts.Expression | undefined
>;
export function generateObjectProperties(obj: ObjectPropertyDefinitions) {
  return Object.entries(obj)
    .filter(([_, v]) => v)
    .map(([k, v]) =>
      factory.createPropertyAssignment(
        factory.createIdentifier(k),
        v as ts.Expression,
      ),
    );
}

export function generateImportNode(
  pkg: string,
  namedImports: Record<string, string>,
  defaultImportName?: string,
) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      defaultImportName !== undefined
        ? factory.createIdentifier(defaultImportName)
        : undefined,
      factory.createNamedImports(
        Object.entries(namedImports).map(([propertyName, name]) =>
          factory.createImportSpecifier(
            name === propertyName
              ? undefined
              : factory.createIdentifier(propertyName),
            factory.createIdentifier(name),
          ),
        ),
      ),
    ),
    factory.createStringLiteral(pkg),
  );
}

export function generateExportNode(moduleName: string, namedExports: string[]) {
  const exportSpecifiers = namedExports.map((name) =>
    ts.factory.createExportSpecifier(false, undefined, name),
  );

  return ts.factory.createExportDeclaration(
    undefined,
    false,
    ts.factory.createNamedExports(exportSpecifiers),
    ts.factory.createStringLiteral(moduleName),
  );
}

export function generateCreateApiCall({
  server,
  identifier,
  endpointBuilder = defaultEndpointBuilder,
  endpointDefinitions,
  tags,
}: {
  server: string;
  identifier: string;
  endpointBuilder?: ts.Identifier;
  endpointDefinitions: ts.ObjectLiteralExpression;
  tags: string[];
}) {
  const baseQueryLiteralExpression = factory.createObjectLiteralExpression(
    generateObjectProperties({
      baseUrl: factory.createStringLiteral(server),
    }),
  );

  const baseQueryCallExpression = factory.createCallExpression(
    factory.createIdentifier(reduxIdentifiers.fetchBaseQuery),
    undefined,
    [baseQueryLiteralExpression],
  );

  const endpointsObjectLiteralExpression =
    factory.createObjectLiteralExpression(
      generateObjectProperties({
        reducerPath: factory.createStringLiteral(
          generateReducerPath(identifier),
          true,
        ),
        baseQuery: baseQueryCallExpression,
        tagTypes: factory.createArrayLiteralExpression(
          tags.map((tag) => factory.createStringLiteral(tag)),
          true,
        ),
        endpoints: factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              endpointBuilder,
              undefined,
              undefined,
              undefined,
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          factory.createParenthesizedExpression(endpointDefinitions),
        ),
      }),
      true,
    );

  return factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(generateApiSliceName(identifier)),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier(reduxIdentifiers.createApi),
            undefined,
            [endpointsObjectLiteralExpression],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

export function generateCreateEntityAdapterCall() {
  // this function generates the following code from the sample code:
  /*
        const entityAdapter = createEntityAdapter()
     */

  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(reduxIdentifiers.entityAdapterVarName),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier(reduxIdentifiers.createEntityAdapter),
            undefined,
            [],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

export function generateInitializeInitialState() {
  // this function generates the following code from the sample code:
  /*
        const initialState : EntityState<any> = entityAdapter.getInitialState({ids:[], entities:{}})
     */

  const argsArray = [
    factory.createObjectLiteralExpression(
      generateObjectProperties({
        ids: factory.createArrayLiteralExpression([]),
        entities: factory.createObjectLiteralExpression([]),
      }),
    ),
  ];

  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(reduxIdentifiers.initalStateVarName),
          undefined,
          factory.createTypeReferenceNode(
            factory.createIdentifier("EntityState"),
            [factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)],
          ),
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(reduxIdentifiers.entityAdapterVarName),
              factory.createIdentifier(reduxIdentifiers.getInitialState),
            ),
            undefined,
            argsArray,
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

export enum SelectorTypes {
  selectEntities,
  selectEntityById,
  selectIds,
}

export function generateSelectorIdentifier(
  identifier: string,
  selectorType: SelectorTypes,
): string {
  // generates selectTodos, selectTodoIds, selectTodoById
  return selectorType === SelectorTypes.selectEntities
    ? "select" + capitalize(identifier)
    : selectorType === SelectorTypes.selectIds
      ? "select" + capitalize(identifier) + "Ids"
      : "select" + capitalize(identifier) + "ById";
}

export function generateBaseSelectorsExportStatement(identifier: string) {
  // this function generates the following code from the sample code:
  /*
        export const selectTodos = entrySelectors.selectAll
        export const selectTodoIds = entrySelectors.selectIds
        export const selectTodoById = entrySelectors.selectById
     */

  // generates: export const selectTodos = entrySelectors.selectAll
  const selectAllSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(
            generateSelectorIdentifier(
              identifier,
              SelectorTypes.selectEntities,
            ),
          ),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier(
              reduxIdentifiers.entrySelectorsForApiSliceData,
            ),
            factory.createIdentifier("selectAll"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // generates: export const selectTodoIds = entrySelectors.selectIds
  const selectIdsSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(
            generateSelectorIdentifier(identifier, SelectorTypes.selectIds),
          ),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier(
              reduxIdentifiers.entrySelectorsForApiSliceData,
            ),
            factory.createIdentifier("selectIds"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // generates: export const selectTodoById = entrySelectors.selectById
  const selectByIdSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(
            generateSelectorIdentifier(
              identifier,
              SelectorTypes.selectEntityById,
            ),
          ),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier(
              reduxIdentifiers.entrySelectorsForApiSliceData,
            ),
            factory.createIdentifier("selectById"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  return [
    selectAllSelectorLiteral,
    selectIdsSelectorLiteral,
    selectByIdSelectorLiteral,
  ];
}

export function generateBaseSelectors(
  identifier: string,
  endpointToIndex: string,
) {
  // this function generates the following code from the sample code:
  /*
        const selectEntryResult = (state:any) =>
            tasksApiSlice.endpoints.getTasks.select()(state).data

        const entrySelectors = entryAdapter.getSelectors(
            (state) => selectEntryResult(state) ?? initialState
        )
        export const selectTodos = entrySelectors.selectAll
        export const selectTodoIds = entrySelectors.selectIds
        export const selectTodoById = entrySelectors.selectById
     */

  // generates: const selectEntryResult = (state:any) =>
  //             tasksApiSlice.endpoints.getTasks.select()(state).data
  const pickDataLiteralExpression = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(reduxIdentifiers.pickDataFromApiSlice),
          undefined,
          undefined,
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier(reduxIdentifiers.state),
                undefined,
                factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              ),
            ],
            undefined,
            undefined,
            factory.createPropertyAccessExpression(
              factory.createCallExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessChain(
                    factory.createPropertyAccessChain(
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier(
                          generateApiSliceName(identifier),
                        ),
                        factory.createIdentifier(
                          reduxIdentifiers.createApiResultEndpointsProperty,
                        ),
                      ),
                      undefined,
                      factory.createIdentifier(endpointToIndex),
                    ),
                    undefined,
                    factory.createIdentifier("select"),
                  ),
                  undefined,
                  [],
                ),
                undefined,
                [factory.createIdentifier(reduxIdentifiers.state)],
              ),
              factory.createIdentifier("data"),
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // generates: const entrySelectors = entryAdapter.getSelectors(
  //             (state) => selectEntryResult(state) ?? initialState
  //         )
  const callPickDataLiteralExpression = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(
            reduxIdentifiers.entrySelectorsForApiSliceData,
          ),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(reduxIdentifiers.entityAdapterVarName),
              factory.createIdentifier(reduxIdentifiers.getSelectors),
            ),
            undefined,
            [
              factory.createArrowFunction(
                undefined,
                undefined,
                [
                  factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    factory.createIdentifier(reduxIdentifiers.state),
                    undefined,
                    undefined,
                  ),
                ],
                undefined,
                undefined,
                factory.createBinaryExpression(
                  factory.createCallExpression(
                    factory.createIdentifier(
                      reduxIdentifiers.pickDataFromApiSlice,
                    ),
                    undefined,
                    [factory.createIdentifier(reduxIdentifiers.state)],
                  ),
                  factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
                  factory.createIdentifier(reduxIdentifiers.initalStateVarName),
                ),
              ),
            ],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const selectorExports = generateBaseSelectorsExportStatement(identifier);

  return [
    pickDataLiteralExpression,
    callPickDataLiteralExpression,
    ...selectorExports,
  ];
}

export function generateEndpointDefinition({
  operationName,
  RTKSliceName,
  verb,
  cacheKeyToOptimisticallyUpdate,
  optimisticPatchToApplyKey,
  optimisticPatchKey,
  isEndpointToIndex,
  indexResponseByKey,
  type,
  Response,
  QueryArg,
  queryFn,
  endpointBuilder = defaultEndpointBuilder,
  extraEndpointsProps,
  tags,
}: {
  operationName: string;
  RTKSliceName: string;
  verb: string;
  cacheKeyToOptimisticallyUpdate: string;
  optimisticPatchToApplyKey: string | undefined;
  optimisticPatchKey: string | undefined;
  isEndpointToIndex: boolean;
  indexResponseByKey: string | undefined;
  type: "query" | "mutation";
  Response: ts.TypeReferenceNode;
  QueryArg: ts.TypeReferenceNode;
  queryFn: ts.Expression;
  endpointBuilder?: ts.Identifier;
  extraEndpointsProps: ObjectPropertyDefinitions;
  tags: string[];
}) {
  const objectProperties = generateObjectProperties({
    query: queryFn,
    ...extraEndpointsProps,
  });
  if (tags.length > 0) {
    objectProperties.push(
      factory.createPropertyAssignment(
        factory.createIdentifier(
          type === "query" ? "providesTags" : "invalidatesTags",
        ),
        factory.createArrayLiteralExpression(
          tags.map((tag) => factory.createStringLiteral(tag), false),
        ),
      ),
    );
  }

  // if mutation endpoint, generate optimistic update code
  let optimisticUpdateMethodDeclaration = undefined;
  if (type === "mutation") {
    // if (optimisticPatchToApplyKey === undefined) {
    //     if (verb !== 'post')
    //   optimisticPatchToApplyKey = "requestBody.id";
    // }
    const optimisticUpdateGenerator = new OptimisticUpdateCodeGenerator(
      RTKSliceName,
      verb,
      cacheKeyToOptimisticallyUpdate,
      // @ts-ignore
      optimisticPatchKey,
      optimisticPatchToApplyKey,
    );
    optimisticUpdateMethodDeclaration = optimisticUpdateGenerator.generate();
  }

  // if the endpoint is the endpointToIndex, then generates:
  /*
        transformResponse: (responseData:Task[]) => {
                return entryAdapter.setAll(initialState, responseData)
            },
     */

  if (isEndpointToIndex) {
    let responseDataKeyToIndexExpression: ts.Expression =
      factory.createIdentifier("responseData");
    if (indexResponseByKey !== undefined) {
      responseDataKeyToIndexExpression = factory.createPropertyAccessExpression(
        factory.createIdentifier("responseData"),
        factory.createIdentifier(indexResponseByKey),
      );
    }

    objectProperties.push(
      factory.createPropertyAssignment(
        factory.createIdentifier("transformResponse"),
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier("responseData"),
              undefined,
              Response,
              undefined,
            ),
          ],
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(reduxIdentifiers.entityAdapterVarName),
              factory.createIdentifier("setAll"),
            ),
            undefined,
            [
              factory.createIdentifier(reduxIdentifiers.initalStateVarName),
              responseDataKeyToIndexExpression,
            ],
          ),
        ),
      ),
    );
  }

  let argsArray;
  if (optimisticUpdateMethodDeclaration !== undefined) {
    argsArray = factory.createObjectLiteralExpression(
      [optimisticUpdateMethodDeclaration, ...objectProperties],
      true,
    );
  } else {
    argsArray = factory.createObjectLiteralExpression(objectProperties, true);
  }

  return factory.createPropertyAssignment(
    factory.createIdentifier(operationName),

    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        endpointBuilder,
        factory.createIdentifier(type),
      ),
      [
        isEndpointToIndex
          ? factory.createTypeReferenceNode(
              factory.createIdentifier("EntityState"),
              [factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)],
            )
          : Response,
        QueryArg,
      ],
      [argsArray],
    ),
  );
}

export function generateTagTypes({ addTagTypes }: { addTagTypes: string[] }) {
  return factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("addTagTypes"),
          undefined,
          undefined,
          factory.createAsExpression(
            factory.createArrayLiteralExpression(
              addTagTypes.map((tagType) =>
                factory.createStringLiteral(tagType),
              ),
              true,
            ),
            factory.createTypeReferenceNode(
              factory.createIdentifier("const"),
              undefined,
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}
