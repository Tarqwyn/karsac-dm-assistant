/**
 * Thin BDD wrapper around Vitest.
 *
 * Gives Gherkin-readable test names and step logging without requiring
 * a separate Cucumber toolchain. The `given/when/then/and` helpers log
 * the step description to console — useful when reading test output.
 * The actual assertions happen in the test body as normal Vitest code.
 *
 * Usage:
 *   scenario('NPC proposal — corpus-named full coverage', async () => {
 *     given('I propose "Jarl Beorn" as an NPC')
 *     const result = await runScenario(...)
 *     then('validation passes')
 *     expect(result.validationStatus).toBe('pass')
 *   })
 */

import { it } from 'vitest'

export function scenario(name: string, fn: () => void | Promise<void>): void {
  it(`Scenario: ${name}`, fn)
}

export function given(description: string): void {
  process.stdout.write(`    Given ${description}\n`)
}

export function when(description: string): void {
  process.stdout.write(`    When ${description}\n`)
}

export function then(description: string): void {
  process.stdout.write(`    Then ${description}\n`)
}

export function and(description: string): void {
  process.stdout.write(`    And ${description}\n`)
}
