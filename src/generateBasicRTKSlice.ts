import ts from "typescript";
import { factory } from "./utils/factory";
import { generateImportNode } from "./codegen";

function generateSliceExpressions(): ts.Statement[] {
  // generates:
  /*
        const cache = createSlice({
            name: 'cache',
            initialState,
            reducers: {
                updateCache: {
                    reducer(state, action) {
                        const { key, value } = action.payload
                        // @ts-ignore
                        state[key] = value
                    },
                    prepare(key, value) {
                        return {
                            payload: { key, value },
                        }
                    },
                },
            },
        })

        export const { updateCache } = cache.actions
        export default cache.reducer
        export const selectCache = (state:any) => state.cache
     */

  // generates:
  /*
        reducer(state, action) {
            const { key, value } = action.payload
            // @ts-ignore
            state[key] = value
        }
     */
  function reducerWPrepareReducerKeyFunctionDefinition() {
    const keyIdentifier = factory.createIdentifier("key");
    const valueIdentifier = factory.createIdentifier("value");
    const actionPayloadProperty = factory.createPropertyAccessExpression(
      factory.createIdentifier("action"),
      factory.createIdentifier("payload"),
    );
    const destructureKeyValue = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createObjectBindingPattern([
              factory.createBindingElement(
                undefined,
                undefined,
                keyIdentifier,
                undefined,
              ),
              factory.createBindingElement(
                undefined,
                undefined,
                valueIdentifier,
                undefined,
              ),
            ]),
            undefined,
            undefined,
            actionPayloadProperty,
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
    const stateKeyAccess = factory.createElementAccessExpression(
      factory.createIdentifier("state"),
      keyIdentifier,
    );
    const assignment = factory.createExpressionStatement(
      factory.createBinaryExpression(
        stateKeyAccess,
        factory.createToken(ts.SyntaxKind.EqualsToken),
        valueIdentifier,
      ),
    );
    ts.addSyntheticLeadingComment(
      assignment,
      ts.SyntaxKind.SingleLineCommentTrivia,
      "@ts-ignore",
      true,
    );

    return factory.createBlock([destructureKeyValue, assignment], true);
  }

  const reducerWPrepareReducerKey = factory.createMethodDeclaration(
    undefined,
    undefined,
    factory.createIdentifier("reducer"),
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("state"),
        undefined,
        undefined,
        undefined,
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("action"),
        undefined,
        undefined,
        undefined,
      ),
    ],
    undefined,
    reducerWPrepareReducerKeyFunctionDefinition(),
  );

  // generates:
  /*
        prepare(key, value) {
            return {
                payload: { key, value },
            }
        }
     */

  function reducerWPreparePrepareKeyFunctionDefinition() {
    const returnValue = factory.createObjectLiteralExpression(
      [
        factory.createPropertyAssignment(
          factory.createIdentifier("payload"),
          factory.createObjectLiteralExpression([
            factory.createShorthandPropertyAssignment(
              factory.createIdentifier("key"),
            ),
            factory.createShorthandPropertyAssignment(
              factory.createIdentifier("value"),
            ),
          ]),
        ),
        factory.createPropertyAssignment(
          factory.createIdentifier("meta"),
          factory.createIdentifier("undefined"),
        ),
        factory.createPropertyAssignment(
          factory.createIdentifier("error"),
          factory.createIdentifier("undefined"),
        ),
      ],
      true,
    );

    return factory.createBlock(
      [factory.createReturnStatement(returnValue)],
      true,
    );
  }

  const reducerWPreparePrepareKey = factory.createMethodDeclaration(
    undefined,
    undefined,
    factory.createIdentifier("prepare"),
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("key"),
        undefined,
        undefined,
        undefined,
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("value"),
        undefined,
        undefined,
        undefined,
      ),
    ],
    undefined,
    reducerWPreparePrepareKeyFunctionDefinition(),
  );

  // generates:
  /*
        {
            updateCache: {
                reducer...,
                prepare...
            },
        },
     */
  const reducerDefinition = factory.createObjectLiteralExpression([
    factory.createPropertyAssignment(
      factory.createIdentifier("updateCache"),
      factory.createObjectLiteralExpression([
        reducerWPrepareReducerKey,
        reducerWPreparePrepareKey,
      ]),
    ),
  ]);

  // generates:
  /*
        const cache = createSlice({
            name: 'cache',
            initialState,
            reducers: ...
        })
     */
  const sliceExpression = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("cache"),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier("createSlice"),
            undefined,
            [
              factory.createObjectLiteralExpression([
                factory.createPropertyAssignment(
                  factory.createIdentifier("name"),
                  factory.createStringLiteral("cache"),
                ),
                factory.createPropertyAssignment(
                  factory.createIdentifier("initialState"),
                  factory.createIdentifier("initialState"),
                ),
                factory.createPropertyAssignment(
                  factory.createIdentifier("reducers"),
                  reducerDefinition,
                ),
              ]),
            ],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // generates:
  /*
        const { updateCache } = cache.actions
        export default cache.reducer

     */
  const sliceExportExpressions: ts.Statement[] = [
    factory.createVariableStatement(
      [],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createObjectBindingPattern([
              factory.createBindingElement(
                undefined,
                undefined,
                factory.createIdentifier("updateCache"),
                undefined,
              ),
            ]),
            undefined,
            undefined,
            factory.createPropertyAccessExpression(
              factory.createIdentifier("cache"),
              factory.createIdentifier("actions"),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    ),
    factory.createExportDefault(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("cache"),
        factory.createIdentifier("reducer"),
      ),
    ),
  ];

  // generates:
  /*
        export const selectCache = (state:any) => state.cache
     */
  const createAndExportSelectorExpression = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("selectCache"),
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
                factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                undefined,
              ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            factory.createPropertyAccessExpression(
              factory.createIdentifier("state"),
              factory.createIdentifier("cache"),
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  return [
    sliceExpression,
    ...sliceExportExpressions,
    createAndExportSelectorExpression,
  ];
}

function generateUseCacheInitFunction() {
  // generates:
  /*
        export function useCacheInit(key:string, value:any) {
          const dispatch = useDispatch();

          useEffect(() => {
            dispatch(updateCache(key, value));
          }, []);
        }
     */

  const dispatchDeclaration = factory.createVariableDeclaration(
    "dispatch",
    undefined,
    undefined,
    ts.factory.createCallExpression(
      ts.factory.createIdentifier("useDispatch"),
      undefined,
      [],
    ),
  );

  const dispatchStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [dispatchDeclaration],
      ts.NodeFlags.Const,
    ),
  );

  const useEffectExpression = factory.createExpressionStatement(
    factory.createCallExpression(
      factory.createIdentifier("useEffect"),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          factory.createBlock(
            [
              factory.createExpressionStatement(
                factory.createCallExpression(
                  factory.createIdentifier("dispatch"),
                  undefined,
                  [
                    factory.createCallExpression(
                      factory.createIdentifier("updateCache"),
                      undefined,
                      [
                        factory.createIdentifier("key"),
                        factory.createIdentifier("value"),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            true,
          ),
        ),
        factory.createArrayLiteralExpression([], false),
      ],
    ),
  );

  const functionStatementBlock = factory.createBlock(
    [dispatchStatement, useEffectExpression],
    true,
  );

  return factory.createFunctionDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    factory.createIdentifier("useCacheInit"),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("key"),
        undefined,
        factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        undefined,
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("value"),
        undefined,
        factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        undefined,
      ),
    ],
    undefined,
    functionStatementBlock,
  );
}

function generateUseCacheUpdateFunction() {
  // generates:
  /*
        export function useCacheUpdate() {
          const dispatch = useDispatch();

          return (key: string, value: any) => {
            dispatch(updateCache(key, value));
          };
        }
     */
  const dispatchDeclaration = factory.createVariableDeclaration(
    "dispatch",
    undefined,
    undefined,
    ts.factory.createCallExpression(
      ts.factory.createIdentifier("useDispatch"),
      undefined,
      [],
    ),
  );

  const dispatchStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [dispatchDeclaration],
      ts.NodeFlags.Const,
    ),
  );

  const returnStatement = factory.createReturnStatement(
    factory.createArrowFunction(
      undefined,
      undefined,
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier("key"),
          undefined,
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          undefined,
        ),
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier("value"),
          undefined,
          factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          undefined,
        ),
      ],
      undefined,
      undefined,
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createIdentifier("dispatch"),
              undefined,
              [
                factory.createCallExpression(
                  factory.createIdentifier("updateCache"),
                  undefined,
                  [
                    factory.createIdentifier("key"),
                    factory.createIdentifier("value"),
                  ],
                ),
              ],
            ),
          ),
        ],
        true,
      ),
    ),
  );

  return factory.createFunctionDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    factory.createIdentifier("useCacheUpdate"),
    undefined,
    [],
    undefined,
    factory.createBlock([dispatchStatement, returnStatement]),
  );
}

export async function generateBasicRTKSlice() {
  // generates:
  /*
        import {createSlice} from '@reduxjs/toolkit'

        const initialState = {}

        const cache = createSlice({
            name: 'cache',
            initialState,
            reducers: {
                updateCache: {
                    reducer(state, action) {
                        const { key, value } = action.payload
                        // @ts-ignore
                        state[key] = value
                    },
                    prepare(key, value) {
                        return {
                            payload: { key, value },
                        }
                    },
                },
            },
        })

        const { updateCache } = cache.actions
        export default cache.reducer
        export const selectCache = (state:any) => state.cache


        export function useCacheInit(key:string, value:any) {
          const dispatch = useDispatch();

          useEffect(() => {
            dispatch(updateCache(key, value));
          }, []);
        }

        export function useCacheUpdate() {
          const dispatch = useDispatch();

          return (key: string, value: any) => {
            dispatch(updateCache(key, value));
          };
        }

     */

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
        generateImportNode("@reduxjs/toolkit", {
          ["createSlice"]: "createSlice",
        }),
        generateImportNode("react", {
          ["useEffect"]: "useEffect",
        }),
        generateImportNode("react-redux", {
          ["useDispatch"]: "useDispatch",
        }),
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier("initialState"),
                undefined,
                undefined,
                factory.createObjectLiteralExpression(),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        ...generateSliceExpressions(),
        generateUseCacheInitFunction(),
        generateUseCacheUpdateFunction(),
      ],
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    ),
    resultFile,
  );
}
