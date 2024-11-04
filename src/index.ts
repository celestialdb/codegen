import fs from "node:fs";
import path, { resolve } from "node:path";
import type {
  CommonOptions,
  ConfigFile,
  GenerationOptions,
  OutputFileOptions,
} from "./types";
import { isValidUrl, prettify } from "./utils";
import { generateApiSliceName } from "./utils/naming";
export type { ConfigFile } from "./types";

export async function generateEndpoints(
  options: GenerationOptions,
): Promise<string | void> {
  const identifier = options.key;
  const schemaLocation = options.schemaFile;
  const outputFolder = options.outputFolder;

  const schemaAbsPath = isValidUrl(options.schemaFile)
    ? options.schemaFile
    : path.resolve(process.cwd(), schemaLocation);

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

export async function generateStoreConfig(
  tags: string[],
  options: GenerationOptions,
) {
  const { generateStore } = await import("./generateStore");
  // const tags = ["tasks", "colors", "status"]
  const sourceCode = await generateStore(tags);

  const outputFolder = options.outputFolder;
  const outputFile = path.join(outputFolder, "store.ts");

  // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/store.ts";
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, sourceCode),
  );
}

export async function generateBasicRTKSlice(options: GenerationOptions) {
  const { generateBasicRTKSlice } = await import("./generateBasicRTKSlice");
  const sourceCode = await generateBasicRTKSlice();

  const outputFolder = options.outputFolder;
  const outputFile = path.join(outputFolder, "cache.ts");

  // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/cache.ts";
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, sourceCode),
  );
}

export async function generateIndexFile(options: GenerationOptions) {
  const schemaLocation = options.schemaFile;

  const schemaAbsPath = isValidUrl(options.schemaFile)
    ? options.schemaFile
    : path.resolve(process.cwd(), schemaLocation);

  const { generateIndexFile } = await import("./generateIndexFile");
  const sourceCode = await generateIndexFile(schemaAbsPath, options);

  const outputFolder = options.outputFolder;
  const outputFile = path.join(outputFolder, "index.ts");

  // const outputFile = "/Users/kriti/celestial/ex/code-gen-test/index.ts";
  fs.appendFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, sourceCode),
  );
}

export function parseConfig(fullConfig: ConfigFile) {
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
