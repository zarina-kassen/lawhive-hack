import { writeFile } from "node:fs/promises";
import path from "node:path";

import { getCaseIndex } from "../src/lib/judges";

async function main() {
  const index = await getCaseIndex();
  const cases = Array.from(index.byJurisdiction.values()).flat();
  const uniqueCases = Array.from(new Map(cases.map((caseRecord) => [caseRecord.case_number, caseRecord])).values());
  const outputPath = path.join(process.cwd(), "enriched.json");

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        synthetic_fields: ["award_gbp", "months_to_resolution", "reasoning_blurb"],
        cases: uniqueCases,
        jurisdictions: index.jurisdictions,
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${uniqueCases.length} enriched final-merits cases to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
