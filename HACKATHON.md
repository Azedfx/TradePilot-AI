# Bitget AI Base Camp S2 — Judge & Submission Pack

**Track:** 🟧 AI Trading Desk (AI Research Workbench)  
**Named sub-theme:** Review & Self-Evolution  
**Positioning:** Natural-language research desk for US stocks / Bitget Reality rTokens. AI gathers evidence and flags bad decision patterns; **the human trader makes the final call**.

> Deadline: **27 Sep 2026 (UTC+8)**. Form: https://forms.gle/GyWZCMCPocgJdJon6  
> Handbook: https://bitget-ai.gitbook.io/bitgetai_hackathons2

---

## 60-second Demo script (for judges / video)

1. Open the **public Demo URL** (Render root, not `/api`).
2. Set desk **Focus → rToken / 7×24**, **Risk → Conservative**.
3. Run: *“Analyze tokenized NVDA (rToken) weekend risk vs US market hours and cash equity basis.”*
4. Show left rail: **Bitget Reality · rNVDAUSDT** + cash basis line.
5. Expand skills: Market (Reality + vs cash), Fundamentals, Technical, Macro (7×24 note).
6. Open **Historical Scenarios** → similar shock-selloff/rally analogs with forward returns.
7. Open **Stress Testing** → Reality-vol scenarios + position size.
8. Open **Self-Evolution Review** (auto-runs on complete) → bad patterns + recurring + checklist.
9. Click **Accept** or **Reject** (human final decision — Track 3 requirement).

Record ≤3 min if Demo needs login (yours should not).

---

## Google Form — copy aids

### 1 · Thesis (highest weight)

US cash equities sleep on weekends; **Bitget Reality rTokens price 7×24**. Retail “AI research” tools still quote Yahoo/session hours and skip closed-market transmission risk. TradePilot is a **research workbench** that (a) treats **Bitget Reality as primary market truth** with cash equity as a thin compare, (b) runs multi-skill evidence (news, market, fundamentals, macro, sentiment, technical), (c) stress-tests with **historically similar regimes**, and (d) runs a **self-evolution review** that flags bad patterns (e.g. ignoring rToken basis, weekend macro with no transmission chain) and emits a reusable checklist — while the trader **accepts/rejects** the thesis.

### 2 · Target user

**Segment:** Active retail / VIP crypto-native traders (Bitget users) who already trade or are evaluating **tokenized US equities (rTokens)**, capital ~$5k–$100k, several ideas/week, primary venues Bitget Reality + US cash awareness.  
**Not** “all traders.” Pain: session-bound stock tools miss weekend/overnight rToken moves and don’t force a post-idea review loop.

### 3 · Validation data

Call `GET /api/metrics` on the live Demo and paste numbers as **observed**. Example fields returned: `completedSessions`, `completionRatePct`, `humanDecisions`, `selfEvolutionReviews`, `skillRunsCompleted`.  
Targets (label as **targets** if not yet hit): 50 Demo research completions in month one; ≥70% completion rate; ≥30 human accept/reject decisions.

### 4 · Progress

Built: Reality-first quotes/candles, cash basis, dual MCP (bitget-mcp-server US + bitget-signal), 6 skills, similar-scenario retrieval, stress tests, auto self-evolution review, Qwen report/enrich with hard timeouts + rule fallbacks, desk prefs (risk/focus), Render single-URL Demo.  
Not yet / next: richer personalization from checklist → next run weights; optional Agent Hub read-only execution assist.

### 5 · Deliverables

- Accessible Demo: `<YOUR_RENDER_URL>`
- GitHub: `<YOUR_REPO>`
- This pack: `HACKATHON.md`
- Metrics: `<YOUR_RENDER_URL>/api/metrics`
- Optional: screen recording link

### 6 · Role of the LLM

Qwen (`qwen3.8-max` via `https://hackathon.bitgetops.com/v1`) is used for **structured catalyst/risk extraction** and **report narrative polish**. Thesis scoring, stress math, similar-scenario retrieval, and self-evolution pattern detection are **deterministic rules** so the Demo stays reliable if the proxy is slow. Human accept/reject is never automated.

### X post checklist

Must include `#BitgetHackathon` + `@Bitget_AI`, quote  
https://x.com/Bitget_AI/status/2100519318824055159?s=20  
and introduce TradePilot (Demo + rToken desk + self-evolution). Pure RT = invalid.

---

## What judges score (Track 3)

Feature depth (data sources / Skills) · research quality · LUI fluency · personalized thesis.

Lead with **Review & Self-Evolution** + **Bitget Reality 7×24** — that is your edge vs a generic stock chatbot.
