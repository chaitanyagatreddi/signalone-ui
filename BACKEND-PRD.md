# SignalOne — Backend & Functionality PRD (v1)

## 1. Goal
Make the live UI (https://signalone-ui.vercel.app) answer with real reviews instead of dummy text.
User picks Source + Brand, asks a question, gets a real sentiment answer with links to real reviews.

## 2. What exists today (checked in `src/main.jsx`)
- Vite + React app, deployed on Vercel.
- Sources in dropdown: All sources, G2, Reddit, Trustpilot. (Capterra was removed.)
- `send()` waits 1.6s with `setTimeout`, then shows a hardcoded answer.
- `Answer` shows fixed numbers: 72% / 18% / 10%, complaints Fees / Support / Payouts, 4 fake reviews, "Open ↗" links to `#source`.
- Sidebar "Recent chats" are hardcoded.

## 3. What we build
One serverless endpoint on the same Vercel project: `POST /api/ask`.

**Request**
```json
{ "question": "What are Eventbrite customers most frustrated by?", "brand": "Eventbrite", "source": "All sources" }
```

**Response** (matches what the UI already draws)
```json
{
  "summary": "2-3 lines",
  "sentiment": { "positive": 40, "neutral": 20, "negative": 40 },
  "complaints": [ { "label": "Fees", "share": 31 } ],
  "reviews": [ { "source": "G2", "date": "2026-10-12", "sentiment": "negative", "tag": "Fees", "text": "snippet", "url": "https://..." } ]
}
```

## 4. How `/api/ask` works
1. **Fetch reviews** for the brand from the chosen source (or all three):
   - G2 → ZenRows
   - Trustpilot → ZenRows
   - Reddit → FetchLayer
2. **Clean up**: keep source, date, rating, text, URL. Drop duplicates. Cap at ~30 reviews per source.
3. **Score** with gpt-4o-mini: each review gets positive / neutral / negative and one complaint tag
   (fees, payouts, support, UX/checkout, refunds, reliability, other).
4. **Count**: % split and top 3 complaints are counted in code from the labels, not guessed by the model.
5. **Summarise** with gpt-4o-mini from the labelled reviews only, answering the user's question.
6. Return the JSON above.

## 5. Frontend changes
- Replace the `setTimeout` in `send()` with a call to `/api/ask`.
- `Answer` reads summary, numbers, complaints, reviews from the response.
- "Open ↗" links to the real review URL.
- Show an error line in the chat if the call fails.

## 6. Keys (set in Vercel → Project → Environment Variables, never in code)
- `OPENAI_API_KEY`
- `ZENROWS_API_KEY`
- `FETCHLAYER_TOKEN`

## 7. Out of scope for v1
Saved chat history, login, Google Sheet, daily schedule, leads, outreach drafts, trend charts, MCP server.

## 8. Milestones
| # | Milestone | Done when | Estimate |
|---|---|---|---|
| M0 | Source check | One real fetch works for G2, Trustpilot and Reddit (Eventbrite) | 15 min |
| M1 | `/api/ask` returns real reviews | Endpoint returns raw reviews for each source, locally | 45 min |
| M2 | Scoring + summary | gpt-4o-mini labels reviews; % and top complaints counted in code | 30 min |
| M3 | Wire the UI | Chat shows real answer; "Open ↗" opens the real review | 30 min |
| M4 | Deploy | Keys added in Vercel, push to git, live site answers a real question | 15 min |

Estimates are guesses until M0 passes. M0 decides whether the plan holds.

## 9. Known risks (not yet tested)
- ZenRows on G2 and Trustpilot pages: untested. G2 may need the expensive mode (25 credits/page; 5,000 credits on the free trial).
- FetchLayer Reddit search via API: key returned 200 on connect; an actual Reddit search call is untested.
- Vercel free plan function timeout may be too short for fetch + scoring of all three sources at once.
