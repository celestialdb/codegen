import ts from "typescript";
import { factory } from "./utils/factory";
import { generateImportNode, generateObjectProperties } from "./codegen";
import { generateApiSliceName, generateReducerPath } from "./utils/naming";

function generateDataSliceImport(dataSlice: string) {
  return generateImportNode(`./${generateApiSliceName(dataSlice)}.ts`, {
    [generateApiSliceName(dataSlice)]: generateApiSliceName(dataSlice),
  });
}

function generateStoreReducerExpression(dataSlices: string[]) {
  // generates:
  /*
        {
            tasks: tasksApiSlice.reducer,
            colors: colorsApiSlice.reducer,
            status: statusApiSlice.reducer,
            test: testApiSlice.reducer,
            cache: cacheReducer,
        }
     */

  const dataSliceReducerMappingExpression = dataSlices.map((dataSlice) => {
    return factory.createPropertyAssignment(
      factory.createIdentifier(generateReducerPath(dataSlice)),
      factory.createPropertyAccessExpression(
        factory.createIdentifier(generateApiSliceName(dataSlice)),
        factory.createIdentifier("reducer"),
      ),
    );
  });

  return factory.createObjectLiteralExpression([
    ...dataSliceReducerMappingExpression,
    factory.createPropertyAssignment(
      factory.createIdentifier("cache"),
      factory.createIdentifier("cacheReducer"),
    ),
  ]);
}

function generateStoreMiddlewareExpression(dataSlices: string[]) {
  // generates:
  /*
        (getDefaultMiddleware) => getDefaultMiddleware()
          .concat(tasksApiSlice.middleware)
          .concat(colorsApiSlice.middleware)
          .concat(statusApiSlice.middleware)
          .concat(testApiSlice.middleware),
     */

  function generate(dataSlices: string[], index: number): ts.Expression {
    if (index === dataSlices.length) {
      return factory.createCallExpression(
        factory.createIdentifier("getDefaultMiddleware"),
        undefined,
        [],
      );
    }

    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        generate(dataSlices, index + 1),
        factory.createIdentifier("concat"),
      ),
      undefined,
      [
        factory.createPropertyAccessExpression(
          factory.createIdentifier(generateApiSliceName(dataSlices[index])),
          factory.createIdentifier("middleware"),
        ),
      ],
    );
  }

  return factory.createArrowFunction(
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("getDefaultMiddleware"),
        undefined,
        undefined,
      ),
    ],
    undefined,
    undefined,
    generate(dataSlices, 0),
  );
}

function generateConfigureStore(dataSlices: string[]): ts.Statement[] {
  // generates:
  /*
        export default const store = configureStore({
            reducer: {
                tasks: tasksApiSlice,
                colors: colorsApiSlice,
                status: statusApiSlice,
                test: testApiSlice,
                cache: cacheReducer,
            },
            middleware: (getDefaultMiddleware) => getDefaultMiddleware()
              .concat(tasksApiSlice.middleware)
              .concat(colorsApiSlice.middleware)
              .concat(statusApiSlice.middleware)
              .concat(testApiSlice.middleware),
     */

  const configureStoreExpression = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList([
      factory.createVariableDeclaration(
        factory.createIdentifier("store"),
        undefined,
        undefined,
        factory.createCallExpression(
          factory.createIdentifier("configureStore"),
          undefined,
          [
            factory.createObjectLiteralExpression(
              generateObjectProperties({
                reducer: generateStoreReducerExpression(dataSlices),
                middleware: generateStoreMiddlewareExpression(dataSlices),
              }),
              true,
            ),
          ],
        ),
      ),
    ]),
  );

  // generates:
  /*
        setupListeners(store.dispatch)
     */
  const storeSetupListenersExpression = factory.createExpressionStatement(
    factory.createCallExpression(
      factory.createIdentifier("setupListeners"),
      undefined,
      [
        factory.createPropertyAccessExpression(
          factory.createIdentifier("store"),
          factory.createIdentifier("dispatch"),
        ),
      ],
    ),
  );

  // generates:
  /*
        export default store
     */
  const exportStoreExpression = factory.createExportDefault(
    factory.createIdentifier("store"),
  );

  return [
    configureStoreExpression,
    storeSetupListenersExpression,
    exportStoreExpression,
  ];
}

export async function generateStore(dataSlices: string[]) {
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
          ["configureStore"]: "configureStore",
        }),
        generateImportNode("@reduxjs/toolkit/query/react", {
          ["setupListeners"]: "setupListeners",
        }),
        // generates: import {tasksApiSlice} from "./dataApi/tasksApiSlice";
        // for all dataSlices created from user provided configuration
        ...dataSlices.map(generateDataSliceImport),
        // generates: import {} from import filtersReducer from './dataApi/filtersSlice'
        generateImportNode("./cache.ts", {
          ["cacheReducer"]: "cacheReducer",
        }),
        ...generateConfigureStore(dataSlices),
      ],
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    ),
    resultFile,
  );
}
