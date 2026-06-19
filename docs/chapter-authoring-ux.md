# Chapter Authoring UX Blueprint

This is the frontend-facing version of the chapter authoring workflow.

The goal is not to invent a new pipeline. The goal is to expose the existing one in a UI that is easier to operate.

## Screen 1: Chapter Start

Purpose:
- choose the chapter target
- choose the input mode
- confirm the current campaign context

Controls:
- chapter selector
- input mode selector
  - CLI-style prompt
  - Open WebUI-style prompt
  - imported proposal file
- gateway status indicator
- current chapter status indicator

Primary action:
- `Generate outline`

Validation state:
- show whether the gateway is reachable
- show whether the selected chapter is locked
- show whether a seed already exists

## Screen 2: Outline Draft

Purpose:
- show the AI-generated chapter outline
- let the user review it before it becomes corpus material

Layout:
- left pane: raw proposal markdown
- right pane: extracted structured outline
- bottom pane: validation results

Important data to show:
- chapter purpose
- starting state
- player knowledge
- core pressure
- scene spine
- end state
- what this chapter changes

Primary actions:
- `Validate`
- `Edit`
- `Promote`

Validation state:
- missing headings
- malformed scene spine
- routing mismatch
- prohibited references

## Screen 3: Promotion Review

Purpose:
- confirm the proposal is the one we want to keep
- make promotion an explicit user action

What the user should see:
- proposal path
- promote target
- promotion warnings
- what will be written into planning
- what seed will be derived

Primary actions:
- `Promote chapter`
- `Cancel`

After promotion:
- show the promoted planning chapter path
- show the generated seed path
- show whether seed validation passed

## Screen 4: Seed Review

Purpose:
- let the user inspect the derived seed before materialization

Layout:
- top: seed summary
- middle: scene list
- bottom: beats / progress / tracker-facing data

Primary actions:
- `Materialize`
- `Edit seed`
- `Regenerate from outline`

Validation state:
- schema pass/fail
- missing scenes
- empty beats
- invalid scene blocks

## Screen 5: Materialization Result

Purpose:
- confirm the runtime files were regenerated
- show what the tracker will now read

What to display:
- chapter id
- progress file path
- facts file path
- handouts file path
- beats file path
- radar file path
- triggers file path
- scenes file path

Primary actions:
- `Open tracker`
- `Lock chapter`
- `Switch chapter`

## Screen 6: Tracker Preview

Purpose:
- preview the actual tracker view after materialization

What to show:
- chapter selector
- lock status
- progress/checkpoint
- facts
- handouts
- beats
- radar
- scenes

Primary actions:
- `Refresh from gateway`
- `Switch chapter`
- `Lock chapter`
- `Open current chapter`

## UX rules

- Never let the user skip schema validation silently.
- Never auto-promote a chapter outline without an explicit action.
- Never write runtime state directly if the seed is invalid.
- Always show the chapter id that each step applies to.
- Keep the outline, planning file, seed, and runtime state visually distinct.
- Make it obvious when a chapter is locked and no longer writable.

## Recommended UI flow

1. User selects a chapter target.
2. User asks for or imports a chapter outline.
3. UI shows the generated outline and validation result.
4. User promotes the outline.
5. UI shows the derived seed.
6. User materializes the seed.
7. UI opens the tracker on the active chapter.

## What this UX should make easy

- generating Chapter 4 or Chapter 5 in the same way as Chapter 3
- reviewing whether an outline is good enough before it becomes planning material
- seeing exactly what will become tracker state before it is written
- switching between chapters without losing the model of what is current and what is locked
