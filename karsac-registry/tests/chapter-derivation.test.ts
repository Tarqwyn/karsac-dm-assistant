import { describe, expect, it } from 'vitest';
import { derivePlayerKnowledge } from '../src/state/playerKnowledge.js';

describe('derivePlayerKnowledge', () => {
  it('derives chapter-basis knowledge from facts, handouts, beats, and threads', () => {
    const result = derivePlayerKnowledge({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      facts: {
        facts: [
          {
            id: 'mathr-name-seeded',
            knowledgeStatus: 'revealed',
            revealed: true,
          },
          {
            id: 'scroll-case-purpose',
            knowledgeStatus: 'available',
            revealed: false,
          },
        ],
      },
      handouts: {
        handouts: [
          { id: 'H12', posted: true },
          { id: 'H13', posted: false },
        ],
      },
      beats: {
        beats: [
          { id: 'ambient-forgetting', completed: true },
          { id: 'maw-korvann-beat', completed: false },
        ],
      },
      worldThreads: {
        threads: [
          { id: 'mathr-arithmetic', name: 'Mathr arithmetic', currentStatus: 'hot', defaultStatus: 'simmering' },
          { id: 'deepwhale-followed', name: 'Deepwhale', currentStatus: 'simmering', defaultStatus: 'dormant' },
          { id: 'brynja-record', name: 'Brynja record', currentStatus: 'dormant', defaultStatus: 'dormant' },
          { id: 'resolved-thread', name: 'Resolved', currentStatus: 'closed', defaultStatus: 'closed' },
        ],
      },
      partyState: {
        characters: [
          {
            id: 'korvann',
            threads: [
              { hot: true, text: 'The original geometry is finally in front of him.' },
              { hot: false, text: 'Background thread that should not surface yet.' },
            ],
          },
          {
            id: 'xyrrathh',
            threads: [
              { hot: true, text: 'The phial has been protecting him longer than he knew.' },
            ],
          },
        ],
      },
      source: ['corpus/state/chapters/chapter-2/facts.json'],
    });

    expect(result.chapterBasis).toBe('chapter-2');
    expect(result.knownFacts).toEqual(['mathr-name-seeded']);
    expect(result.postedHandouts).toEqual(['H12']);
    expect(result.knownBeats).toEqual(['ambient-forgetting']);
    expect(result.notYetRevealed).toEqual(['scroll-case-purpose']);
    expect(result.activeThreads).toEqual([
      { id: 'mathr-arithmetic', name: 'Mathr arithmetic', status: 'hot' },
      { id: 'deepwhale-followed', name: 'Deepwhale', status: 'simmering' },
    ]);
    expect(result.unresolvedQuestions).toEqual([
      { player: 'korvann', question: 'The original geometry is finally in front of him.' },
      { player: 'xyrrathh', question: 'The phial has been protecting him longer than he knew.' },
    ]);
  });

  it('treats revealed facts as known even if knowledgeStatus lags behind', () => {
    const result = derivePlayerKnowledge({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      facts: {
        facts: [
          { id: 'vane-line', knowledgeStatus: 'available', revealed: true },
        ],
      },
      handouts: { handouts: [] },
      beats: { beats: [] },
      worldThreads: { threads: [] },
      partyState: { characters: [] },
    });

    expect(result.knownFacts).toEqual(['vane-line']);
    expect(result.notYetRevealed).toEqual([]);
  });
});
