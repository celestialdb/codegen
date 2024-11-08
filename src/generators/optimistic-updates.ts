import * as ts from "typescript";
import { factory, SyntaxKind } from "typescript";

export class OptimisticUpdateCodeGenerator {
  private RTKSliceName: string;
  private verb: string;
  private cacheKeyToUpdate: string;
  private updateObjectKey: string;
  private endpointPk: string;

  public constructor(
    RTKSliceName: string,
    verb: string,
    cacheKeyToUpdate: string,
    updateObjectKey: string,
    endpointPk: string,
  ) {
    this.RTKSliceName = RTKSliceName;
    this.verb = verb;
    this.cacheKeyToUpdate = cacheKeyToUpdate;
    this.updateObjectKey = updateObjectKey;
    this.endpointPk = endpointPk;
    if (this.endpointPk === undefined) {
      if (verb !== "post") {
        throw new Error(
          `x-celestial-updateByKey is required for non-POST verbs`,
        );
      } else {
        this.endpointPk = "id";
      }
    }
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
              factory.createIdentifier(this.RTKSliceName),
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
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), // Arrow `=>` token
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
              factory.createToken(ts.SyntaxKind.DotDotDotToken),
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

  private generateIdToUpdateCacheBy(): ts.PropertyAccessExpression {
    // check if this.endpointPk is of the form
    // parameters.id or requestBody.id
    const updateKeyPath = this.endpointPk.split(".");
    if (
      !(
        updateKeyPath.length === 2 &&
        (updateKeyPath[0] === "parameters" ||
          updateKeyPath[0] === "requestBody")
      )
    ) {
      throw new Error(
        `x-celestial-updateByKey must be of the form parameters.id or requestBody.id. You have provided: ${this.endpointPk}`,
      );
    }

    if (updateKeyPath[0] === "requestBody") {
      // return patch.updateObjectKey.endpointPk[1]
      return factory.createPropertyAccessExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("patch"),
          factory.createIdentifier(this.updateObjectKey),
        ),
        factory.createIdentifier(updateKeyPath[1]),
      );
    } else {
      // return patch.endpointPk[1]
      return factory.createPropertyAccessExpression(
        factory.createIdentifier("patch"),
        factory.createIdentifier(updateKeyPath[1]),
      );
    }
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
          Object.assign(cache.entities[patch.updateTaskColor.task_id], replacement);
         */

    const replacementDeclaration = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            "replacement",
            undefined,
            undefined,
            factory.createElementAccessExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("cache"),
                factory.createIdentifier("entities"),
              ),
              this.generateIdToUpdateCacheBy(),
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
          factory.createElementAccessExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("cache"),
              factory.createIdentifier("entities"),
            ),
            this.generateIdToUpdateCacheBy(),
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
              delete cache.entities[patch.deleteTask.task_id]
         */

    const indexToDeleteAssignment = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            "index",
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("cache"),
                  factory.createIdentifier("ids"),
                ),
                factory.createIdentifier("indexOf"),
              ),
              undefined,
              [this.generateIdToUpdateCacheBy()],
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
          this.generateIdToUpdateCacheBy(),
        ),
      ),
    );

    return factory.createBlock(
      [indexToDeleteAssignment, spliceIndexStatement, deleteEntityStatement],
      true,
    );
  }
}
