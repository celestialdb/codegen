import { factory } from "./utils/factory";
import ts from "typescript";
import { capitalize } from "./utils";
import { reduxIdentifiers } from "./utils/reduxIdentifiers";
import { generateReducerPath, generateApiSliceName } from "./utils/naming";

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
        const initialState : EntityState<any> = entityAdapter.getInitialState()
     */

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
            [],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
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

  // generates: export const selectTodos = entrySelectors.selectAll
  const selectAllSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("select" + capitalize(identifier)),
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
          factory.createIdentifier("select" + capitalize(identifier) + "Ids"),
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
          factory.createIdentifier("select" + capitalize(identifier) + "ById"),
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
    pickDataLiteralExpression,
    callPickDataLiteralExpression,
    selectAllSelectorLiteral,
    selectIdsSelectorLiteral,
    selectByIdSelectorLiteral,
  ];
}

export function generateEndpointDefinition({
  operationName,
  isEndpointToIndex,
  type,
  Response,
  QueryArg,
  queryFn,
  endpointBuilder = defaultEndpointBuilder,
  extraEndpointsProps,
  tags,
}: {
  operationName: string;
  isEndpointToIndex: boolean;
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

  // if the endpoint is the endpointToIndex, then generates:
  /*
        transformResponse: (responseData:Task[]) => {
                return entryAdapter.setAll(initialState, responseData)
            },
     */
  // function adhocTypeGen() {
  //   // operation name is like so "getTasks"
  //   // returns "Task[]"
  //   return operationName.replace("get", "").slice(0, -1) + "[]";
  // }

  if (isEndpointToIndex) {
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
              // factory.createTypeReferenceNode(
              //   factory.createIdentifier(adhocTypeGen()),
              //   undefined,
              // ),
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
              factory.createIdentifier("responseData"),
            ],
          ),
        ),
      ),
    );
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
      [factory.createObjectLiteralExpression(objectProperties, true)],
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
