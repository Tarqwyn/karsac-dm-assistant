const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");

const ROOT = path.resolve(__dirname, "..");
const SCHEMAS_ROOT = path.join(ROOT, "schemas", "state");
const STATE_ROOT = path.join(ROOT, "corpus", "state");

const TOP_LEVEL_TARGETS = [
  ["campaign-state.json", "campaign-state.json"],
  ["party-state.json", "party-state.json"],
  ["player-knowledge.json", "player-knowledge.json"],
  ["npcs-state.json", "npcs-state.json"],
  ["items-state.json", "items-state.json"],
  ["world-threads.json", "world-threads.json"]
];

const DIRECTORY_TARGETS = [
  ["session-progress", "session-progress/session-progress.json"],
  ["session-facts", "session-facts/session-facts.json"],
  ["handouts", "handouts/session-handouts.json"],
  ["radar", "radar/session-radar.json"],
  ["triggers", "triggers/session-triggers.json"]
];

const CHAPTER_FILE_SCHEMAS = [
  ["progress.json", "chapters/chapter-progress.json"],
  ["facts.json", "chapters/chapter-facts.json"],
  ["handouts.json", "chapters/chapter-handouts.json"],
  ["beats.json", "chapters/chapter-beats.json"],
  ["triggers.json", "chapters/chapter-triggers.json"],
  ["radar.json", "chapters/chapter-radar.json"],
  ["seed.json", "chapters/chapter-seed.json"],
  ["scenes.json", "chapters/chapter-scenes.json"]
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectJsonFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => path.join(dirPath, entry.name))
    .sort();
}

function collectChapterJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const chapterDir = path.join(dirPath, entry.name);
      return fs.readdirSync(chapterDir, { withFileTypes: true })
        .filter(child => child.isFile() && child.name.endsWith(".json"))
        .map(child => path.join(chapterDir, child.name));
    })
    .sort();
}

function addSchemasRecursively(ajv, dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      addSchemasRecursively(ajv, fullPath);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    const schema = loadJson(fullPath);
    ajv.addSchema(schema);
  }
}

function getValidator(ajv, schemaPath) {
  const schema = loadJson(schemaPath);
  const validate = ajv.getSchema(schema.$id);
  if (!validate) {
    throw new Error(`Schema not registered: ${schemaPath}`);
  }
  return validate;
}

function formatErrors(errors) {
  return errors.map(error => {
    const where = error.instancePath || "/";
    return `${where} ${error.message}`;
  }).join("\n");
}

function main() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true
  });

  addSchemasRecursively(ajv, SCHEMAS_ROOT);

  let failures = 0;
  let validated = 0;

  for (const [stateFile, schemaFile] of TOP_LEVEL_TARGETS) {
    const dataPath = path.join(STATE_ROOT, stateFile);
    const schemaPath = path.join(SCHEMAS_ROOT, schemaFile);
    const validate = getValidator(ajv, schemaPath);
    const data = loadJson(dataPath);
    validated += 1;
    if (!validate(data)) {
      failures += 1;
      console.error(`Schema validation failed: ${path.relative(ROOT, dataPath)}`);
      console.error(formatErrors(validate.errors));
      console.error("");
    }
  }

  for (const [dirName, schemaFile] of DIRECTORY_TARGETS) {
    const schemaPath = path.join(SCHEMAS_ROOT, schemaFile);
    const validate = getValidator(ajv, schemaPath);
    const dirPath = path.join(STATE_ROOT, dirName);
    for (const dataPath of collectJsonFiles(dirPath)) {
      const data = loadJson(dataPath);
      validated += 1;
      if (!validate(data)) {
        failures += 1;
        console.error(`Schema validation failed: ${path.relative(ROOT, dataPath)}`);
        console.error(formatErrors(validate.errors));
        console.error("");
      }
    }
  }

  const chapterFiles = collectChapterJsonFiles(path.join(STATE_ROOT, "chapters"));
  const chapterValidators = new Map(
    CHAPTER_FILE_SCHEMAS.map(([filename, schemaFile]) => [
      filename,
      getValidator(ajv, path.join(SCHEMAS_ROOT, schemaFile))
    ])
  );

  for (const dataPath of chapterFiles) {
    const validate = chapterValidators.get(path.basename(dataPath));
    if (!validate) {
      failures += 1;
      console.error(`Schema validation failed: ${path.relative(ROOT, dataPath)}`);
      console.error(`No schema mapping configured for chapter state file "${path.basename(dataPath)}".`);
      console.error("");
      continue;
    }

    const data = loadJson(dataPath);
    validated += 1;
    if (!validate(data)) {
      failures += 1;
      console.error(`Schema validation failed: ${path.relative(ROOT, dataPath)}`);
      console.error(formatErrors(validate.errors));
      console.error("");
    }
  }

  if (failures > 0) {
    console.error(`State schema validation failed for ${failures} file(s); ${validated - failures} passed.`);
    process.exit(1);
  }

  console.log(`State schema validation passed for ${validated} file(s).`);
}

main();
