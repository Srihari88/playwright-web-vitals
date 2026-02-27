import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  await writeTextFile(path, serialized);
}
