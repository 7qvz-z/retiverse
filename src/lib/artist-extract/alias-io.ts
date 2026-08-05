import { promises as fs } from "node:fs";
import path from "node:path";
import {
  mergeAliasIntoDictionary,
  type AliasDictionary,
} from "./normalize";

const DICT_PATH = path.join(
  process.cwd(),
  "src/lib/artist-extract/alias-dictionary.json",
);

export async function readAliasDictionaryFile(): Promise<AliasDictionary> {
  const raw = await fs.readFile(DICT_PATH, "utf8");
  return JSON.parse(raw) as AliasDictionary;
}

export async function writeAliasDictionaryFile(
  dictionary: AliasDictionary,
): Promise<void> {
  const sorted: AliasDictionary = {};
  for (const key of Object.keys(dictionary).sort((a, b) =>
    a.localeCompare(b, "ja"),
  )) {
    sorted[key] = [...dictionary[key]].sort((a, b) =>
      a.localeCompare(b, "ja"),
    );
  }
  await fs.writeFile(
    DICT_PATH,
    `${JSON.stringify(sorted, null, 2)}\n`,
    "utf8",
  );
}

/**
 * 2タグ統合結果を alias-dictionary.json に追記
 */
export async function appendAliasMerge(input: {
  canonical: string;
  mergeFrom: string;
}): Promise<AliasDictionary> {
  const current = await readAliasDictionaryFile();
  const next = mergeAliasIntoDictionary(
    current,
    input.canonical,
    input.mergeFrom,
  );
  await writeAliasDictionaryFile(next);
  return next;
}
