import { describe, expect, it } from 'vitest';
import { applyChapterTriggers } from '../src/state/triggers.js';
import { refreshChapterState } from '../src/state/chapterRefresh.js';

describe('applyChapterTriggers', () => {
  it('applies fact, handout, and beat triggers to advance threads', () => {
    const result = applyChapterTriggers({
      facts: {
        facts: [
          { id: 'mathr-no-antecedent', knowledgeStatus: 'revealed', revealed: true },
        ],
      },
      handouts: {
        handouts: [
          { id: 'H12', posted: true },
        ],
      },
      beats: {
        beats: [
          { id: 'ambient-forgetting', completed: true },
        ],
      },
      triggers: {
        triggers: [
          { on: 'fact', id: 'mathr-no-antecedent', threadId: 'mathr-arithmetic', setStatus: 'hot' },
          { on: 'handout', id: 'H12', threadId: 'aeorian-note-ashvein', setStatus: 'hot' },
          { on: 'beat', id: 'ambient-forgetting', threadId: 'torweg-thinning', setStatus: 'simmering' },
        ],
      },
      worldThreads: {
        id: 'world-threads',
        type: 'world-threads',
        campaign: 'karsac',
        source: 'test',
        importStatus: 'test',
        statusLabels: {
          hot: 'Hot',
          simmering: 'Simmering',
          dormant: 'Dormant',
          closed: 'Closed',
          abandoned: 'Abandoned',
        },
        threads: [
          {
            id: 'mathr-arithmetic',
            name: 'Mathr arithmetic',
            type: 'world',
            origin: 'ch2',
            defaultStatus: 'dormant',
            currentStatus: 'dormant',
            summary: 'summary',
            players: [],
            npcs: [],
            pokeWhen: 'poke',
            closesWhen: 'close',
            autoTriggers: [],
          },
          {
            id: 'aeorian-note-ashvein',
            name: 'Aeorian note',
            type: 'world',
            origin: 'ch2',
            defaultStatus: 'dormant',
            currentStatus: 'dormant',
            summary: 'summary',
            players: [],
            npcs: [],
            pokeWhen: 'poke',
            closesWhen: 'close',
            autoTriggers: [],
          },
          {
            id: 'torweg-thinning',
            name: 'Torweg thinning',
            type: 'world',
            origin: 'ch2',
            defaultStatus: 'dormant',
            currentStatus: 'dormant',
            summary: 'summary',
            players: [],
            npcs: [],
            pokeWhen: 'poke',
            closesWhen: 'close',
            autoTriggers: [],
          },
        ],
      },
    });

    expect(result.threads.map((thread) => [thread.id, thread.currentStatus])).toEqual([
      ['mathr-arithmetic', 'hot'],
      ['aeorian-note-ashvein', 'hot'],
      ['torweg-thinning', 'simmering'],
    ]);
  });

  it('allows terminal trigger states to close an already-hot thread', () => {
    const result = applyChapterTriggers({
      facts: {
        facts: [
          { id: 'vane-token', knowledgeStatus: 'revealed', revealed: true },
          { id: 'vane-realises', knowledgeStatus: 'revealed', revealed: true },
        ],
      },
      handouts: { handouts: [] },
      beats: { beats: [] },
      triggers: {
        triggers: [
          { on: 'fact', id: 'vane-token', threadId: 'vane-token-mathr', setStatus: 'hot' },
          { on: 'fact', id: 'vane-realises', threadId: 'vane-token-mathr', setStatus: 'closed' },
        ],
      },
      worldThreads: {
        id: 'world-threads',
        type: 'world-threads',
        campaign: 'karsac',
        source: 'test',
        importStatus: 'test',
        statusLabels: {
          hot: 'Hot',
          simmering: 'Simmering',
          dormant: 'Dormant',
          closed: 'Closed',
          abandoned: 'Abandoned',
        },
        threads: [
          {
            id: 'vane-token-mathr',
            name: 'Vane token',
            type: 'world',
            origin: 'ch2',
            defaultStatus: 'dormant',
            currentStatus: 'hot',
            summary: 'summary',
            players: [],
            npcs: [],
            pokeWhen: 'poke',
            closesWhen: 'close',
            autoTriggers: [],
          },
        ],
      },
    });

    expect(result.threads[0]?.currentStatus).toBe('closed');
  });
});

describe('refreshChapterState', () => {
  it('refreshes threads first, then derives player knowledge from refreshed state', () => {
    const result = refreshChapterState({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      facts: {
        facts: [
          { id: 'mathr-no-antecedent', knowledgeStatus: 'revealed', revealed: true },
        ],
      },
      handouts: { handouts: [] },
      beats: {
        beats: [
          { id: 'ambient-forgetting', completed: true },
        ],
      },
      triggers: {
        triggers: [
          { on: 'fact', id: 'mathr-no-antecedent', threadId: 'mathr-arithmetic', setStatus: 'hot' },
        ],
      },
      worldThreads: {
        id: 'world-threads',
        type: 'world-threads',
        campaign: 'karsac',
        source: 'test',
        importStatus: 'test',
        statusLabels: {
          hot: 'Hot',
          simmering: 'Simmering',
          dormant: 'Dormant',
          closed: 'Closed',
          abandoned: 'Abandoned',
        },
        threads: [
          {
            id: 'mathr-arithmetic',
            name: 'Mathr arithmetic',
            type: 'world',
            origin: 'ch2',
            defaultStatus: 'dormant',
            currentStatus: 'dormant',
            summary: 'summary',
            players: [],
            npcs: [],
            pokeWhen: 'poke',
            closesWhen: 'close',
            autoTriggers: [],
          },
        ],
      },
      partyState: {
        characters: [
          {
            id: 'korvann',
            threads: [
              { hot: true, text: 'He has seen the original geometry at last.' },
            ],
          },
        ],
      },
      source: ['corpus/state/chapters/chapter-2/facts.json'],
    });

    expect(result.worldThreads.threads[0]?.currentStatus).toBe('hot');
    expect(result.playerKnowledge.activeThreads).toEqual([
      { id: 'mathr-arithmetic', name: 'Mathr arithmetic', status: 'hot' },
    ]);
    expect(result.playerKnowledge.knownBeats).toEqual(['ambient-forgetting']);
  });
});
