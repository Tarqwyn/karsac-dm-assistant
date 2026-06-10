/**
 * LLM-based quality gate for Layer 4 snapshots.
 *
 * Sends the full proposal + corpus to Claude Haiku and asks it to identify
 * claims that CONTRADICT canon — not just invented claims (invention is fine
 * for new entities). Contradictions are the signal that matters for quality.
 *
 * This runs alongside the heuristic regression check, not instead of it.
 * The heuristic owns the count-delta regression signal.
 * This evaluator owns the semantic quality signal.
 *
 * Requires ANTHROPIC_API_KEY. Skipped silently when not set or when
 * corpusFiles is empty (new entities have nothing to contradict).
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'fs'

const MODEL = 'claude-haiku-4-5'

export interface Contradiction {
  claim: string
  corpusEvidence: string
  explanation: string
}

export interface QualityResult {
  contradictions: Contradiction[]
  skipped?: string
}

export async function runQualityCheck(
  body: string,
  corpusFiles: string[],
): Promise<QualityResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { contradictions: [], skipped: 'no ANTHROPIC_API_KEY' }
  }

  if (corpusFiles.length === 0) {
    return { contradictions: [], skipped: 'no corpus (new entity)' }
  }

  const loadedFiles = corpusFiles.filter(f => existsSync(f))
  if (loadedFiles.length === 0) {
    return { contradictions: [], skipped: 'corpus files not found on disk' }
  }

  const corpusContent = loadedFiles
    .map(f => {
      const label = f.split('/').slice(-2).join('/')
      return `### ${label}\n${readFileSync(f, 'utf-8')}`
    })
    .join('\n\n---\n\n')

  const prompt = `You are reviewing a DM assistant's proposal for a tabletop RPG campaign set in the Karsac universe.

Your task: identify claims in the PROPOSAL that CONTRADICT the CORPUS below.

A CONTRADICTION is when the proposal states something that:
- Conflicts with a fact explicitly stated in the corpus
- Reverses or inverts a relationship or attribute
- Misidentifies a role, faction membership, status, or key attribute

Do NOT flag:
- New characters, locations, or items not mentioned in the corpus (invention is fine)
- Inferences or extrapolations that are consistent with the corpus
- Stylistic differences or paraphrases that preserve the intended meaning

## CORPUS (canon source material)
${corpusContent}

## PROPOSAL
${body}

Respond ONLY with a JSON object, no markdown wrapper, no text outside the JSON:
{
  "contradictions": [
    {
      "claim": "the exact quote or paraphrase from the proposal",
      "corpusEvidence": "the specific corpus passage it contradicts",
      "explanation": "one sentence explaining the conflict"
    }
  ]
}

If there are no contradictions, respond with: {"contradictions": []}`

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    // Extract the JSON object regardless of surrounding prose or code fences
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    const json = start !== -1 && end > start ? text.slice(start, end + 1) : '{}'

    const parsed = JSON.parse(json) as { contradictions?: unknown }
    if (!Array.isArray(parsed.contradictions)) {
      return { contradictions: [], skipped: 'unexpected response shape' }
    }

    return {
      contradictions: (parsed.contradictions as Contradiction[]).filter(
        c => typeof c.claim === 'string' && typeof c.corpusEvidence === 'string',
      ),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { contradictions: [], skipped: `error: ${msg}` }
  }
}
