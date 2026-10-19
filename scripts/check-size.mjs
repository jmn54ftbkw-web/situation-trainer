// Fails if the gzipped JS loaded by index.html exceeds the budget in docs/architecture.md.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 200;
const dist = process.argv[2] ?? "apps/web/dist";
const assets = join(dist, "assets");
const files = readdirSync(assets).filter((f) => f.endsWith(".js"));
let total = 0;
for (const f of files) {
  const buf = readFileSync(join(assets, f));
  const gz = gzipSync(buf).length;
  total += gz;
  console.log(`${f}  raw ${(buf.length / 1024).toFixed(1)}KB  gzip ${(gz / 1024).toFixed(1)}KB`);
}
const kb = total / 1024;
console.log(`Total JS gzip: ${kb.toFixed(1)}KB (budget ${BUDGET_KB}KB)`);
if (kb > BUDGET_KB) {
  console.error("JS budget exceeded");
  process.exit(1);
}
