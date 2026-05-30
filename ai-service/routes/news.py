import os
import logging
from groq import Groq
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
MODEL = "llama-3.3-70b-versatile"


# ── Request/Response models ───────────────────────────────────────────────────

class NewsArticle(BaseModel):
    title: str
    description: str | None = None
    tickers: list[str] = []
    sentiment: str | None = None          # positive | negative | neutral
    sentiment_reasoning: str | None = None


class PortfolioPosition(BaseModel):
    ticker: str
    name: str | None = None
    current_value: float | None = None
    weight_pct: float | None = None


class NewsAnalysisRequest(BaseModel):
    user_id: str
    positions: list[PortfolioPosition]
    articles: list[NewsArticle]
    portfolio_value: float


class NewsAnalysisResponse(BaseModel):
    summary: str


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_news_prompt(positions: list[PortfolioPosition],
                       articles: list[NewsArticle],
                       portfolio_value: float) -> str:

    sorted_positions = sorted(
        positions,
        key=lambda p: p.current_value or 0,
        reverse=True
    )[:10]

    pos_rows = "\n".join(
        f"  {p.ticker:8s}  {(p.name or '')[:28]:28s}  "
        f"${p.current_value or 0:>10,.0f}  "
        f"({p.weight_pct or 0:.1f}% of portfolio)"
        for p in sorted_positions
    ) or "  (no positions)"

    news_rows = "\n".join(
        f"  [{', '.join(a.tickers[:3])}]  {a.title[:100]}"
        f"  [sentiment: {a.sentiment or 'neutral'}]"
        + (f"  — {a.sentiment_reasoning[:80]}" if a.sentiment_reasoning else "")
        for a in articles[:15]
    ) or "  (no relevant news today)"

    return f"""You are a portfolio news analyst embedded in FinSight, an AI portfolio intelligence platform.
A retail investor has asked: "What does today's news mean for MY portfolio specifically?"

THEIR PORTFOLIO  (total value: ${portfolio_value:,.0f})
{'─' * 64}
{pos_rows}

TODAY'S NEWS AFFECTING THEIR HOLDINGS
{'─' * 64}
{news_rows}

YOUR TASK
{'─' * 64}
Write 2-3 sentences explaining what today's news means SPECIFICALLY for this investor.

Rules:
- Reference the actual tickers they hold that appear in the news (e.g. "Your AAPL position...")
- Mention sentiment direction and approximate impact (positive/negative/neutral)
- If macro news (Fed, inflation, rates, bonds), explain how it affects their specific mix
- Be direct, specific, conversational — like a trusted advisor, not a compliance department
- If the news is mixed, acknowledge that honestly
- If nothing significant happened today, say so briefly
- 2-3 sentences MAX. No bullet points, no headers, no JSON.

Return ONLY the paragraph. Nothing else."""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/news", response_model=NewsAnalysisResponse)
async def analyze_news(request: NewsAnalysisRequest):
    if not client.api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured — set GROQ_API_KEY environment variable"
        )

    if not request.articles:
        return NewsAnalysisResponse(
            summary="No recent news found for your holdings today. Markets appear quiet — "
                    "a good reminder that no news is often good news for long-term investors."
        )

    if not request.positions:
        return NewsAnalysisResponse(
            summary="Connect a brokerage account via Plaid to start receiving "
                    "personalised news insights tailored to your specific holdings."
        )

    prompt = _build_news_prompt(request.positions, request.articles, request.portfolio_value)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.35,
        )

        summary = response.choices[0].message.content.strip()
        logger.debug("News summary generated for user=%s (%d chars)", request.user_id, len(summary))
        return NewsAnalysisResponse(summary=summary)

    except Exception as e:
        logger.error("Groq news analysis failed for user=%s: %s", request.user_id, e)
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")
