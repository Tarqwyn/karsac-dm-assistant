# Architecture Diagram

> **Principle:** Models propose. Code governs.

The diagrams below show the full system as agreed in ADR-0001 (lifecycle) and ADR-0002 (canonical indexing and read modes).

---

## 1. Full System Overview

```mermaid
graph TD
    subgraph INPUT["Input Layer"]
        UI["Open WebUI / Chat"]
        CLI["CLI Commands"]
        HAND["Hand-authored Markdown"]
    end

    subgraph GATEWAY["Gateway (OpenAI-compatible API)"]
        GW["gateway/server.ts\nRoute: chat / promote / ask"]
    end

    subgraph PIPELINE["Proposal Pipeline"]
        direction TB
        ROUTER["Router\nproposalRouting.ts\nDetects type + profile"]
        ANCHOR["Corpus Anchor\nproposalEntityRegistry.ts\nLoads canon snippets"]
        CONSTRAINT["Constraint Builder\nproposalConstraints.ts\nAssembles model brief"]
        LLM["LLM\nLocal: Ollama / ollama-js\nDeployed: edge API\nGeneration only"]
        TREATMENT["Creative Treatment\nLocal: qwen3:14b\nDeployed: edge API\nDoctrine + prose polish"]
        PRUNER["Pruner\nproposalPruner.ts\nStrips forbidden content"]
        VALIDATOR["Validator\nStructural + Governance\n+ Anchor Content"]
        WRITER["Proposal Writer\nproposalWriter.ts"]
    end

    subgraph CORPUS["Corpus — Source of Truth"]
        direction TB
        PROPOSALS["corpus/proposals/\nstatus: proposed\ncanonical: provisional\n⬆ AI or hand-authored"]
        PLANNING["corpus/planning/\nstatus: promoted\ncanonical: provisional → true\n⬆ via promote pipeline"]
        COLLECTIONS["corpus/collections/\nLegacy hand-authored canon\ncanonical: true (implicit)\n⬆ does not grow"]
        ADVERSARY["corpus/adversary-corpus/\nAdversary design source\nRead live by ask.ts"]
        STATE["corpus/state/\nMaterialised runtime state\nJSON — session-driven"]
        REGISTRY["corpus/registry/\nYAML policy files\nEntity + faction rules"]
    end

    subgraph PROMOTER["Promotion Pipeline"]
        REVIEW["Human Review\n+ Validation Gate"]
        PROMOTER_TS["proposalPromoter.ts\n--force off by default"]
        BUILDINDEX["buildIndex\nScans collections/ + planning/\nFilters by canonical status\n→ .karsac-index/"]
        MATERIALISE["materializeChapterState.ts\nChapter seed → corpus/state/"]
    end

    subgraph RETRIEVAL["Retrieval — Two Read Modes"]
        LIVE["LIVE MODE (default)\ncanonical: true only\nCurrent chapter state"]
        PLANNING_MODE["PLANNING MODE (explicit)\nIncludes canonical: provisional\nFuture chapter material"]
        ASK["ask.ts\nProfile-based context assembly"]
    end

    subgraph TRACKER["Tracker + Session"]
        STATE_SVC["state/service.ts\nMutation API\nAtomic writes + state-log"]
        SESSION_CLOSE["Session Close\n(planned)\nExport → corpus/state/"]
    end

    %% Input flows
    UI --> GW
    CLI --> PIPELINE
    HAND --> PROPOSALS

    %% Gateway routing
    GW --> PIPELINE
    GW --> PROMOTER
    GW --> ASK

    %% Pipeline flow
    ROUTER --> ANCHOR
    ANCHOR --> CONSTRAINT
    CONSTRAINT --> LLM
    LLM --> TREATMENT
    TREATMENT --> PRUNER
    PRUNER --> VALIDATOR
    VALIDATOR --> WRITER
    WRITER --> PROPOSALS

    %% Registry feeds pipeline
    REGISTRY --> CONSTRAINT
    REGISTRY --> VALIDATOR

    %% Promotion flow
    PROPOSALS --> REVIEW
    REVIEW --> PROMOTER_TS
    PROMOTER_TS --> PLANNING
    PROMOTER_TS --> BUILDINDEX
    PROMOTER_TS --> MATERIALISE
    MATERIALISE --> STATE

    %% Index feeds retrieval
    BUILDINDEX --> LIVE
    BUILDINDEX --> PLANNING_MODE
    COLLECTIONS --> BUILDINDEX
    PLANNING --> BUILDINDEX
    ADVERSARY --> ASK

    %% Retrieval feeds ask
    LIVE --> ASK
    PLANNING_MODE --> ASK
    STATE --> ASK

    %% Tracker
    ASK --> UI
    STATE --> TRACKER
    STATE_SVC --> STATE
    TRACKER --> STATE_SVC
    SESSION_CLOSE --> STATE

    %% Styling
    classDef corpus fill:#2d4a3e,color:#fff,stroke:#4a7c6f
    classDef pipeline fill:#2d3a4a,color:#fff,stroke:#4a6a8a
    classDef gateway fill:#3a2d4a,color:#fff,stroke:#6a4a8a
    classDef retrieval fill:#4a3a2d,color:#fff,stroke:#8a6a4a
    classDef tracker fill:#4a2d2d,color:#fff,stroke:#8a4a4a

    class PROPOSALS,PLANNING,COLLECTIONS,ADVERSARY,STATE,REGISTRY corpus
    class ROUTER,ANCHOR,CONSTRAINT,LLM,TREATMENT,PRUNER,VALIDATOR,WRITER pipeline
    class GW,REVIEW,PROMOTER_TS,BUILDINDEX,MATERIALISE gateway
    class LIVE,PLANNING_MODE,ASK retrieval
    class STATE_SVC,SESSION_CLOSE tracker
```

---

## 2. Lifecycle Flow

```mermaid
flowchart LR
    P["① PROPOSED\ncorpus/proposals/\ncanonical: provisional"]
    R["② REVIEWED\nValidation gate\n+ human approval\n(metadata only)"]
    PR["③ PROMOTED\ncorpus/planning/\ncanonical: provisional"]
    B["canonical: true\n(DM blesses)"]
    M["④ MATERIALISED\ncorpus/state/\nJSON runtime data"]
    T["⑤ TRACKED\nTracker runtime\n+ session mutations"]
    SC["Session Close\n(explicit export)"]

    P -->|"validate\n+ review"| R
    R -->|"promote\n(explicit)"| PR
    PR -->|"bless\n(frontmatter)"| B
    B -->|"materialise\n(chapter outline\nor type hook)"| M
    M -->|"load into\ntracker"| T
    T -->|"session close\n(explicit)"| SC
    SC -->|"export back"| M

    style P fill:#2d3a4a,color:#fff
    style R fill:#2d3a4a,color:#fff
    style PR fill:#2d4a3e,color:#fff
    style B fill:#1a3a2a,color:#fff
    style M fill:#3a2d1a,color:#fff
    style T fill:#3a1a1a,color:#fff
    style SC fill:#3a2a1a,color:#fff
```

---

## 3. Canonical Indexing and Read Modes (ADR-0002)

```mermaid
flowchart TD
    subgraph TREES["Corpus Trees"]
        C["corpus/collections/\nLegacy hand-authored\ncanonical: true (implicit)"]
        PL["corpus/planning/\nPromoted content\ncanonical: provisional or true"]
    end

    BI["buildIndex\nScans both trees\nTags entries by canonical status\n→ .karsac-index/"]

    subgraph MODES["Read Modes"]
        LIVE["LIVE MODE\nDefault for all chat +\ntracker reads\n\ncanonical: true only\nCurrent chapter scope"]
        PLAN["PLANNING MODE\nExplicit opt-in\nUI planning view\n\nIncludes provisional\nFuture chapter scope"]
    end

    ASK["ask.ts\nProfile-based assembly"]
    UI2["Chat / Tracker UI"]

    C --> BI
    PL --> BI
    BI --> LIVE
    BI --> PLAN
    LIVE -->|default| ASK
    PLAN -->|explicit| ASK
    ASK --> UI2

    note1["⚠ Far-ahead planning is safe:\nChapter 4 NPCs with canonical: provisional\nare in the index but invisible in live mode"]

    style LIVE fill:#1a3a1a,color:#fff
    style PLAN fill:#2d3a4a,color:#fff
    style note1 fill:#3a2a0a,color:#fff,stroke:#8a6a0a
```

---

## 4. Governance Precedence

```mermaid
flowchart TD
    G1["1. Explicit user constraints"]
    G2["2. Canonical entity policy\nproposal-entity-policies.yaml"]
    G3["3. Faction / profile policy\nfactions.yaml\nfaction-mechanical-overrides.yaml"]
    G4["4. Proposal type contract\nproposal-contracts.yaml"]
    G5["5. Mechanical base inheritance"]
    G6["6. Model-generated creative additions"]

    G1 --> G2 --> G3 --> G4 --> G5 --> G6

    note["Lower layers are repaired, pruned, or\nrejected when they conflict with higher layers.\nPolicy lives in YAML. Execution lives in code."]

    style G1 fill:#3a1a1a,color:#fff
    style G2 fill:#3a2a1a,color:#fff
    style G3 fill:#3a3a1a,color:#fff
    style G4 fill:#2a3a1a,color:#fff
    style G5 fill:#1a3a2a,color:#fff
    style G6 fill:#1a2a3a,color:#fff
    style note fill:#2a2a2a,color:#ccc,stroke:#666
```
