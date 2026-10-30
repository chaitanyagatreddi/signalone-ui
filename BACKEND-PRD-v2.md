# SignalOne — Backend PRD v2 (CrewAI on Kuberns)

Replaces the hosting part of BACKEND-PRD.md (v1 kept as is).
Change from v1: Vercel function → Python Flask + CrewAI, hosted on Kuberns free trial.

## 1. Goal
The live UI answers with real reviews. User picks Source + Brand, asks a question, gets real sentiment with links to real reviews.

## 2. Stack
- Python 3.12, Flask, Gunicorn (Kuberns Flask guide)
- CrewAI, model gpt-4o-mini
- G2 + Trustpilot → ZenRows
- Reddit → FetchLayer
- Code in a new folder: `/Users/chaitanya/Documents/signalone-agent`
- Hosting: Kuberns free trial (7 days, Fri 30 Oct → assignment due Tue 3 Nov)

## 3. API (same as v1, UI already draws this)
`POST /ask`
```json
{ "question": "What are Eventbrite customers most frustrated by?", "brand": "Eventbrite", "source": "All sources" }
```
Returns
```json
{
  "summary": "2-3 lines",
  "sentiment": { "positive": 40, "neutral": 20, "negative": 40 },
  "complaints": [ { "label": "Fees", "share": 31 } ],
  "reviews": [ { "source": "G2", "date": "2026-10-12", "sentiment": "negative", "tag": "Fees", "text": "snippet", "url": "https://..." } ]
}
```
`GET /health` → `ok` (Kuberns health check)

## 4. The crew (CrewAI)
1. **Fetcher agent** — tools: ZenRows (G2, Trustpilot), FetchLayer (Reddit). Returns raw reviews: source, date, text, URL. Max ~30 per source.
2. **Scorer agent** — gpt-4o-mini labels each review positive / neutral / negative + one tag (fees, payouts, support, UX/checkout, refunds, reliability, other).
3. **Analyst agent** — writes the 2-3 line summary answering the question, from labelled reviews only.

Percentages and top 3 complaints are counted in Python from the labels, not by the model.

## 5. Keys (Kuberns → Environment Variables, never in Git)
- `OPENAI_API_KEY`
- `ZENROWS_API_KEY`
- `FETCHLAYER_TOKEN`

## 6. Milestones — one at a time, you check each before the next "go"

| # | Milestone | What I build | Done when (you check) |
|---|---|---|---|
| M0 | Source check | Nothing in the project. One test fetch each: G2, Trustpilot (ZenRows), Reddit (FetchLayer) for Eventbrite | I show you real reviews from all 3 sources |
| M1 | Fetcher | `signalone-agent` folder, Flask app, `/health`, `/ask` returning raw reviews (no AI yet) | Local `/ask` returns real reviews with real links |
| M2 | Crew | Scorer + Analyst agents, counts in Python | Local `/ask` returns the full JSON above for one real question |
| M3 | Wire UI | Replace the `setTimeout` in `send()` with a call to `/ask`; `Answer` reads the response; "Open ↗" uses real URL | Question typed in local UI shows real answer |
| M4 | Deploy | You push to GitHub, connect on Kuberns trial, add the 3 keys; UI points to the Kuberns URL | Live site answers a real question |

## 7. Out of scope
Saved chat history, login, Google Sheet, schedule, leads, outreach, charts, MCP server.

## 8. Progress log

### Decisions (Fri 30 Oct 2026)
- Agent framework: CrewAI (open source). Tested locally: one agent + crew peaked at 181 MB (fits 512 MB).
- Hosting: Kuberns free trial (7 days, $10 credits). App stays up 2 hours at a time, restart anytime. Paid fallback: Starter ₹665/month monthly (₹532/month only if a year is prepaid).
- Assignment due Tue 3 Nov, inside the trial.
- Kuberns docs checked: Python/Flask supported, env vars for keys, deploys from GitHub only.

### M0 — Source check: DONE (Fri 30 Oct)
| Source | Tool | How | Result |
|---|---|---|---|
| Reddit | FetchLayer | `scrape_search` {query, limit, format:"json"} | Real posts, e.g. "How to Avoid Eventbrite Fees? Any recs" (33 comments) |
| Trustpilot | FetchLayer | `trustpilot_company_reviews` {company:"eventbrite.com", language:"en"} | 20 reviews. Fields: rating, title, text, publishedAt, reviewUrl |
| G2 | ZenRows | scrape `g2.com/products/eventbrite/reviews`, js_render + premium_proxy + proxy_country us, markdown | 10 reviews per page, 914 total. First try timed out, second worked |

Notes:
- FetchLayer endpoint: `https://mcp.fetchlayer.dev` (MCP over HTTP, Bearer `FETCHLAYER_TOKEN`).
- FetchLayer has Trustpilot but no G2, so G2 stays on ZenRows.
- ZenRows credits used: 25 of 5,000.
- All 3 keys present in `~/.claude/secrets.zsh`: OPENAI_API_KEY, ZENROWS_API_KEY, FETCHLAYER_TOKEN.

### M1 — Fetcher: DONE (Fri 30 Oct)
- Folder: `/Users/chaitanya/Documents/signalone-agent` — `app.py`, `requirements.txt` (flask, gunicorn, requests), `.venv` (Python 3.12).
- Endpoints: `GET /health` → ok; `POST /ask` {brand, source} → {reviews, errors}.
- Test (Eventbrite, All sources): 36 reviews, no errors — Trustpilot 20, G2 10, Reddit 6.
- Fixes during build: FetchLayer replies must be read as UTF-8 and split on "\n" only; Trustpilot needs `format: "json"`.
- Brands mapped: Eventbrite, Ticket Tailor, Townscript, BookMyShow. Only Eventbrite tested.
- G2 links go to the reviews page (no per-review link on the page).
- CrewAI: no signup needed, open-source library, added in M2.

### M2 — Crew: DONE (Fri 30 Oct)
- CrewAI 1.15.33 installed in `.venv`, added to `requirements.txt`. No signup.
- Real gpt-4o-mini test first: one review labelled "negative", peak 201 MB.
- Crew: Scorer agent labels every review (sentiment + tag, structured output); percentages and top 3 complaints counted in Python; Analyst agent writes the summary from those counts.
- Changed during build: Analyst first ran in the same crew and its summary contradicted the counts (said "support" was top, counts said "UX/checkout"). Fixed by running Analyst after the counts and giving it the numbers.
- Test (Eventbrite, All sources, "What are Eventbrite customers most frustrated by?"): 36 reviews labelled, 53% positive / 11% neutral / 36% negative; top complaints fees 38%, UX/checkout 31%, support 23%; summary matches those numbers.
- One full answer takes about 75–90 seconds (fetching + 2 model calls).
- CrewAI telemetry turned off in code.

### M2.5 — Evidence gate (copied mechanism from arc--solver): DONE (Fri 30 Oct)
- Where the arc principles live: `check_summary()` and the retry loop in `summarise()` in `signalone-agent/app.py`.
  - arc EvidenceGate → `check_summary`: every sentence must cite review ids like [3]; every % must be a real counted number; every complaint named must be the tag of a cited review; cited ids must exist.
  - arc feedback loop → `summarise`: if the check fails, the errors go back to the Analyst and it retries (3 tries max). Response carries `verified` and `gate_errors`.
- Check: `test_gate.py` — true summary passes; made-up %, missing citation, non-existent review, wrong complaint all caught. Passed.
- Real run (Eventbrite, All sources): verified = true on first try, 70 s. Summary cites [13][21] [17][19] [2][37]; top complaints UX/checkout 31%, reliability 23%, support 15%.
Original plan:
Decision (Fri 30 Oct): copy the mechanism from github.com/chaitanyagatreddi/arc--solver, do not install the library.
- Analyst must cite review ids for every claim in the summary.
- Code checks each claim against real data: every % matches the counted number, every complaint matches a top-3 tag, every cited id exists and has that tag.
- False claim → error sent back to the Analyst, retry (max 2 retries). Claim with no citation → rejected.
- Done when: a deliberately wrong summary gets caught, and the real Eventbrite answer passes.

### M2.6 — Custom MCP server: BUILT + TESTED LOCALLY (Fri 30 Oct), not deployed
- Lean version (your call): 4 tools, not the 11 in Desktop/PRD-webmcp.md.
- Files: `signalone-agent/server.py` (Starlette app: `/mcp` = our FastMCP server, `/health` + `/ask` = Flask agent), `app.py` gained `run_agent()` (shared by /ask and MCP) and SQLite store `signalone.db`.
- Start command for Kuberns: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Test with official MCP Python client (in-process; sandbox blocks local ports):
  1. initialize → "SignalOne"
  2. tools/list → analyze_brand, search_reviews, top_complaints, get_review
  3. analyze_brand(Eventbrite) → 73 s, verified=true, 17 reviews, summary with citations
  4. search_reviews(negative) → rows from store with real Reddit URL
  5. top_complaints → fees 50%, reliability 50% (6 negative)
  6. get_review(5) → same review + URL
- Fixes during build: CrewAI refused to run inside the server's event loop → agent runs in a worker thread.
- Issue found: that run had 0 Trustpilot reviews (G2 10, Reddit 7). Direct Trustpilot call right after returned 20. Cause not captured. Added one retry per source. Retry not yet re-tested.
Original plan:
Brief: "At least one custom MCP server, written by you ... doing real work." Decision (Fri 30 Oct): Python MCP server written by us, today. WebMCP later.
- Library: official MCP Python SDK (FastMCP), HTTP transport at `/mcp`, same Kuberns app.
- Store: every `/ask` run saves labelled reviews to SQLite (`signalone.db`), so the tools read real data.
- Tools (from Ticmint brief §6, the ones our data supports):
  1. `analyze_brand(brand, source, question)` — runs the full agent (fetch → crew → evidence gate), saves to store, returns the answer.
  2. `search_reviews(brand?, source?, sentiment?, tag?, limit)` — reads the store.
  3. `top_complaints(brand, n)` — counts tags from the store.
  4. `get_review(id)` — one review with its source URL (for citations).
- Done when: an MCP client lists the 4 tools and `analyze_brand("Eventbrite")` returns a verified answer; `search_reviews` then returns the saved reviews.

### M2.7 — Google Sheet that updates itself (hard constraint 2): LIVE (Fri 30 Oct, 11:11 PM)
- Apps Script project "Signalone-ticmint" in your Google account, code = `signalone-agent/sheet.gs`, API = https://signalone-agent.onrender.com.
- setupTriggers ran 11:11:19–11:11:20 PM (no errors): startRefresh daily ~1 AM, writeSheet every 10 min.
- writeSheet ran 11:11:51 PM → log "wrote 37 rows" into the Reviews tab.
- Not yet checked by me: the Sheet itself (needs its link) and that the 10-minute trigger fires on its own.
Original plan:
Brief: "results must land in a Google Sheet that refreshes on a schedule without you touching it. A manual export doesn't count."
Lean plan (no Google Cloud project, no service-account key):
1. Agent: new endpoint `GET /sheet-rows` → every saved review as rows: brand, source, date, sentiment, tag, text, url, fetched_at.
2. Agent: the daily refresh runs `run_agent()` for all 4 brands, then the rows are fresh.
3. Google Sheet with Apps Script (lives inside the Sheet): `refresh()` calls `/refresh` then `/sheet-rows` and rewrites the "Reviews" tab, stamps `updated_at`.
4. Apps Script time trigger: runs `refresh()` daily. Google runs it; nobody touches it.
- You do: create the Sheet in your Google account, paste the script I give you (Extensions → Apps Script), click Run once to approve, add the daily trigger.
- Checked fact that affects this: Kuberns free trial pauses the app after 2 hours. A paused app can't answer the Sheet's daily call. Needs the app running (₹665/month Starter, or a restart before the trigger time) for the schedule to work unattended.

### M3 — Wire UI: DONE LOCALLY (Fri 30 Oct), not deployed
- `src/main.jsx`: `send()` now POSTs {question, brand, source} to `${VITE_API_URL}/ask` (dev: Vite proxy to localhost:8765). `Answer` shows the real summary, sentiment, top complaints and reviews; `[n]` in the summary links to review n's URL; "Open ↗" uses the real URL; error line if the call fails; warning if summary not verified.
- Local run: agent via preview config `signalone-agent` (venv python + uvicorn, port 8765), UI via `signalone-ui` (port 5210). server.py reads keys from ~/.claude/secrets.zsh locally only.
- Test in browser pane: "What are Eventbrite customers most frustrated by?" → 37 reviews (Trustpilot 20, G2 10, Reddit 7), 49% pos / 16% neu / 35% neg, top complaints UX/checkout 31%, reliability 23%, other 15%, 8 citation links (first [15] → trustpilot.com/reviews/6ae4632197f1a70460097120), no "not verified" warning. Screenshot sent.
- Trustpilot came back this run (retry added in M2.6 was in place).
- Known: pressing Enter right after clicking an example card doesn't send (editor not focused); the send button works.

### M4 — Deploy: AGENT LIVE ON RENDER (Fri 30 Oct, ~11 PM)
- Repo: github.com/chaitanyagatreddi/signalone-agent (private). Commits: cb628e7 agent+MCP, de0678e key-name aliases, bd4dbd3 Sheet endpoints + sheet.gs, a99f1ad pin Python 3.12 + tested versions.
- Kuberns tried first: live at signalone-agent-main-4697b21.kuberns.cloud and answered with keys, but trial = 2 deploys/day + pauses after 2 h. Moved to Render free.
- Render: https://signalone-agent.onrender.com — start `uvicorn server:app --host 0.0.0.0 --port $PORT`, keys imported from .env with exact names.
- Render first build used Python 3.14 → pip pulled crewai 0.11.2 and mcp 2.3.0. Fixed with `.python-version` = 3.12 and pinned requirements.
- Live test: /health 200; MCP tools/list → 4 tools; /ask Eventbrite → verified=true, no source errors, 37 reviews (Trustpilot 20, G2 10, Reddit 7), 57/16/27; /sheet-rows → 37 rows.
- `/` returns Not Found by design (no page there).
- Not done: UI not yet pointed at Render (VITE_API_URL); Google Sheet not created (sheet.gs needs the Render URL + your setup).
