import { lstat, rm } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("out");
try {
  const info = await lstat(outputDirectory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Refusing to clean non-directory export output: ${outputDirectory}`);
  }
  await rm(outputDirectory, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 250,
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
