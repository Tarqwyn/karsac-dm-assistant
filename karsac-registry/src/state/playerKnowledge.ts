export type FactState = {
  id: string;
  knowledgeStatus: string;
  revealed: boolean;
};

export type HandoutState = {
  id: string;
  posted: boolean;
};

export type BeatState = {
  id: string;
  completed: boolean;
};

export type ThreadState = {
  id: string;
  name: string;
  currentStatus?: string;
  defaultStatus?: string;
};

export type PartyThread = {
  hot: boolean;
  text: string;
};

export type PartyCharacter = {
  id: string;
  threads: PartyThread[];
};

export type DerivePlayerKnowledgeInput = {
  campaign: string;
  chapterId: string;
  facts: { facts: FactState[] };
  handouts: { handouts: HandoutState[] };
  beats: { beats: BeatState[] };
  worldThreads: { threads: ThreadState[] };
  partyState: { characters: PartyCharacter[] };
  source?: string[];
};

export type PlayerKnowledgeState = {
  id: 'player-knowledge';
  type: 'player-knowledge';
  campaign: string;
  scope: 'party';
  chapterBasis: string;
  knownFacts: string[];
  postedHandouts: string[];
  knownBeats: string[];
  activeThreads: Array<{ id: string; name: string; status: string }>;
  unresolvedQuestions: Array<{ player: string; question: string }>;
  notYetRevealed: string[];
  source: string[];
  importStatus: 'derived';
};

function isFactKnown(fact: FactState): boolean {
  return fact.revealed || fact.knowledgeStatus === 'revealed';
}

function isActiveThread(status: string | undefined): boolean {
  return status === 'hot' || status === 'simmering';
}

export function derivePlayerKnowledge(input: DerivePlayerKnowledgeInput): PlayerKnowledgeState {
  const knownFacts = input.facts.facts.filter(isFactKnown).map((fact) => fact.id);
  const postedHandouts = input.handouts.handouts.filter((handout) => handout.posted).map((handout) => handout.id);
  const knownBeats = input.beats.beats.filter((beat) => beat.completed).map((beat) => beat.id);
  const notYetRevealed = input.facts.facts.filter((fact) => !isFactKnown(fact)).map((fact) => fact.id);

  const activeThreads = input.worldThreads.threads
    .map((thread) => ({
      id: thread.id,
      name: thread.name,
      status: thread.currentStatus ?? thread.defaultStatus ?? 'dormant',
    }))
    .filter((thread) => isActiveThread(thread.status));

  const unresolvedQuestions = input.partyState.characters.flatMap((character) =>
    character.threads
      .filter((thread) => thread.hot)
      .map((thread) => ({
        player: character.id,
        question: thread.text,
      })),
  );

  return {
    id: 'player-knowledge',
    type: 'player-knowledge',
    campaign: input.campaign,
    scope: 'party',
    chapterBasis: input.chapterId,
    knownFacts,
    postedHandouts,
    knownBeats,
    activeThreads,
    unresolvedQuestions,
    notYetRevealed,
    source: input.source ?? [],
    importStatus: 'derived',
  };
}
