import { readFileSync } from "node:fs";
import { POSITIONS } from "../constants.ts";
import { validateBank } from "../validate.ts";
import { INDEX_FILE, readSituationFile, renderIndex, situationFiles } from "./paths.ts";

const files = situationFiles();
const items = files.map(readSituationFile);
const result = validateBank(items);
let failed = !result.ok;

files.forEach((file, i) => {
  const item = items[i] as { id?: unknown };
  if (item.id !== file.replace(/\.json$/, "")) {
    console.error(`✗ ${file}: file name must equal id ("${String(item.id)}")`);
    failed = true;
  }
});

for (const issue of result.issues) console.error(`✗ ${issue.id}: ${issue.message}`);

if (readFileSync(INDEX_FILE, "utf8") !== renderIndex(files)) {
  console.error("✗ src/bank.generated.ts is stale — run `pnpm content:index`");
  failed = true;
}

const perPos = POSITIONS.map(
  (p) => `${p}:${result.situations.filter((s) => s.position === p).length}`,
).join(" ");
console.log(`${result.situations.length}/${files.length} situations parsed · by POV ${perPos}`);

if (failed) {
  console.error("Content validation failed");
  process.exit(1);
}
console.log("✓ Content valid");
