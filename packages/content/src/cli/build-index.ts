import { writeFileSync } from "node:fs";
import { INDEX_FILE, renderIndex, situationFiles } from "./paths.ts";

const files = situationFiles();
writeFileSync(INDEX_FILE, renderIndex(files));
console.log(`Wrote ${files.length} situations to src/bank.generated.ts`);
