# Chapter 3 Pipeline Log

This document records the repeatable flow from AI outline to promoted chapter planning material, with the eventual goal of exposing the same flow through a frontend.

## Observed flow

1. Ask the AI for a `chapter-outline` proposal.
2. Validate the outline against the chapter contract.
3. Ensure `Scene Spine` is seed-ready:
   - 3 to 6 scenes
   - each scene has `Purpose`, `Location`, `Pressure`, `Choices`, `Clues`, `Failure`, `Exit State`
4. Promote the proposal into `corpus/planning/chapters`.
5. Review the promoted chapter for any remaining cleanup.
6. Auto-derive `corpus/state/chapters/chapter-3/seed.json` from the structured outline.
   - Completed: chapter-3 seed authored with 5 beats and seed-ready scenes.
7. Materialize chapter state from the seed.
8. Use the tracker against the assistant API during play.

## Validation gates that must stay in place

- Chapter-outline routing must win over place/encounter inference when the prompt is chapter-related.
- The proposal must pass required section validation.
- The scene spine must remain structured, not prose-only.
- Promotion must preserve `promoted_from` metadata.
- State schema validation must pass before materialization.

## Likely frontend workflow later

- Choose chapter target.
- Ask AI for outline.
- Review outline in a diff/panel.
- Promote approved outline.
- Generate seed from outline.
- Materialize chapter state.
- Hydrate tracker UI from live state.

## Notes

- Keep this flow deterministic where possible.
- AI should generate the outline, not raw state files.
- The frontend should orchestrate the same steps rather than inventing new ones.
- The seed is now derived automatically from the structured chapter outline on promotion.

### Seed materialized
- Status: complete
- Materialized chapter: chapter-3
- Seed file: corpus/state/chapters/chapter-3/seed.json
- Materializer: karsac:materialize-chapter-state -- --chapter=chapter-3
- Notes: seed schema validated before materialization; chapter state files regenerated from seed; seed auto-derived at promotion time.

### Chapter traversal
- Status: complete
- Tracker control: chapter selector in the top bar
- Lock control: current chapter can be frozen before traversal
- Backend support: persistent chapter list and locked chapter list in campaign state
- Notes: switching chapters now updates the active chapter context; locked chapters reject further state mutations.

### Live pointer
- Status: complete
- Active chapter: chapter-3
- Notes: tracker reload now opens Chapter 3 by default unless manually changed.

### Clean rematerialization
- Status: complete
- Chapter 3 now materializes from its own seed instead of inheriting Chapter 2 session imports.
- Progress is seed-driven from the Chapter 3 scene spine.
- Facts, handouts, radar, and triggers remain empty until new corpus data is added.
