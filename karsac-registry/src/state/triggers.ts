import type { BeatState, FactState, HandoutState } from './playerKnowledge.js';

export type TriggerEventType = 'fact' | 'handout' | 'beat';

export type ChapterTrigger = {
  on: TriggerEventType;
  id: string;
  threadId: string;
  setStatus: string;
};

export type ChapterTriggersState = {
  triggers: ChapterTrigger[];
};

export type WorldThreadRecord = {
  id: string;
  name: string;
  type: string;
  origin: string;
  defaultStatus: string;
  currentStatus: string;
  statusSource?: string;
  summary: string;
  players: string[];
  npcs: string[];
  pokeWhen: string;
  closesWhen: string;
  autoTriggers: Array<{ on: string; id: string; setStatus: string }>;
};

export type WorldThreadsState = {
  id: string;
  type: string;
  campaign: string;
  source: string;
  importStatus: string;
  statusLabels: Record<string, string>;
  threads: WorldThreadRecord[];
};

export type ApplyChapterTriggersInput = {
  facts: { facts: FactState[] };
  handouts: { handouts: HandoutState[] };
  beats: { beats: BeatState[] };
  triggers: ChapterTriggersState;
  worldThreads: WorldThreadsState;
};

const STATUS_PRIORITY: Record<string, number> = {
  dormant: 0,
  simmering: 1,
  hot: 2,
  closed: 3,
  abandoned: 4,
};

function isFactActive(fact: FactState): boolean {
  return fact.revealed || fact.knowledgeStatus === 'revealed';
}

function statusRank(status: string | undefined): number {
  if (!status) return -1;
  return STATUS_PRIORITY[status] ?? -1;
}

function pickHigherStatus(left: string, right: string): string {
  return statusRank(right) > statusRank(left) ? right : left;
}

export function applyChapterTriggers(input: ApplyChapterTriggersInput): WorldThreadsState {
  const activeFacts = new Set(input.facts.facts.filter(isFactActive).map((fact) => fact.id));
  const activeHandouts = new Set(input.handouts.handouts.filter((handout) => handout.posted).map((handout) => handout.id));
  const activeBeats = new Set(input.beats.beats.filter((beat) => beat.completed).map((beat) => beat.id));

  const activeEvents: Record<TriggerEventType, Set<string>> = {
    fact: activeFacts,
    handout: activeHandouts,
    beat: activeBeats,
  };

  return {
    ...input.worldThreads,
    threads: input.worldThreads.threads.map((thread) => {
      const baseline = thread.currentStatus || thread.defaultStatus;
      const triggeredStatus = input.triggers.triggers
        .filter((trigger) => trigger.threadId === thread.id)
        .filter((trigger) => activeEvents[trigger.on]?.has(trigger.id))
        .reduce((status, trigger) => pickHigherStatus(status, trigger.setStatus), baseline);

      return {
        ...thread,
        currentStatus: triggeredStatus,
        statusSource: thread.statusSource ?? 'derived',
      };
    }),
  };
}
