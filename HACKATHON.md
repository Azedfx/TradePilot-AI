# Bitget AI Base Camp S2 — Judge & Submission Pack

**Track:** 🟧 AI Trading Desk (AI Research Workbench)  
**Named sub-theme:** Review & Self-Evolution  
**Positioning:** Natural-language research desk for US stocks / Bitget Reality rTokens. AI gathers evidence and flags bad decision patterns; **the human trader makes the final call**.

> Deadline: **27 Sep 2026 (UTC+8)**. Form: https://forms.gle/GyWZCMCPocgJdJon6  
> Handbook: https://bitget-ai.gitbook.io/bitgetai_hackathons2

---

## Live links (paste into form)

| Item | URL |
| --- | --- |
| **Demo** | https://tradepilot-ai-973j.onrender.com/ |
| **Metrics (observed)** | https://tradepilot-ai-973j.onrender.com/api/metrics |
| **GitHub** | https://github.com/Azedfx/TradePilot-AI |
| **This pack** | `HACKATHON.md` in the repo |
| **Form** | https://forms.gle/GyWZCMCPocgJdJon6 |

### Observed metrics snapshot (label as **observed**)

From `GET /api/metrics` (refresh before submit — numbers move):

- researchSessions · completedSessions · completionRatePct  
- humanDecisions · skillRunsCompleted · selfEvolutionReviews  

Example captured 2026-09-21: **22 sessions, 19 completed (86.4%), 1 human decision, 110 skill runs, 27 self-evolution reviews.**

---

## 60-second Demo script (for judges / video)

1. Open https://tradepilot-ai-973j.onrender.com/ (first load may cold-start ~30–60s on Render).
2. Set desk **Focus → rToken / 7×24**, **Risk → Conservative**.
3. Run: *“Analyze tokenized NVDA (rToken) weekend risk vs US market hours and cash equity basis.”*
4. Show left rail: **Bitget Reality · rNVDAUSDT** + cash basis line.
5. Expand skills: Market (Reality + vs cash), Fundamentals, Technical, Macro (7×24 note).
6. Open **Historical Scenarios** → similar shock-selloff/rally analogs with forward returns.
7. Open **Stress Testing** → Reality-vol scenarios + position size.
8. Open **Self-Evolution Review** (auto-runs on complete) → bad patterns + recurring + checklist.
9. Click **Accept** or **Reject** (human final decision — Track 3 requirement).

Record ≤3 min if needed. Pure login wall = bad for judges; this Demo should not require login.

---

## Google Form — copy-paste block

### Track → Sub-theme

- **Track:** AI Trading Desk (AI Research Workbench)  
- **Sub-theme:** Review & Self-Evolution  

---

### Project Description (one field — all six parts)

**1 · Thesis**  
US cash equities sleep on weekends; Bitget Reality rTokens keep pricing 7×24. Most “AI stock research” tools still treat Yahoo/session hours as truth and never force the trader to confront closed-market transmission risk or rToken-vs-cash basis. TradePilot is a research workbench built for that gap: (a) Bitget Reality as primary market truth with cash equity as a thin compare, (b) multi-skill evidence (news, market, fundamentals, macro, sentiment, technical) via Bitget handbook MCPs (`bitget-mcp-server` for US data + `bitget-signal` for crypto-side perception), (c) historically similar regime retrieval + stress tests, and (d) a self-evolution review that flags bad decision patterns (e.g. ignoring basis, weekend macro with no transmission chain) and emits a reusable checklist — while the human Accept/Reject remains the final decision.

**2 · Target user and product value**  
Segment: active retail / VIP crypto-native Bitget traders evaluating or trading **tokenized US equities (rTokens)**; capital roughly **$5k–$100k**; several ideas per week; primary venue Bitget Reality with awareness of US cash; risk appetite moderate–conservative on weekend/overnight legs. Not “all traders.” They need a desk that prices 7×24 Reality risk and forces a post-idea review loop — session-bound stock chatbots and pure chart bots do not.

**3 · Validation data and key metrics**  
**Observed** (live Demo `GET /api/metrics`, refresh at submit): research sessions, completed sessions, completion rate %, human accept/reject decisions, completed skill runs, self-evolution reviews. Snapshot 2026-09-21: 22 sessions, 19 completed (**86.4%** completion), 1 human decision, 110 skill runs, 27 self-evolution reviews. **Targets** (month one): 50 Demo research completions; ≥70% completion rate; ≥30 human accept/reject decisions. Distribution plan: public Render Demo (no login), X promo with #BitgetHackathon, Telegram community demos, GitHub README → Demo; prove usage via `/api/metrics` + Accept/Reject events, not AUM (tool track, not strategy AUM).

**4 · Progress**  
Built: Reality-first quotes/candles + cash basis; dual MCP clients; six skills; similar-scenario retrieval; stress tests; auto self-evolution review + checklist; human Accept/Reject; Qwen (`qwen3.8-max` via Bitget hackathon proxy) for catalyst/risk extraction and report polish with hard timeouts + deterministic fallbacks; desk prefs (risk/focus); single-URL Render Demo; `/api/metrics`. Problems/fixes: Qwen abort timeouts → rule fallbacks; US MCP (`agent.bitget.com`) sometimes unreachable from some networks → fail-fast circuit + signal/Reality/Yahoo fallback. Not yet / next: checklist → next-run personalization weights; optional Agent Hub read-only assist. Stack: NestJS + Next.js + Prisma/Postgres, Bitget Reality REST, bitget-signal + bitget-mcp-server HTTP MCP, Qwen.

**5 · Deliverables**  
- Demo: https://tradepilot-ai-973j.onrender.com/  
- Code: https://github.com/Azedfx/TradePilot-AI  
- Docs/pack: `HACKATHON.md` in the repo  
- Metrics: https://tradepilot-ai-973j.onrender.com/api/metrics  
- Optional: screen recording (≤3 min) of the Demo script above  

**6 · Take on AI Trading (optional)**  
For Trading Desk, the winning shape is AI as research + critique, not autopilot. Bitget’s split (`bitget-mcp-server` for US data, `bitget-signal` for perception Skills, Agent Hub for execution) matches that: Track 3 should deepen evidence and self-evolution under human final say; Agentic Trading can own order placement later. Reality 7×24 is the distinctive S2 surface — tools that still think in cash-session hours are already behind.

---

### Role of the LLM in Your Project (separate form field)

We use **Qwen (`qwen3.8-max`)** through the Bitget hackathon proxy (`https://hackathon.bitgetops.com/v1`, `QWEN_API_KEY`) for: (1) structured **catalyst / risk extraction** from research context, and (2) **report narrative polish**. We do **not** use the LLM for thesis scoring, stress math, similar-scenario retrieval, self-evolution pattern detection, or Accept/Reject — those are deterministic so the Demo stays reliable when the proxy is slow (hard timeouts + rule fallbacks). Qwen met our needs for narrative quality when available; fallbacks keep the desk usable without it. No other models are required for the core Demo path.

---

### Submission Materials Link (one field)

https://tradepilot-ai-973j.onrender.com/  
https://github.com/Azedfx/TradePilot-AI  
https://tradepilot-ai-973j.onrender.com/api/metrics  
Repo doc: HACKATHON.md (Demo script + form copy)

(If the form allows only one URL, put the Demo first and list the rest in Project Description part 5 — already done above.)

---

### X Promotional Post Link

Post yourself (must be interactive promo of TradePilot, not a pure RT). Required:

- Tag **@Bitget_AI**
- Hashtag **#BitgetHackathon**
- Quote/interact with: https://x.com/Bitget_AI/status/2100519318824055159?s=20  
- Mention Demo: https://tradepilot-ai-973j.onrender.com/  
- One line on rToken 7×24 + self-evolution review + human Accept/Reject  

**Draft tweet (edit voice as you like):**

> Built TradePilot for #BitgetHackathon — an AI Trading Desk for Bitget Reality rTokens.  
> Reality prices 7×24 while cash sleeps; we research the basis, stress similar regimes, then run a self-evolution review. Human Accept/Reject stays final.  
> Demo → https://tradepilot-ai-973j.onrender.com/  
> @Bitget_AI

Paste the tweet URL into the form after posting.

---

## What judges score (Track 3)

Feature depth (data sources / Skills) · research quality · LUI fluency · personalized thesis.

Lead with **Review & Self-Evolution** + **Bitget Reality 7×24** — that is your edge vs a generic stock chatbot.
