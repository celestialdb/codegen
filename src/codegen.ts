import { factory } from "./utils/factory";
import ts from "typescript";
import { forEach } from "lodash";

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

export function generateCreateApiCall2({
  endpointBuilder = defaultEndpointBuilder,
  endpointDefinitions,
  tag,
}: {
  endpointBuilder?: ts.Identifier;
  endpointDefinitions: ts.ObjectLiteralExpression;
  tag: boolean;
}) {
  const injectEndpointsObjectLiteralExpression =
    factory.createObjectLiteralExpression(
      generateObjectProperties({
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
        overrideExisting: factory.createFalse(),
      }),
      true,
    );
  if (tag) {
    const enhanceEndpointsObjectLiteralExpression =
      factory.createObjectLiteralExpression(
        [
          factory.createShorthandPropertyAssignment(
            factory.createIdentifier("addTagTypes"),
            undefined,
          ),
        ],
        true,
      );

    return factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier("injectedRtkApi"),
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier("api"),
                    factory.createIdentifier("enhanceEndpoints"),
                  ),
                  undefined,
                  [enhanceEndpointsObjectLiteralExpression],
                ),
                factory.createIdentifier("injectEndpoints"),
              ),
              undefined,
              [injectEndpointsObjectLiteralExpression],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("injectedRtkApi"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("api"),
              factory.createIdentifier("injectEndpoints"),
            ),
            undefined,
            [injectEndpointsObjectLiteralExpression],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

export function generateApiSliceName(name: string) {
  return name;
}

export function generateCreateApiCall({
  endpointBuilder = defaultEndpointBuilder,
  endpointDefinitions,
  tags,
}: {
  endpointBuilder?: ts.Identifier;
  endpointDefinitions: ts.ObjectLiteralExpression;
  tags: string[];
}) {
  const baseQueryLiteralExpression = factory.createObjectLiteralExpression(
    generateObjectProperties({
      baseUrl: factory.createStringLiteral("https://api.example.com"),
    }),
  );

  const baseQueryCallExpression = factory.createCallExpression(
    factory.createIdentifier("fetchBaseQuery"),
    undefined,
    [baseQueryLiteralExpression],
  );

  const endpointsObjectLiteralExpression =
    factory.createObjectLiteralExpression(
      generateObjectProperties({
        reducerPath: factory.createStringLiteral("testReducer", true),
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
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("injectedRtkApi"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier("createApi"),
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
          factory.createIdentifier("entityAdapter"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier("createEntityAdapter"),
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
        const initialState = entityAdapter.getInitialState()
     */

  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("initialState"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("entityAdapter"),
              factory.createIdentifier("getInitialState"),
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

export function generateBaseSelectors() {
  // this function generates the following code from the sample code:
  /*
        export const selectEntryResult = (state) =>
            tasksApiSlice.endpoints.getTasks.select()(state).data

        const entrySelectors = entryAdapter.getSelectors(
            (state) => selectEntryResult(state) ?? initialState
        )
        export const selectTodos = entrySelectors.selectAll
        export const selectTodoIds = entrySelectors.selectIds
        export const selectTodoById = entrySelectors.selectById
     */

  // generates: export const selectEntryResult = (state) =>
  //             tasksApiSlice.endpoints.getTasks.select()(state).data
  const pickDataLiteralExpression = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("testingTesting"),
          undefined,
          undefined,
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier("state"),
                undefined,
                undefined,
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
                        factory.createIdentifier("injectedRtkApi"),
                        factory.createIdentifier("endpoints"),
                      ),
                      undefined,
                      factory.createIdentifier("getTasks"),
                    ),
                    undefined,
                    factory.createIdentifier("select"),
                  ),
                  undefined,
                  [],
                ),
                undefined,
                [factory.createIdentifier("state")],
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
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("testingTestingSelectors"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("testingTesting"),
              factory.createIdentifier("getSelectors"),
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
                    factory.createIdentifier("state"),
                    undefined,
                    undefined,
                  ),
                ],
                undefined,
                undefined,
                factory.createBinaryExpression(
                  factory.createCallExpression(
                    factory.createIdentifier("testingTesting"),
                    undefined,
                    [factory.createIdentifier("state")],
                  ),
                  factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
                  factory.createIdentifier("initialState"),
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
  //         export const selectTodoIds = entrySelectors.selectIds
  //         export const selectTodoById = entrySelectors.selectById

  const selectAllSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("selectTodos"),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier("testingTestingSelectors"),
            factory.createIdentifier("selectAll"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const selectIdsSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("selectTodoIds"),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier("testingTestingSelectors"),
            factory.createIdentifier("selectIds"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const selectByIdSelectorLiteral = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("selectTodoById"),
          undefined,
          undefined,
          factory.createPropertyAccessExpression(
            factory.createIdentifier("testingTestingSelectors"),
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
  type,
  Response,
  QueryArg,
  queryFn,
  endpointBuilder = defaultEndpointBuilder,
  extraEndpointsProps,
  tags,
}: {
  operationName: string;
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
  return factory.createPropertyAssignment(
    factory.createIdentifier(operationName),

    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        endpointBuilder,
        factory.createIdentifier(type),
      ),
      [Response, QueryArg],
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
