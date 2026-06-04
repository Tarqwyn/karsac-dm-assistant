/**
 * Validates that a value loaded from YAML is an array.
 * If not, emits a stderr warning and returns an empty array rather than
 * crashing later with "x.map is not a function".
 */
export function guardArray<T>(val: unknown, field: string): T[] {
  if (!Array.isArray(val)) {
    if (val !== undefined && val !== null) {
      process.stderr.write(
        `[karsac-registry] YAML field "${field}" must be an array; got ${typeof val}. Falling back to [].\n`,
      )
    }
    return []
  }
  return val as T[]
}
