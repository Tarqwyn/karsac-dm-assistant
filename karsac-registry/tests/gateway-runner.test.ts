import { describe, expect, it } from 'vitest'
import {
  buildOpenWebUIMetaResponse,
  isOpenWebUIMetaPrompt,
} from '../src/gateway/karsacRunner.js'
import { buildModelsResponse } from '../src/gateway/chatCompletion.js'

describe('gateway meta prompt handling', () => {
  it('detects Open WebUI title prompts as meta prompts', () => {
    const prompt = `### Task:
Generate a concise, 3-5 word title with an emoji summarizing the chat history.
### Output:
JSON format: { "title": "your concise title here" }
### Chat History:
<chat_history>
USER: Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns.
</chat_history>`

    expect(isOpenWebUIMetaPrompt(prompt)).toBe(true)
    expect(buildOpenWebUIMetaResponse(prompt)).toBe('{"title":"🕸️ Shadow Walker Adversary"}')
  })

  it('detects Open WebUI follow-up prompts as meta prompts', () => {
    const prompt = `### Task:
Suggest 3-5 relevant follow-up questions or prompts that the user might naturally ask next in this conversation as a user.
### Output:
JSON format: { "follow_ups": ["Question 1?", "Question 2?"] }
### Chat History:
<chat_history>
USER: Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns.
</chat_history>`

    expect(isOpenWebUIMetaPrompt(prompt)).toBe(true)
    const parsed = JSON.parse(buildOpenWebUIMetaResponse(prompt) ?? '{}') as { follow_ups?: string[] }
    expect(parsed.follow_ups).toBeDefined()
    expect(parsed.follow_ups).toHaveLength(3)
    expect(parsed.follow_ups?.[0]).toMatch(/stat block|doctrine mechanics/i)
  })

  it('detects broader Open WebUI follow-up prompt variants as meta prompts', () => {
    const prompt = `### Task:
Suggest 3-5 relevant follow-up questions or prompts that the user might naturally ask next in this conversation as a **user**, based on the chat history, to help continue or deepen the discussion.
### Guidelines:
- Write all follow-up questions from the user's point of view, directed to the assistant.
### Output:
JSON format: { "follow_ups": ["Question 1?", "Question 2?"] }
### Chat History:
<chat_history>
USER: Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns.
</chat_history>`

    expect(isOpenWebUIMetaPrompt(prompt)).toBe(true)
    const parsed = JSON.parse(buildOpenWebUIMetaResponse(prompt) ?? '{}') as { follow_ups?: string[] }
    expect(parsed.follow_ups).toBeDefined()
    expect(parsed.follow_ups).toHaveLength(3)
  })

  it('detects Open WebUI tag prompts as meta prompts', () => {
    const prompt = `### Task:
Generate 1-3 broad tags categorizing the main themes of the chat history.
### Output:
JSON format: { "tags": ["tag-1", "tag-2"] }
### Chat History:
<chat_history>
USER: Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns.
</chat_history>`

    expect(isOpenWebUIMetaPrompt(prompt)).toBe(true)
    const parsed = JSON.parse(buildOpenWebUIMetaResponse(prompt) ?? '{}') as { tags?: string[] }
    expect(parsed.tags).toBeDefined()
    expect(parsed.tags).toContain('adversary-design')
    expect(parsed.tags).toContain('shadow-walkers')
  })

  it('does not treat real user proposal prompts as meta prompts', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns.'

    expect(isOpenWebUIMetaPrompt(prompt)).toBe(false)
    expect(buildOpenWebUIMetaResponse(prompt)).toBeNull()
  })

  it('includes gateway build metadata in the models response', () => {
    const response = buildModelsResponse('karsac-dm-assistant', 'Karsac DM Assistant', 1760000000)
    expect(response.data[0].name).toBe('Karsac DM Assistant')
    expect(response.data[0].metadata?.gateway_build).toMatch(/^karsac-registry@/)
    expect(response.data[0].metadata?.registry_build_timestamp).toMatch(/T.*Z$/)
  })
})
