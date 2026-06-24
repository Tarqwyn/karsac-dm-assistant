import { useEffect, useMemo, useState } from 'react'
import type {
  ChapterBundle,
  ChapterPlan,
  ChapterPlanBeat,
  ChapterPlanCheckpoint,
  ChapterPlanFact,
  ChapterPlanHandout,
  ChapterPlanScene,
  ProposalSummary,
  WorldThread,
} from '@karsac/shared'

type WorkspaceError = Error & { scaffold?: Record<string, unknown>; statusCode?: number }

type Props = {
  chapterId: string
  chapterDetail: ChapterBundle | null
  chapterPlanData: { plan: ChapterPlan } | null
  chapterPlanError: unknown
  chapterPlanLoading: boolean
  proposals: ProposalSummary[]
  worldThreads: WorldThread[]
  notice: string
  error: string
  busy: boolean
  onSave: (plan: ChapterPlan) => Promise<void>
  onMaterialize: () => Promise<void>
}

function createPlanScaffold(chapterId: string): ChapterPlan {
  const chapterNumber = chapterId.match(/^chapter-(\d+)$/)?.[1]
  return {
    id: `${chapterId}-plan`,
    type: 'chapter-plan',
    campaign: 'karsac',
    chapterId,
    source: 'authored',
    importStatus: 'live',
    title: chapterNumber ? `Chapter ${chapterNumber}` : chapterId,
    updatedAt: new Date().toISOString(),
    notes: '',
    scenes: [],
    threads: [],
    checkpoints: [],
  }
}

function proposalRefStatus(proposal: ProposalSummary | undefined): 'promoted' | 'reviewed' | 'proposed' | 'missing' {
  if (!proposal) return 'missing'
  if (proposal.status === 'promoted') return 'promoted'
  if (proposal.review?.reviewed || proposal.review?.review_status === 'approved') return 'reviewed'
  return 'proposed'
}

function proposalStatusClass(status: string): string {
  return status === 'promoted'
    ? 'status-chip proposal-promoted'
    : status === 'reviewed'
      ? 'status-chip proposal-reviewed'
      : status === 'proposed'
        ? 'status-chip proposal-proposed'
        : 'status-chip proposal-missing'
}

function clonePlan<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nextSceneId(scenes: ChapterPlanScene[]): string {
  const next = scenes.length + 1
  return `scene-${next}`
}

function nextItemId(prefix: string, items: Array<{ id: string }>): string {
  let index = items.length + 1
  let candidate = `${prefix}-${index}`
  const used = new Set(items.map((item) => item.id))
  while (used.has(candidate)) {
    index += 1
    candidate = `${prefix}-${index}`
  }
  return candidate
}

function errorScaffold(error: unknown, chapterId: string): ChapterPlan {
  const candidate = (error as WorkspaceError | null)?.scaffold
  if (candidate && typeof candidate === 'object') {
    return candidate as ChapterPlan
  }
  return createPlanScaffold(chapterId)
}

export function ChapterCompositionWorkspace({
  chapterId,
  chapterDetail,
  chapterPlanData,
  chapterPlanError,
  chapterPlanLoading,
  proposals,
  worldThreads,
  notice,
  error,
  busy,
  onSave,
  onMaterialize,
}: Props): JSX.Element {
  const [plan, setPlan] = useState<ChapterPlan>(() => createPlanScaffold(chapterId))
  const [selectedSceneId, setSelectedSceneId] = useState('')

  useEffect(() => {
    if (chapterPlanData?.plan) {
      setPlan(chapterPlanData.plan)
      setSelectedSceneId((current) => current || chapterPlanData.plan.scenes[0]?.id || '')
      return
    }
    if ((chapterPlanError as WorkspaceError | null)?.statusCode === 404) {
      const scaffold = errorScaffold(chapterPlanError, chapterId)
      setPlan(scaffold)
      setSelectedSceneId(scaffold.scenes[0]?.id || '')
      return
    }
    setPlan(createPlanScaffold(chapterId))
    setSelectedSceneId('')
  }, [chapterId, chapterPlanData, chapterPlanError])

  const proposalMap = useMemo(() => new Map(proposals.map((proposal) => [proposal.id, proposal])), [proposals])
  const sceneProposals = useMemo(() => proposals.filter((proposal) => proposal.proposalType === 'scene'), [proposals])
  const npcProposals = useMemo(() => proposals.filter((proposal) => proposal.proposalType === 'npc'), [proposals])
  const placeProposals = useMemo(() => proposals.filter((proposal) => proposal.proposalType === 'place'), [proposals])
  const selectedScene = plan.scenes.find((scene) => scene.id === selectedSceneId) || plan.scenes[0] || null
  const unresolvedRefs = useMemo(() => {
    const refs = plan.scenes.flatMap((scene) => [
      scene.artifactRef,
      ...(scene.npcs ?? []),
      ...(scene.places ?? []),
    ].filter((value): value is string => Boolean(value)))
    return refs.filter((proposalId) => proposalRefStatus(proposalMap.get(proposalId)) !== 'promoted')
  }, [plan.scenes, proposalMap])

  function updatePlan(mutator: (current: ChapterPlan) => ChapterPlan): void {
    setPlan((current) => mutator(clonePlan(current)))
  }

  function updateScene(sceneId: string, mutator: (scene: ChapterPlanScene) => void): void {
    updatePlan((current) => {
      const scene = current.scenes.find((entry) => entry.id === sceneId)
      if (scene) mutator(scene)
      return current
    })
  }

  function addScene(): void {
    updatePlan((current) => {
      const sceneId = nextSceneId(current.scenes)
      current.scenes.push({
        id: sceneId,
        label: `Scene ${current.scenes.length + 1}`,
        kind: 'opening',
        order: (current.scenes.at(-1)?.order ?? 0) + 10,
        summary: '',
        artifactRef: null,
        npcs: [],
        places: [],
        beats: [],
        facts: [],
        handouts: [],
      })
      return current
    })
    setSelectedSceneId(nextSceneId(plan.scenes))
  }

  function removeScene(sceneId: string): void {
    updatePlan((current) => {
      current.scenes = current.scenes.filter((scene) => scene.id !== sceneId)
      current.checkpoints = current.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        sceneIds: checkpoint.sceneIds.filter((id) => id !== sceneId),
      }))
      current.threads = current.threads.map((thread) => ({
        ...thread,
        cueSceneIds: (thread.cueSceneIds ?? []).filter((id) => id !== sceneId),
      }))
      return current
    })
    if (selectedSceneId === sceneId) {
      setSelectedSceneId(plan.scenes.find((scene) => scene.id !== sceneId)?.id || '')
    }
  }

  function moveScene(sceneId: string, direction: -1 | 1): void {
    updatePlan((current) => {
      const index = current.scenes.findIndex((scene) => scene.id === sceneId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.scenes.length) return current
      const [scene] = current.scenes.splice(index, 1)
      current.scenes.splice(nextIndex, 0, scene)
      current.scenes = current.scenes.map((entry, sceneIndex) => ({ ...entry, order: (sceneIndex + 1) * 10 }))
      return current
    })
  }

  function addBeat(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.beats.push({ id: nextItemId('beat', scene.beats), label: 'New beat', desc: '' })
    })
  }

  function addFact(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.facts.push({ id: nextItemId('fact', scene.facts), label: 'New fact', desc: '' })
    })
  }

  function addHandout(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.handouts.push({ id: nextItemId('handout', scene.handouts), label: 'New handout', desc: '' })
    })
  }

  function updateNestedItem<T extends ChapterPlanBeat | ChapterPlanFact | ChapterPlanHandout>(
    key: 'beats' | 'facts' | 'handouts',
    itemId: string,
    patch: Partial<T>,
  ): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene[key] = scene[key].map((item) => (item.id === itemId ? { ...item, ...patch } : item)) as ChapterPlanScene[typeof key]
    })
  }

  function removeNestedItem(key: 'beats' | 'facts' | 'handouts', itemId: string): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene[key] = scene[key].filter((item) => item.id !== itemId) as ChapterPlanScene[typeof key]
    })
  }

  function addThread(): void {
    updatePlan((current) => {
      current.threads.push({
        threadId: worldThreads[0]?.id || 'thread-id',
        hook: '',
        cueSceneIds: selectedScene ? [selectedScene.id] : [],
      })
      return current
    })
  }

  function addCheckpoint(): void {
    updatePlan((current) => {
      current.checkpoints.push({
        id: nextItemId('checkpoint', current.checkpoints),
        index: current.checkpoints.length,
        label: `Checkpoint ${current.checkpoints.length + 1}`,
        sceneIds: selectedScene ? [selectedScene.id] : [],
        pauseLabel: null,
      })
      return current
    })
  }

  async function handleSave(): Promise<void> {
    await onSave(plan)
  }

  return (
    <div className="composition-shell">
      <div className="composition-head">
        <div>
          <div className="workspace-kicker">Chapter Composition</div>
          <h3>{plan.title}</h3>
          <p className="chapter-draft-meta">
            Compose proposal-backed scenes with chapter-local joins, then materialise explicit tracker state.
          </p>
        </div>
        <div className="composition-actions">
          <button className="chapter-mini-btn" disabled={busy} onClick={() => void handleSave()}>
            Save plan
          </button>
          <button className="chapter-mini-btn" disabled={busy} onClick={() => void onMaterialize()}>
            Materialise
          </button>
        </div>
      </div>

      {(notice || error) && (
        <div className={error ? 'error-card' : 'placeholder-card'}>
          {error || notice}
        </div>
      )}

      {chapterPlanLoading ? (
        <div className="placeholder-card">Loading chapter plan…</div>
      ) : (
        <>
          <div className="chapter-draft-grid">
            <label className="chapter-draft-field">
              <span>Plan title</span>
              <input value={plan.title} onChange={(event) => setPlan({ ...plan, title: event.target.value })} />
            </label>
            <label className="chapter-draft-field chapter-draft-field-wide">
              <span>Plan notes</span>
              <textarea rows={3} value={plan.notes || ''} onChange={(event) => setPlan({ ...plan, notes: event.target.value })} />
            </label>
          </div>

          <div className="composition-summary-grid">
            <div className="chapter-progress-item">
              <span>Scenes</span>
              <strong>{plan.scenes.length}</strong>
            </div>
            <div className="chapter-progress-item">
              <span>Threads</span>
              <strong>{plan.threads.length}</strong>
            </div>
            <div className="chapter-progress-item">
              <span>Checkpoints</span>
              <strong>{plan.checkpoints.length}</strong>
            </div>
            <div className="chapter-progress-item">
              <span>Unready refs</span>
              <strong>{unresolvedRefs.length}</strong>
            </div>
          </div>

          <div className="composition-layout">
            <div className="composition-column">
              <div className="content-block markdown-block">
                <div className="chapter-drill-head">
                  <h4>Scene Plan</h4>
                  <button className="chapter-mini-btn" onClick={addScene}>Add scene</button>
                </div>
                  <div className="chapter-lane">
                    {plan.scenes.length ? plan.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className={selectedScene?.id === scene.id ? 'chapter-drill-card active' : 'chapter-drill-card'}
                      onClick={() => setSelectedSceneId(scene.id)}
                    >
                      <div className="chapter-drill-head">
                        <strong>{scene.label}</strong>
                        <span className="status-chip subtle">{scene.kind}</span>
                      </div>
                      <div className="chapter-drill-meta">{scene.summary || 'No scene summary yet.'}</div>
                      <div className="chapter-scene-actions">
                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); moveScene(scene.id, -1) }} disabled={index === 0}>
                          Up
                        </button>
                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); moveScene(scene.id, 1) }} disabled={index === plan.scenes.length - 1}>
                          Down
                        </button>
                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); removeScene(scene.id) }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )) : <div className="placeholder-card">No scenes yet. Add a scene to start the chapter plan.</div>}
                </div>
              </div>

              <div className="content-block markdown-block">
                <div className="chapter-drill-head">
                  <h4>Proposal Inputs</h4>
                  <span className="status-chip subtle">{proposals.length} proposals</span>
                </div>
                <div className="composition-catalog">
                  <div>
                    <h5>Scenes</h5>
                    {sceneProposals.map((proposal) => (
                      <div key={proposal.id} className="composition-ref-card">
                        <div>
                          <strong>{proposal.title}</strong>
                          <div className="entity-id">{proposal.id}</div>
                        </div>
                        <span className={proposalStatusClass(proposalRefStatus(proposal))}>{proposalRefStatus(proposal)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h5>NPCs</h5>
                    {npcProposals.map((proposal) => (
                      <div key={proposal.id} className="composition-ref-card">
                        <div>
                          <strong>{proposal.title}</strong>
                          <div className="entity-id">{proposal.id}</div>
                        </div>
                        <span className={proposalStatusClass(proposalRefStatus(proposal))}>{proposalRefStatus(proposal)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h5>Places</h5>
                    {placeProposals.map((proposal) => (
                      <div key={proposal.id} className="composition-ref-card">
                        <div>
                          <strong>{proposal.title}</strong>
                          <div className="entity-id">{proposal.id}</div>
                        </div>
                        <span className={proposalStatusClass(proposalRefStatus(proposal))}>{proposalRefStatus(proposal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="composition-column">
              {selectedScene ? (
                <div className="chapter-inspector-card">
                  <div className="chapter-drill-head">
                    <strong>Edit scene</strong>
                    <span className="status-chip subtle">{selectedScene.id}</span>
                  </div>
                  <div className="chapter-draft-grid">
                    <label className="chapter-draft-field">
                      <span>Label</span>
                      <input value={selectedScene.label} onChange={(event) => updateScene(selectedScene.id, (scene) => { scene.label = event.target.value })} />
                    </label>
                    <label className="chapter-draft-field">
                      <span>Kind</span>
                      <select value={selectedScene.kind} onChange={(event) => updateScene(selectedScene.id, (scene) => { scene.kind = event.target.value })}>
                        <option value="opening">opening</option>
                        <option value="middle">middle</option>
                        <option value="climax">climax</option>
                        <option value="interlude">interlude</option>
                        <option value="closing">closing</option>
                        <option value="optional">optional</option>
                      </select>
                    </label>
                    <label className="chapter-draft-field">
                      <span>Order</span>
                      <input type="number" value={selectedScene.order} onChange={(event) => updateScene(selectedScene.id, (scene) => { scene.order = Number(event.target.value) || 0 })} />
                    </label>
                    <label className="chapter-draft-field chapter-draft-field-wide">
                      <span>Summary</span>
                      <textarea rows={4} value={selectedScene.summary} onChange={(event) => updateScene(selectedScene.id, (scene) => { scene.summary = event.target.value })} />
                    </label>
                    <label className="chapter-draft-field chapter-draft-field-wide">
                      <span>Scene artifact</span>
                      <select
                        value={selectedScene.artifactRef || ''}
                        onChange={(event) => updateScene(selectedScene.id, (scene) => { scene.artifactRef = event.target.value || null })}
                      >
                        <option value="">No linked scene proposal</option>
                        {sceneProposals.map((proposal) => (
                          <option key={proposal.id} value={proposal.id}>{proposal.title}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="composition-join-section">
                    <h4>Scene joins</h4>
                    <div className="composition-join-grid">
                      <div>
                        <div className="chapter-scene-meta">NPCs</div>
                        <div className="composition-toggle-list">
                          {npcProposals.map((proposal) => {
                            const active = (selectedScene.npcs ?? []).includes(proposal.id)
                            return (
                              <button
                                key={proposal.id}
                                className={active ? 'chapter-mini-btn active-chip' : 'chapter-mini-btn'}
                                onClick={() => updateScene(selectedScene.id, (scene) => {
                                  scene.npcs = active ? (scene.npcs ?? []).filter((id) => id !== proposal.id) : [...(scene.npcs ?? []), proposal.id]
                                })}
                              >
                                {proposal.title}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="chapter-scene-meta">Places</div>
                        <div className="composition-toggle-list">
                          {placeProposals.map((proposal) => {
                            const active = (selectedScene.places ?? []).includes(proposal.id)
                            return (
                              <button
                                key={proposal.id}
                                className={active ? 'chapter-mini-btn active-chip' : 'chapter-mini-btn'}
                                onClick={() => updateScene(selectedScene.id, (scene) => {
                                  scene.places = active ? (scene.places ?? []).filter((id) => id !== proposal.id) : [...(scene.places ?? []), proposal.id]
                                })}
                              >
                                {proposal.title}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="composition-join-section">
                    <div className="chapter-drill-head">
                      <h4>Beats</h4>
                      <button className="chapter-mini-btn" onClick={addBeat}>Add beat</button>
                    </div>
                    <div className="chapter-lane">
                      {selectedScene.beats.map((beat) => (
                        <div key={beat.id} className="chapter-drill-card">
                          <div className="chapter-draft-grid">
                            <label className="chapter-draft-field">
                              <span>Id</span>
                              <input value={beat.id} onChange={(event) => updateNestedItem('beats', beat.id, { id: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field">
                              <span>Label</span>
                              <input value={beat.label} onChange={(event) => updateNestedItem('beats', beat.id, { label: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field chapter-draft-field-wide">
                              <span>Description</span>
                              <textarea rows={2} value={beat.desc} onChange={(event) => updateNestedItem('beats', beat.id, { desc: event.target.value })} />
                            </label>
                          </div>
                          <button className="chapter-mini-btn" onClick={() => removeNestedItem('beats', beat.id)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="composition-join-section">
                    <div className="chapter-drill-head">
                      <h4>Facts</h4>
                      <button className="chapter-mini-btn" onClick={addFact}>Add fact</button>
                    </div>
                    <div className="chapter-lane">
                      {selectedScene.facts.map((fact) => (
                        <div key={fact.id} className="chapter-drill-card">
                          <div className="chapter-draft-grid">
                            <label className="chapter-draft-field">
                              <span>Id</span>
                              <input value={fact.id} onChange={(event) => updateNestedItem('facts', fact.id, { id: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field">
                              <span>Label</span>
                              <input value={fact.label} onChange={(event) => updateNestedItem('facts', fact.id, { label: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field chapter-draft-field-wide">
                              <span>Description</span>
                              <textarea rows={2} value={fact.desc || ''} onChange={(event) => updateNestedItem('facts', fact.id, { desc: event.target.value })} />
                            </label>
                          </div>
                          <button className="chapter-mini-btn" onClick={() => removeNestedItem('facts', fact.id)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="composition-join-section">
                    <div className="chapter-drill-head">
                      <h4>Handouts</h4>
                      <button className="chapter-mini-btn" onClick={addHandout}>Add handout</button>
                    </div>
                    <div className="chapter-lane">
                      {selectedScene.handouts.map((handout) => (
                        <div key={handout.id} className="chapter-drill-card">
                          <div className="chapter-draft-grid">
                            <label className="chapter-draft-field">
                              <span>Id</span>
                              <input value={handout.id} onChange={(event) => updateNestedItem('handouts', handout.id, { id: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field">
                              <span>Label</span>
                              <input value={handout.label} onChange={(event) => updateNestedItem('handouts', handout.id, { label: event.target.value })} />
                            </label>
                            <label className="chapter-draft-field chapter-draft-field-wide">
                              <span>Description</span>
                              <textarea rows={2} value={handout.desc || ''} onChange={(event) => updateNestedItem('handouts', handout.id, { desc: event.target.value })} />
                            </label>
                          </div>
                          <button className="chapter-mini-btn" onClick={() => removeNestedItem('handouts', handout.id)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="placeholder-card">Select or add a scene to edit joins and chapter-local assembly data.</div>
              )}

              <div className="chapter-inspector-card">
                <div className="chapter-drill-head">
                  <h4>Threads</h4>
                  <button className="chapter-mini-btn" onClick={addThread}>Add thread</button>
                </div>
                <div className="chapter-lane">
                  {plan.threads.map((thread, index) => (
                    <div key={`${thread.threadId}-${index}`} className="chapter-drill-card">
                      <div className="chapter-draft-grid">
                        <label className="chapter-draft-field">
                          <span>Thread</span>
                          <select
                            value={thread.threadId}
                            onChange={(event) => updatePlan((current) => {
                              current.threads[index].threadId = event.target.value
                              return current
                            })}
                          >
                            {worldThreads.map((worldThread) => (
                              <option key={worldThread.id} value={worldThread.id}>{worldThread.name || worldThread.id}</option>
                            ))}
                          </select>
                        </label>
                        <label className="chapter-draft-field chapter-draft-field-wide">
                          <span>Hook</span>
                          <textarea
                            rows={2}
                            value={thread.hook}
                            onChange={(event) => updatePlan((current) => {
                              current.threads[index].hook = event.target.value
                              return current
                            })}
                          />
                        </label>
                      </div>
                      <div className="composition-toggle-list">
                        {plan.scenes.map((scene) => {
                          const active = (thread.cueSceneIds ?? []).includes(scene.id)
                          return (
                            <button
                              key={scene.id}
                              className={active ? 'chapter-mini-btn active-chip' : 'chapter-mini-btn'}
                              onClick={() => updatePlan((current) => {
                                const cueSceneIds = current.threads[index].cueSceneIds ?? []
                                current.threads[index].cueSceneIds = active
                                  ? cueSceneIds.filter((id) => id !== scene.id)
                                  : [...cueSceneIds, scene.id]
                                return current
                              })}
                            >
                              {scene.label}
                            </button>
                          )
                        })}
                      </div>
                      <button className="chapter-mini-btn" onClick={() => updatePlan((current) => {
                        current.threads.splice(index, 1)
                        return current
                      })}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chapter-inspector-card">
                <div className="chapter-drill-head">
                  <h4>Checkpoints</h4>
                  <button className="chapter-mini-btn" onClick={addCheckpoint}>Add checkpoint</button>
                </div>
                <div className="chapter-lane">
                  {plan.checkpoints.map((checkpoint, index) => (
                    <div key={checkpoint.id} className="chapter-drill-card">
                      <div className="chapter-draft-grid">
                        <label className="chapter-draft-field">
                          <span>Label</span>
                          <input value={checkpoint.label} onChange={(event) => updatePlan((current) => {
                            current.checkpoints[index].label = event.target.value
                            return current
                          })} />
                        </label>
                        <label className="chapter-draft-field">
                          <span>Index</span>
                          <input type="number" value={checkpoint.index} onChange={(event) => updatePlan((current) => {
                            current.checkpoints[index].index = Number(event.target.value) || 0
                            return current
                          })} />
                        </label>
                        <label className="chapter-draft-field chapter-draft-field-wide">
                          <span>Pause label</span>
                          <input value={checkpoint.pauseLabel || ''} onChange={(event) => updatePlan((current) => {
                            current.checkpoints[index].pauseLabel = event.target.value || null
                            return current
                          })} />
                        </label>
                      </div>
                      <div className="composition-toggle-list">
                        {plan.scenes.map((scene) => {
                          const active = checkpoint.sceneIds.includes(scene.id)
                          return (
                            <button
                              key={scene.id}
                              className={active ? 'chapter-mini-btn active-chip' : 'chapter-mini-btn'}
                              onClick={() => updatePlan((current) => {
                                const sceneIds = current.checkpoints[index].sceneIds
                                current.checkpoints[index].sceneIds = active
                                  ? sceneIds.filter((id) => id !== scene.id)
                                  : [...sceneIds, scene.id]
                                return current
                              })}
                            >
                              {scene.label}
                            </button>
                          )
                        })}
                      </div>
                      <button className="chapter-mini-btn" onClick={() => updatePlan((current) => {
                        current.checkpoints.splice(index, 1)
                        return current
                      })}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chapter-inspector-card">
                <h4>Materialised Output</h4>
                {chapterDetail ? (
                  <div className="detail-grid">
                    <div><span>Facts</span><strong>{chapterDetail.facts?.facts?.length || 0}</strong></div>
                    <div><span>Handouts</span><strong>{chapterDetail.handouts?.handouts?.length || 0}</strong></div>
                    <div><span>Beats</span><strong>{chapterDetail.beats?.beats?.length || 0}</strong></div>
                    <div><span>Scenes</span><strong>{chapterDetail.scenes?.scenes?.length || 0}</strong></div>
                  </div>
                ) : (
                  <div className="placeholder-card">Materialised state will appear here after you run the materialiser.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
