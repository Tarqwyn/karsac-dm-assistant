const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");

const ROOT = path.resolve(__dirname, "..");
const SCHEMAS_ROOT = path.join(ROOT, "schemas", "design");

const SCHEMA_FILES = [
  "campaign-structure.json",
  "campaign-structure-beat.json",
  "campaign-structure-spine-beat.json",
  "campaign-structure-timer-rule.json",
  "campaign-structure-theme.json",
  "campaign-structure-theme-catalog.json",
  "campaign-structure-global-entity.json",
  "campaign-structure-global-entity-catalog.json",
  "campaign-structure-chapter-outline.json",
  "campaign-structure-thread.json",
  "campaign-structure-npc.json",
  "campaign-structure-adversary.json",
  "campaign-structure-player-character.json",
  "campaign-structure-item.json",
  "campaign-structure-place.json",
  "campaign-structure-faction.json",
  "campaign-structure-event.json",
  "campaign-structure-volume.json",
  "campaign-structure-chapter.json",
  "campaign-structure-scene.json"
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addSchemasRecursively(ajv, dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      addSchemasRecursively(ajv, fullPath);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    ajv.addSchema(loadJson(fullPath));
  }
}

function main() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true
  });

  addSchemasRecursively(ajv, SCHEMAS_ROOT);

  let failures = 0;

  for (const schemaFile of SCHEMA_FILES) {
    const schemaPath = path.join(SCHEMAS_ROOT, schemaFile);
    const schema = loadJson(schemaPath);
    const validate = ajv.getSchema(schema.$id);
    if (!validate) {
      failures += 1;
      console.error(`Schema not registered: ${path.relative(ROOT, schemaPath)}`);
      continue;
    }
    if (typeof validate.schema !== "object" || validate.schema === null) {
      failures += 1;
      console.error(`Schema failed to compile: ${path.relative(ROOT, schemaPath)}`);
    }
  }

  if (failures > 0) {
    console.error(`Design schema validation failed for ${failures} schema(s).`);
    process.exit(1);
  }

  console.log(`Design schema validation passed for ${SCHEMA_FILES.length} schema(s).`);
}

main();
