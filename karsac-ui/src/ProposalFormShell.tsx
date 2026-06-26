import { useEffect, useState } from 'react'
import type React from 'react'
import { PROPOSAL_TYPES } from '@karsac/shared'
import type { ProposalDetail, ProposalType } from '@karsac/shared'

export interface ProposalCreateShellProps {
  mode: 'create'
  onCancel: () => void
  onCreate: (type: ProposalType, title: string, summary: string) => void
  onGenerate: (type: ProposalType, prompt: string) => void
  isPending: boolean
  error: string
  initialType?: ProposalType
  contextBanner?: string
}

export interface ProposalEditShellProps {
  mode: 'edit'
  proposal: ProposalDetail
  onCancel: () => void
  onSave: (title: string, summary: string, body: string, related?: Record<string, string[]>) => void
  isPending: boolean
  error: string
}

export type ProposalFormShellProps = ProposalCreateShellProps | ProposalEditShellProps

function initialRelated(proposal: ProposalDetail): string {
  const rel = proposal.frontmatter.related
  return rel ? JSON.stringify(rel, null, 2) : ''
}

export function ProposalFormShell(props: ProposalFormShellProps) {
  const isEdit = props.mode === 'edit'
  const initialType = !isEdit ? (props as ProposalCreateShellProps).initialType : undefined

  const [authMethod, setAuthMethod] = useState<'manual' | 'ai'>('manual')
  const [proposalType, setProposalType] = useState<ProposalType>(
    isEdit
      ? (props as ProposalEditShellProps).proposal.proposalType as ProposalType
      : (initialType ?? 'npc'),
  )
  const [title, setTitle] = useState(isEdit ? (props as ProposalEditShellProps).proposal.title : '')
  const [summary, setSummary] = useState(isEdit ? (props as ProposalEditShellProps).proposal.summary : '')
  const [body, setBody] = useState(isEdit ? (props as ProposalEditShellProps).proposal.body : '')
  const [related, setRelated] = useState(isEdit ? initialRelated((props as ProposalEditShellProps).proposal) : '')
  const [prompt, setPrompt] = useState('')
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    if (initialType) {
      setProposalType(initialType)
    }
  }, [initialType])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      let parsedRelated: Record<string, string[]> | undefined
      if (related.trim()) {
        try {
          parsedRelated = JSON.parse(related)
          setParseError('')
        } catch {
          setParseError('Related field contains invalid JSON.')
          return
        }
      }
      const ep = props as ProposalEditShellProps
      ep.onSave(title, summary, body, parsedRelated)
    } else {
      const cp = props as ProposalCreateShellProps
      if (authMethod === 'ai') {
        cp.onGenerate(proposalType, prompt)
      } else {
        cp.onCreate(proposalType, title, summary)
      }
    }
  }

  return (
    <form className="proposal-form" onSubmit={handleSubmit}>
      <div className="proposal-form-head">
        <h4>{isEdit ? 'Edit proposal' : 'New proposal'}</h4>
        <button type="button" className="nav-item" onClick={props.onCancel}>
          Cancel
        </button>
      </div>

      {!isEdit && (props as ProposalCreateShellProps).contextBanner && (
        <div className="placeholder-card">{(props as ProposalCreateShellProps).contextBanner}</div>
      )}

      {(props.error || parseError) && (
        <div className="error-card">{parseError || props.error}</div>
      )}

      {!isEdit && (
        <div className="proposal-form-row">
          <label>
            <span>Method</span>
            <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value as 'manual' | 'ai')}>
              <option value="manual">Hand-authored</option>
              <option value="ai">AI-assisted</option>
            </select>
          </label>
        </div>
      )}

      {!isEdit && (
        <div className="proposal-form-row">
          <label>
            <span>Type</span>
            <select
              value={proposalType}
              onChange={(e) => setProposalType(e.target.value as ProposalType)}
            >
              {PROPOSAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!isEdit && authMethod === 'ai' ? (
        <div className="proposal-form-row">
          <label>
            <span>Prompt</span>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to generate..."
              required
            />
          </label>
        </div>
      ) : (
        <>
          <div className="proposal-form-row">
            <label>
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Proposal title"
                required
              />
            </label>
          </div>
          <div className="proposal-form-row">
            <label>
              <span>Summary</span>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary (optional)"
              />
            </label>
          </div>
          {isEdit && (
            <>
              <div className="proposal-form-row">
                <label>
                  <span>Body</span>
                  <textarea
                    rows={14}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Proposal body (Markdown)"
                  />
                </label>
              </div>
              <div className="proposal-form-row">
                <label>
                  <span>Related (JSON)</span>
                  <textarea
                    rows={8}
                    value={related}
                    onChange={(e) => { setRelated(e.target.value); setParseError('') }}
                    placeholder={'{\n  "chapters": [],\n  "npcs": [],\n  "places": []\n}'}
                  />
                </label>
              </div>
            </>
          )}
        </>
      )}

      <div className="proposal-form-actions">
        <button type="submit" className="nav-item" disabled={props.isPending}>
          {props.isPending
            ? isEdit ? 'Saving...' : authMethod === 'ai' ? 'Generating...' : 'Creating...'
            : isEdit ? 'Save' : authMethod === 'ai' ? 'Generate' : 'Create'}
        </button>
      </div>
    </form>
  )
}
