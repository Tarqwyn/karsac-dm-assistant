import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import Ajv2020 from 'ajv/dist/2020.js'
import { PROJECT_ROOT } from './paths.js'

const SCHEMAS_ROOT = join(PROJECT_ROOT, '..', 'schemas', 'design')

let cachedAjv: Ajv2020 | null = null

function loadJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function addSchemasRecursively(ajv: Ajv2020, dirPath: string): void {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      addSchemasRecursively(ajv, fullPath)
      continue
    }
    if (!entry.name.endsWith('.json')) continue
    ajv.addSchema(loadJson(fullPath))
  }
}

function getAjv(): Ajv2020 {
  if (cachedAjv) return cachedAjv
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addSchemasRecursively(ajv, SCHEMAS_ROOT)
  cachedAjv = ajv
  return ajv
}

export function validateDesignObject(schemaFile: string, payload: unknown): { valid: boolean; issues: string[] } {
  const ajv = getAjv()
  const schemaPath = join(SCHEMAS_ROOT, schemaFile)
  const schema = loadJson(schemaPath) as { $id: string }
  const validate = ajv.getSchema(schema.$id)
  if (!validate) {
    return { valid: false, issues: [`Schema not registered: ${schemaFile}`] }
  }
  const valid = validate(payload)
  if (valid) return { valid: true, issues: [] }
  const issues = (validate.errors ?? []).map((error) => {
    const where = error.instancePath || '/'
    return `${where} ${error.message}`
  })
  return { valid: false, issues }
}
