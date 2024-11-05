import * as ts from "typescript";
import { factory, SyntaxKind } from "typescript";

export class OptimisticUpdateCodeGenerator {
  private verb: string;
  private cacheKeyToUpdate: string;
  private updateObjectKey: string;
  private endpointPk: string;

  public constructor(
    verb: string,
    cacheKeyToUpdate: string,
    updateObjectKey: string,
    endpointPk: string,
  ) {
    this.verb = verb;
    this.cacheKeyToUpdate = cacheKeyToUpdate;
    this.updateObjectKey = updateObjectKey;
    this.endpointPk = endpointPk;
  }

  public generate() {
    let cacheModificationBlock: ts.Block;

    if (this.verb === "post") {
      cacheModificationBlock = this.generatePost();
    } else if (this.verb === "put") {
      cacheModificationBlock = this.generatePut();
    } else if (this.verb === "delete") {
      cacheModificationBlock = this.generateDelete();
    } else {
      throw new Error(`Unsupported verb: ${this.verb}`);
    }

    // generates:
    /*
            dispatch(
                tasksData.util.updateQueryData('getTasks', undefined, (cache) => {
                cacheModificationBlock
            })
         */
    const dispatchCall = factory.createCallExpression(
      factory.createIdentifier("dispatch"),
      undefined,
      [
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("tasksData"),
              factory.createIdentifier("util"),
            ),
            factory.createIdentifier("updateQueryData"),
          ),
          undefined,
          [
            factory.createStringLiteral(this.cacheKeyToUpdate),
            factory.createIdentifier("undefined"),
            factory.createArrowFunction(
              undefined,
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "cache",
                ),
              ],
              undefined,
              ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), // Arrow `=>` token
              cacheModificationBlock,
            ),
          ],
        ),
      ],
    );

    // generates
    /*
            async onQueryStarted({ ...patch }, { dispatch, queryFulfilled }) {
                dispatchCall
            }
         */
    const functionExpression = factory.createMethodDeclaration(
      [factory.createModifier(SyntaxKind.AsyncKeyword)],
      undefined,
      factory.createIdentifier("onQueryStarted"),
      undefined,
      undefined,
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createObjectBindingPattern([
            factory.createBindingElement(
              ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
              undefined,
              factory.createIdentifier("patch"),
            ),
          ]),
        ),
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createObjectBindingPattern([
            factory.createBindingElement(
              undefined,
              undefined,
              factory.createIdentifier("dispatch"),
            ),
            factory.createBindingElement(
              undefined,
              undefined,
              factory.createIdentifier("queryFulfilled"),
            ),
          ]),
        ),
      ],
      undefined,
      factory.createBlock(
        [factory.createExpressionStatement(dispatchCall)],
        true,
      ),
    );

    return functionExpression;
  }

  private generatePost(): ts.Block {
    // generates:
    /*
          Object.assign(patch.newTask, {id:0})
          Object.assign(cache.entities, {0:patch.newTask})
          cache.ids.push(0)
         */

    const addIdKeyStatement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          factory.createIdentifier("assign"),
        ),
        undefined,
        [
          factory.createPropertyAccessExpression(
            factory.createIdentifier("patch"),
            factory.createIdentifier(this.updateObjectKey),
          ),
          factory.createObjectLiteralExpression(
            [
              factory.createPropertyAssignment(
                "id",
                factory.createNumericLiteral("0"),
              ),
            ],
            false,
          ),
        ],
      ),
    );

    const addUpdateToCacheEntitiesStatement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          factory.createIdentifier("assign"),
        ),
        undefined,
        [
          factory.createPropertyAccessExpression(
            factory.createIdentifier("cache"),
            factory.createIdentifier("entities"),
          ),
          factory.createObjectLiteralExpression(
            [
              factory.createPropertyAssignment(
                "0",
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("patch"),
                  factory.createIdentifier(this.updateObjectKey),
                ),
              ),
            ],
            false,
          ),
        ],
      ),
    );

    const addUpdateToCacheIdsStatement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("cache"),
            factory.createIdentifier("ids"),
          ),
          factory.createIdentifier("push"),
        ),
        undefined,
        [factory.createNumericLiteral("0")],
      ),
    );

    return factory.createBlock(
      [
        addIdKeyStatement,
        addUpdateToCacheEntitiesStatement,
        addUpdateToCacheIdsStatement,
      ],
      true,
    );
  }

  private generatePut(): ts.Block {
    // generates:
    /*
            const replacement = cache.entities[patch.updateTaskColor.task_id]
            // upsert patch into replacement
          Object.assign(replacement, patch.updateTaskColor)
          Object.assign(cache.entities, replacement)
         */

    const replacementDeclaration = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            "replacement",
            undefined,
            undefined,
            ts.factory.createElementAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("cache"),
                ts.factory.createIdentifier("entities"),
              ),
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("patch"),
                  ts.factory.createIdentifier(this.updateObjectKey),
                ),
                ts.factory.createIdentifier(this.endpointPk),
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    const upsertPatchIntoReplacement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          factory.createIdentifier("assign"),
        ),
        undefined,
        [
          factory.createIdentifier("replacement"),
          factory.createPropertyAccessExpression(
            factory.createIdentifier("patch"),
            factory.createIdentifier(this.updateObjectKey),
          ),
        ],
      ),
    );

    const addUpdateToCacheEntitiesStatement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          factory.createIdentifier("assign"),
        ),
        undefined,
        [
          factory.createPropertyAccessExpression(
            factory.createIdentifier("cache"),
            factory.createIdentifier("entities"),
          ),
          factory.createIdentifier("replacement"),
        ],
      ),
    );

    return factory.createBlock(
      [
        replacementDeclaration,
        upsertPatchIntoReplacement,
        addUpdateToCacheEntitiesStatement,
      ],
      true,
    );
  }

  private generateDelete(): ts.Block {
    // generates:
    /*
            const index = cache.ids.indexOf(patch.deleteTask.task_id);
              cache.ids.splice(index, 1);
              delete cache.entities[task_id]
         */

    const indexToDeleteAssignment = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            "index",
            undefined,
            undefined,
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("cache"),
                  ts.factory.createIdentifier("ids"),
                ),
                factory.createIdentifier("indexOf"),
              ),
              undefined,
              [
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier("patch"),
                    ts.factory.createIdentifier(this.updateObjectKey),
                  ),
                  ts.factory.createIdentifier(this.endpointPk),
                ),
              ],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    const spliceIndexStatement = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("cache"),
            factory.createIdentifier("ids"),
          ),
          factory.createIdentifier("splice"),
        ),
        undefined,
        [factory.createIdentifier("index"), factory.createNumericLiteral("1")],
      ),
    );

    const deleteEntityStatement = factory.createExpressionStatement(
      factory.createDeleteExpression(
        factory.createElementAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("cache"),
            factory.createIdentifier("entities"),
          ),
          factory.createPropertyAccessExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("patch"),
              factory.createIdentifier(this.updateObjectKey),
            ),
            factory.createIdentifier(this.endpointPk),
          ),
        ),
      ),
    );

    return factory.createBlock(
      [indexToDeleteAssignment, spliceIndexStatement, deleteEntityStatement],
      true,
    );
  }
}
