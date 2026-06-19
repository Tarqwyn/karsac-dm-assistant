import { derivePlayerKnowledge, type DerivePlayerKnowledgeInput } from './playerKnowledge.js';
import { applyChapterTriggers, type ApplyChapterTriggersInput } from './triggers.js';

export type RefreshChapterStateInput = DerivePlayerKnowledgeInput & Pick<ApplyChapterTriggersInput, 'triggers' | 'worldThreads'>;

export function refreshChapterState(input: RefreshChapterStateInput) {
  const worldThreads = applyChapterTriggers({
    facts: input.facts,
    handouts: input.handouts,
    beats: input.beats,
    triggers: input.triggers,
    worldThreads: input.worldThreads,
  });

  const playerKnowledge = derivePlayerKnowledge({
    campaign: input.campaign,
    chapterId: input.chapterId,
    facts: input.facts,
    handouts: input.handouts,
    beats: input.beats,
    worldThreads,
    partyState: input.partyState,
    source: input.source,
  });

  return {
    worldThreads,
    playerKnowledge,
  };
}
