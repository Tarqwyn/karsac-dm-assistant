import { readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const SCHEMAS_ROOT = join(PROJECT_ROOT, 'schemas', 'state');

function loadJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function addSchemasRecursively(ajv: Ajv2020, dirPath: string): void {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      addSchemasRecursively(ajv, fullPath);
      continue;
    }
    if (!entry.name.endsWith('.json')) continue;
    ajv.addSchema(loadJson(fullPath));
  }
}

function makeAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addSchemasRecursively(ajv, SCHEMAS_ROOT);
  return ajv;
}

function getValidator(schemaPath: string) {
  const ajv = makeAjv();
  const schema = loadJson(schemaPath) as { $id: string };
  const validate = ajv.getSchema(schema.$id);
  if (!validate) throw new Error(`Schema not registered: ${schemaPath}`);
  return validate;
}

describe('chapter state schemas', () => {
  it('validates scene-level trigger authoring in a chapter plan', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-plan.json'));
    const payload = {
      id: 'chapter-3-plan',
      type: 'chapter-plan',
      campaign: 'karsac',
      chapterId: 'chapter-3',
      source: 'authored',
      importStatus: 'live',
      title: 'The Weight of Witness',
      scenes: [
        {
          id: 'scene-1',
          label: 'Opening',
          kind: 'opening',
          order: 10,
          summary: 'Open the chapter.',
          artifactRef: null,
          npcs: [],
          places: [],
          adversaries: [],
          items: [],
          beats: [],
          facts: [{ id: 'fact-mathr', label: 'Mathr named' }],
          handouts: [],
          triggers: [{ on: 'fact', id: 'fact-mathr', threadId: 'mathr-arithmetic', setStatus: 'hot' }],
        },
      ],
      threads: [{ threadId: 'mathr-arithmetic', hook: 'Pressure rises.', cueSceneIds: ['scene-1'] }],
      checkpoints: [],
    };

    expect(validate(payload)).toBe(true);
  });

  it('validates a chapter facts document with reveal semantics', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-facts.json'));
    const payload = {
      id: 'chapter-2-facts',
      type: 'chapter-facts',
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'tests/fixtures/chapter-2',
      importStatus: 'test',
      facts: [
        {
          id: 'mathr-name-seeded',
          label: 'Mathr name seeded twice',
          scene: 'records',
          desc: 'The name Mathr has appeared twice in ambient contexts.',
          knowledgeStatus: 'revealed',
          revealed: true,
          type: 'chapter-fact',
          chapter: 'chapter-2',
          source: 'tests/fixtures/chapter-2',
          importStatus: 'test',
        },
        {
          id: 'maw-scroll-case',
          label: 'Scroll case positioning record not yet understood',
          scene: 'maw',
          desc: 'The party has not yet linked the scroll case to the Maw geometry.',
          knowledgeStatus: 'available',
          revealed: false,
          type: 'chapter-fact',
          chapter: 'chapter-2',
          source: 'tests/fixtures/chapter-2',
          importStatus: 'test',
        },
      ],
    };

    expect(validate(payload)).toBe(true);
  });

  it('validates a chapter beats document as first-class state', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-beats.json'));
    const payload = {
      id: 'chapter-2-beats',
      type: 'chapter-beats',
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'tests/fixtures/chapter-2',
      importStatus: 'test',
      beats: [
        {
          id: 'ambient-smoothing',
          label: 'Ambient smoothing beat landed',
          scene: 'ambient',
          desc: 'The apprentice could not hold the Carver face in memory.',
          completed: true,
          type: 'chapter-beat',
          chapter: 'chapter-2',
          source: 'tests/fixtures/chapter-2',
          importStatus: 'test',
        },
      ],
    };

    expect(validate(payload)).toBe(true);
  });

  it('validates structured chapter scenes for tracker rendering', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-scenes.json'));
    const payload = {
      id: 'chapter-2-scenes',
      type: 'chapter-scenes',
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'tests/fixtures/chapter-2',
      importStatus: 'test',
      scenes: [
        {
          id: 'scene5',
          label: '5 · The Threads',
          kind: 'hub',
          order: 50,
          meta: 'Scene 5 · Törweg · The Investigation',
          title: 'The Threads',
          summary: 'Four threads run in parallel. Clock is live. The Saltbone Inn. The south dock approach.',
          facts: [],
          handouts: [],
          beats: [],
          blocks: [
            {
              type: 'clock',
              title: 'Törweg Clock — live during Scene 5',
              help: 'Click as the players trigger the advance conditions below. Silent. Never announced.',
              controls: [1, 2, -1],
            },
            {
              type: 'choke-point',
              label: '🧵 Choke Point 2 of 2',
              title: 'Following the Threads',
              summary: 'Once at Brynja\'s hall, the players may bounce off the threads, stay too long, or charge the south dock prematurely.',
            },
            {
              type: 'list',
              heading: 'Signs they are drifting',
              style: 'bullet',
              itemsHtml: [
                'Long table silence after Brynja\'s debrief',
                'Players gravitating to &quot;let\'s just confront Vane now&quot;',
                'Nobody splitting up or moving on a hook',
                'Sitting in Brynja\'s hall asking more questions in circles',
              ],
            },
            {
              type: 'sequence',
              heading: 'Escalation',
              items: [
                { label: '1 · Per-PC', bodyHtml: 'Brynja\'s tailored hooks — fire as she sends them out.' },
                { label: '2 · The Crow', bodyHtml: 'If Rowan needs a nudge, the Crow lifts from the archives roof, circles once, and resettles. Visible only to him.' },
                { label: '3 · Ambient', bodyHtml: 'Use the clock-tier ambient cues as background. A door closes too quickly. The fisherman is still on his stitch.' },
              ],
            },
            {
              type: 'heading',
              text: 'Brynja\'s tailored hooks',
            },
            {
              type: 'lines',
              who: 'Brynja · sending them out',
              hint: 'two sentences each. Quality + location + person + approach. Do not explain.',
              lines: [
                { cue: 'To Korvann', textHtml: '&quot;The hunter. Saltbone Inn this evening. Ask for Brix.&quot;' },
                { cue: 'To Rowan', textHtml: '&quot;The watcher. Pell Duvash. Upper market trading house.&quot;' },
              ],
            },
            {
              type: 'scene-links',
              heading: 'The Four Threads',
              items: [
                { sceneId: 'thread-a', title: 'A · Brix and the Coldfront', summary: 'First mate working through a bottle at the Saltbone Inn every evening. Patience, not pressure.', label: 'open thread A →' },
                { sceneId: 'thread-b', title: 'B · The Maw', summary: 'Two hours up into the Stormwatch foothills. The Aeorian note. The Threshold-Bound Echo.', label: 'open thread B →' },
                { sceneId: 'thread-c', title: 'C · Pell Duvash', summary: 'Merchant intermediary. Been told to stay and tell the truth. Assassins arrive 10–15 minutes in.', label: 'open thread C →' },
                { sceneId: 'thread-d', title: 'D · The Records', summary: 'Council archives. Mathr\'s family appearing sixty years ago, fully formed, no antecedent.', label: 'open thread D →' },
              ],
            },
            {
              type: 'heading',
              text: 'The Saltbone Inn',
            },
            {
              type: 'paragraph',
              bodyHtml: 'Information lives here. <strong>Clock +1 simply for being here.</strong>',
            },
            {
              type: 'list',
              style: 'bullet',
              itemsHtml: [
                'Vane has been Housecarl-Captain 15 years, his father before him',
                'A coastal vessel at the south dock began loading before dawn',
              ],
            },
            {
              type: 'path-cards',
              heading: 'South Dock Approach',
              items: [
                { tone: 'low', label: 'Happy Path (low clock)', bodyHtml: 'No watchers. Players can observe freely. Vane visible, supervising.' },
                { tone: 'high', label: 'Sad Path (high clock)', bodyHtml: 'Watchers on the approaches. Cannot get close without being seen.' },
              ],
            },
            {
              type: 'link',
              label: 'Open the ambient beats reference →',
              target: 'scene',
              href: 'ambient',
            },
            {
              type: 'callout',
              variant: 'dm-only',
              label: 'DM Only',
              bodyHtml: 'The man in the long dark coat with the black pin is at the Saltbone, far table, drinking nothing.',
            },
            {
              type: 'actions',
              label: null,
              actions: [
                { kind: 'fact', id: 'black-pin', label: 'The man with the black pin' },
              ],
            },
          ],
          notesMd: 'Optional markdown support.',
        },
        {
          id: 'thread-a',
          label: 'A · Brix and the Coldfront',
          kind: 'thread',
          order: 61,
          meta: 'Scene 5 · Thread A · Saltbone Inn',
          title: 'Brix and the Coldfront',
          summary: 'Patience, not pressure. He needs to be heard before he can tell you what he saw.',
          facts: ['ashfen-questions', 'ashfen-arrest'],
          handouts: [],
          beats: ['seed-mathr-brix'],
          blocks: [
            {
              type: 'clock',
              title: 'Clock — Saltbone Inn',
              help: '+1 simply for being in the inn · +1 for public questions about Vane · +1 if anyone approaches the black-pin man',
              controls: [1, 2, -1],
            },
            {
              type: 'npc-card',
              id: 'ta-brix',
              name: 'Brix',
              role: 'First Mate · the Coldfront',
              rows: [
                { label: 'Who', textHtml: 'Mid-forties. Short, deliberate, weathered. Sailed with Tor Ashfen twelve years. Working through a bottle every evening at the Saltbone.' },
                { label: 'Sound', textHtml: 'Quiet. Slow. After three drinks the precision slips and something underneath comes up.' },
              ],
            },
            {
              type: 'lines',
              who: 'Brix · early in the conversation',
              hint: 'slow, looking at the glass; not yet at the meat',
              lines: [
                { textHtml: '&quot;You\'re not from here. Sit. I\'m not going anywhere.&quot;' },
                { textHtml: '&quot;The orders came from Valweg. Mathr\'s house. That\'s not unusual. Half the freight through Törweg goes through Mathr\'s house.&quot;' },
              ],
            },
            {
              type: 'callout',
              variant: 'dm-only',
              label: 'DM Only',
              bodyHtml: 'Brix is the first source to physically describe the black-pin man and place him in the company of Aldric\'s housecarl.',
            },
            {
              type: 'actions',
              label: 'Mark what landed',
              actions: [
                { kind: 'fact', id: 'ashfen-questions', label: 'Ashfen returned asking different questions' },
                { kind: 'fact', id: 'ashfen-arrest', label: 'Black-pin man took Ashfen' },
                { kind: 'beat', id: 'seed-mathr-brix', label: 'Brix dropped Mathr\'s name as ordinary freight context' },
              ],
            },
          ],
          notesMd: 'Thread A support scene for the Saltbone Inn lead.',
        },
        {
          id: 'thread-c',
          label: 'C · Pell Duvash',
          kind: 'thread',
          order: 63,
          meta: 'Scene 5 · Thread C · Upper Market',
          title: 'Pell Duvash',
          summary: 'A man who has been waiting for somebody to ask. Assassins arrive 10–15 minutes in.',
          facts: ['duvash-three-letters', 'kohlmar', 'duvash-attacked'],
          handouts: [],
          beats: [],
          blocks: [
            {
              type: 'npc-card',
              id: 'tc-duvash',
              name: 'Pell Duvash',
              role: 'Merchant · Upper Market',
              rows: [
                { label: 'Who', textHtml: 'Mid-fifties. Soft hands. Quiet eyes. Intermediary for three transactions of very old objects moving south.' },
                { label: 'Want', textHtml: 'To tell someone what he has been carrying. To survive.' },
              ],
            },
            {
              type: 'lines',
              who: 'Duvash · opening',
              hint: 'relieved, not surprised',
              lines: [
                { textHtml: '&quot;Sit. Please. I have been waiting for someone who would actually listen.&quot;' },
                { textHtml: '&quot;There was a note. Stay, and tell the truth to whoever comes. I have been waiting.&quot;' },
              ],
            },
            {
              type: 'table',
              columns: ['Sense', 'What they perceive'],
              rows: [
                { cellsHtml: ['Sound', 'The back of the building has been quiet. It is suddenly less quiet.'] },
                { cellsHtml: ['Sight', 'Two figures at the back of the room. They did not come through the front.'] },
              ],
            },
            {
              type: 'banner',
              variant: 'initiative',
              text: 'Roll for Initiative · reveal both assassin tokens · Duvash between them and the players',
            },
            {
              type: 'actions',
              label: 'Mark what landed',
              actions: [
                { kind: 'fact', id: 'duvash-three-letters', label: 'The third letter is in a different hand' },
                { kind: 'fact', id: 'kohlmar', label: 'Kohlmar named (Bruithwr)' },
                { kind: 'fact', id: 'duvash-attacked', label: 'Assassins came for Duvash' },
              ],
            },
          ],
          notesMd: 'Thread C pressure-cooker scene for Duvash.',
        },
        {
          id: 'thread-d',
          label: 'D · The Records',
          kind: 'thread',
          order: 64,
          meta: 'Scene 5 · Thread D · Council Archives',
          title: "The Records - Mathr's Family",
          summary: 'Sixty years ago, fully formed, no antecedent. The arithmetic Vane has never done.',
          facts: ['mathr-no-antecedent', 'vane-elevated', 'mathr-arithmetic'],
          handouts: ['H11'],
          beats: ['seed-mathr-brynja'],
          blocks: [
            {
              type: 'clock',
              title: 'Clock — the archives are public',
              help: '+1 for asking the clerk for family records by name · 0 for general browsing',
              controls: [1, -1],
            },
            {
              type: 'heading',
              text: 'The Clerk',
            },
            {
              type: 'paragraph',
              bodyHtml: 'Mid-thirties. Quiet. Reads everything that crosses his desk. Has noticed nothing officially. Has noticed everything personally.',
            },
            {
              type: 'read-aloud',
              speaker: 'Serris',
              bodyHtml: '&quot;Mathr\'s family has no antecedent. Vane\'s family has antecedent, but their elevation is contemporaneous with Mathr\'s family\'s appearance.&quot;',
            },
            {
              type: 'actions',
              label: 'Handout',
              actions: [
                { kind: 'handout', id: 'H11', label: 'Mathr Family Tree' },
              ],
            },
            {
              type: 'actions',
              label: 'Mark what landed',
              actions: [
                { kind: 'fact', id: 'mathr-no-antecedent', label: 'Mathr\'s family has no antecedent' },
                { kind: 'fact', id: 'vane-elevated', label: 'Vanes elevated by Mathr\'s grandfather' },
                { kind: 'fact', id: 'mathr-arithmetic', label: 'The Mathr arithmetic' },
                { kind: 'beat', id: 'seed-mathr-brynja', label: 'Brynja landed the missing-origin Mathr seed' },
              ],
            },
          ],
          notesMd: 'Thread D archive scene for the missing-origin records.',
        },
      ],
    };

    expect(validate(payload)).toBe(true);
  });

  it('validates chapter trigger rules including beat-driven thread updates', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-triggers.json'));
    const payload = {
      id: 'chapter-2-triggers',
      type: 'chapter-triggers',
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'tests/fixtures/chapter-2',
      importStatus: 'test',
      triggers: [
        {
          on: 'fact',
          id: 'mathr-name-seeded',
          threadId: 'mathr-arithmetic',
          setStatus: 'hot',
        },
        {
          on: 'beat',
          id: 'ambient-smoothing',
          threadId: 'torweg-thinning',
          setStatus: 'simmering',
        },
      ],
    };

    expect(validate(payload)).toBe(true);
  });

  it('validates chapter radar entries for the tracker prompt layer', () => {
    const validate = getValidator(join(SCHEMAS_ROOT, 'chapters', 'chapter-radar.json'));
    const payload = {
      id: 'chapter-2-radar',
      type: 'chapter-radar',
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'tests/fixtures/chapter-2',
      importStatus: 'test',
      radar: [
        {
          id: 'b',
          nav: 'thread-b',
          worldThreadId: 'aeorian-note-ashvein',
          title: 'The Maw',
          surface: 'Brynja, the Carver, Ragnfrid',
          relation: 'The artefacts, the spiral geometry, and the same wrongness that touched Halvash.',
          hook: 'Use the Carver or Brynja to make the Maw feel urgent.',
          cueScenes: ['scene4', 'scene5'],
          cueText: 'The Maw can become urgent here.',
          currentThreadStatus: 'hot',
          type: 'chapter-radar-entry',
          chapter: 'chapter-2',
        },
      ],
    };

    expect(validate(payload)).toBe(true);
  });
});
