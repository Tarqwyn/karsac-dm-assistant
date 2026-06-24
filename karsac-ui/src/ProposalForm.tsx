import { useState } from 'react'
import type { ProposalDetail, ProposalType } from '@karsac/shared'

const PROPOSAL_TYPES: ProposalType[] = [
  'npc', 'place', 'item', 'scene', 'chapter-outline',
  'adversary', 'encounter', 'handout', 'clue', 'session-outline', 'state-update',
]

interface CreateProps {
  mode: 'create'
  onCancel: () => void
  onCreate: (type: ProposalType, title: string, summary: string) => void
  onGenerate: (type: ProposalType, prompt: string) => void
  isPending: boolean
  error: string
}

interface EditProps {
  mode: 'edit'
  proposal: ProposalDetail
  onCancel: () => void
  onSave: (title: string, summary: string, body: string) => void
  isPending: boolean
  error: string
}

type ProposalFormProps = CreateProps | EditProps

export function ProposalForm(props: ProposalFormProps) {
  const isEdit = props.mode === 'edit'

  const [authMethod, setAuthMethod] = useState<'manual' | 'ai'>('manual')
  const [proposalType, setProposalType] = useState<ProposalType>(
    isEdit ? (props as EditProps).proposal.proposalType as ProposalType : 'npc',
  )
  const [title, setTitle] = useState(isEdit ? (props as EditProps).proposal.title : '')
  const [summary, setSummary] = useState(isEdit ? (props as EditProps).proposal.summary : '')
  const [body, setBody] = useState(isEdit ? (props as EditProps).proposal.body : '')
  const [prompt, setPrompt] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      const ep = props as EditProps
      ep.onSave(title, summary, body)
    } else {
      const cp = props as CreateProps
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

      {props.error && <div className="error-card">{props.error}</div>}

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
              placeholder="Describe what to generate…"
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
            <div className="proposal-form-row">
              <label>
                <span>Body</span>
                <textarea
                  rows={16}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Proposal body (Markdown)"
                />
              </label>
            </div>
          )}
        </>
      )}

      <div className="proposal-form-actions">
        <button type="submit" className="nav-item" disabled={props.isPending}>
          {props.isPending
            ? isEdit ? 'Saving…' : authMethod === 'ai' ? 'Generating…' : 'Creating…'
            : isEdit ? 'Save' : authMethod === 'ai' ? 'Generate' : 'Create'}
        </button>
      </div>
    </form>
  )
}
