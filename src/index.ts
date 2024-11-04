import fs from "node:fs";
import path from "node:path";
import type {
  CommonOptions,
  ConfigFile,
  GenerationOptions,
  OutputFileOptions,
} from "./types";
import { isValidUrl, prettify } from "./utils";
import { generateApiSliceName } from "./utils/naming";
export type { ConfigFile } from "./types";

async function generateEndpoints(
  tags: string[],
  openAPISpec: string,
  outputFolder: string,
): Promise<string | void> {
  const schemaAbsPath = isValidUrl(openAPISpec)
    ? openAPISpec
    : path.resolve(process.cwd(), openAPISpec);

  for (let tag of tags) {
    console.log("--- Generating RTK Api slice for collection: ", tag);
    const options: GenerationOptions = {
      schemaFile: openAPISpec,
      outputFolder: outputFolder,
      key: tag, // to be filled in later
      hooks: true,
      tag: true,
    };
    const identifier = options.key;

    const sourceCode = await enforceOazapftsTsVersion(async () => {
      const { generateApi } = await import("./generate");
      return generateApi(schemaAbsPath, options);
    });

    const outputFile = path.join(
      // "/Users/kriti/celestial/ex/code-gen-test",
      outputFolder,
      `${generateApiSliceName(identifier)}.ts`,
      // `${identifier}Data.ts`,
    );
    fs.writeFileSync(
      path.resolve(process.cwd(), outputFile),
      await prettify(outputFile, sourceCode),
    );
  }
}

async function generateStoreConfig(tags: string[], outputFolder: string) {
  const { generateStore } = await import("./generateStore");
  // const tags = ["tasks", "colors", "status"]
  const sourceCode = await generateStore(tags);

  const outputFile = path.join(outputFolder, "store.ts");

  // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/store.ts";
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, sourceCode),
  );
}

async function generateBasicRTKSlice(outputFolder: string) {
  const { generateBasicRTKSlice } = await import("./generateBasicRTKSlice");
  const sourceCode = await generateBasicRTKSlice();

  const outputFile = path.join(outputFolder, "cache.ts");

  // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/cache.ts";
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, sourceCode),
  );
}

async function generateIndexFile(
  tags: string[],
  OpenAPISpec: string,
  outputFolder: string,
) {
  const schemaAbsPath = isValidUrl(OpenAPISpec)
    ? OpenAPISpec
    : path.resolve(process.cwd(), OpenAPISpec);
  const outputFile = path.join(outputFolder, "index.ts");

  const { generateIndexFile } = await import("./generateIndexFile");

  const options: GenerationOptions = {
    schemaFile: OpenAPISpec,
    outputFolder: outputFolder,
    key: "", // to be filled in later
    hooks: true,
    tag: true,
  };

  // generate for cache
  console.log("--- Generating exports for cache");
  const cacheExports = await generateIndexFile(true, schemaAbsPath, options);
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, cacheExports),
  );

  console.log("--- Generating exports for RTK api slices");
  // generate for tags
  for (let tag of tags) {
    options["key"] = tag.toLowerCase();
    const sourceCode = await generateIndexFile(false, schemaAbsPath, options);
    // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/index.ts";
    fs.appendFileSync(
      path.resolve(process.cwd(), outputFile),
      await prettify(outputFile, sourceCode),
    );
  }
}

function parseConfig(fullConfig: ConfigFile) {
  const outFiles: (CommonOptions & OutputFileOptions)[] = [];

  if ("outputFiles" in fullConfig) {
    const { outputFiles, ...commonConfig } = fullConfig;
    for (const [outputFile, specificConfig] of Object.entries(outputFiles)) {
      outFiles.push({
        ...commonConfig,
        ...specificConfig,
        outputFile,
      });
    }
  } else {
    outFiles.push(fullConfig);
  }
  return outFiles;
}

/**
 * Enforces `oazapfts` to use the same TypeScript version as this module itself uses.
 * That should prevent enums from running out of sync if both libraries use different TS versions.
 */
function enforceOazapftsTsVersion<T>(cb: () => T): T {
  const ozTsPath = require.resolve("typescript", {
    paths: [require.resolve("oazapfts")],
  });
  const tsPath = require.resolve("typescript");
  const originalEntry = require.cache[ozTsPath];
  try {
    require.cache[ozTsPath] = require.cache[tsPath];
    return cb();
  } finally {
    if (originalEntry) {
      require.cache[ozTsPath] = originalEntry;
    } else {
      delete require.cache[ozTsPath];
    }
  }
}

export async function generateRTKDefs(
  tags: string[],
  OpenAPISpec: string,
  outputFolder: string,
) {
  console.log("Generation API slices");
  await generateEndpoints(tags, OpenAPISpec, outputFolder);
  console.log();

  console.log("====================");
  console.log("Generating entrypoint file");
  await generateIndexFile(tags, OpenAPISpec, outputFolder);
  console.log();

  console.log("====================");
  console.log("Generating store config");
  await generateStoreConfig(tags, outputFolder);
  console.log();

  console.log("====================");
  console.log("Generating basic RTK slice for local state management");
  await generateBasicRTKSlice(outputFolder);
  console.log();
  // summary of generation
}
