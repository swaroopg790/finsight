import os
import json
import logging
from groq import Groq
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

MODEL = "llama-3.3-70b-versatile"


class PortfolioAnalysisRequest(BaseModel):
    user_id: str
    holdings: list[dict]
    accounts: list[dict]


class PortfolioAnalysisResponse(BaseModel):
    summary: str
    risk_flags: list[str]
    suggestions: list[str]


def _build_prompt(holdings: list[dict], accounts: list[dict]) -> str:
    total_value = sum(h.get("currentValue") or 0 for h in holdings)
    total_cost   = sum(h.get("costBasis")    or 0 for h in holdings)
    total_gl     = total_value - total_cost
    gl_pct       = (total_gl / total_cost * 100) if total_cost > 0 else 0

    holdings_rows = "\n".join(
        f"  {h.get('ticker','?'):8s}  {h.get('name','')[:28]:28s}  "
        f"qty={h.get('quantity',0):>8.2f}  "
        f"price=${h.get('currentPrice') or 0:>9.2f}  "
        f"value=${h.get('currentValue') or 0:>10.2f}  "
        f"gl=${( (h.get('currentValue') or 0) - (h.get('costBasis') or 0) ):>+9.2f}  "
        f"account={h.get('accountName','')}"
        for h in holdings
    )

    accounts_rows = "\n".join(
        f"  {a.get('name','')}: ${a.get('balanceCurrent') or 0:,.2f} "
        f"({a.get('institutionName','')}, {a.get('type','')})"
        for a in accounts
    )

    return f"""You are a senior financial advisor AI embedded in FinSight, an AI portfolio intelligence platform for retail investors.

PORTFOLIO SUMMARY
─────────────────
Total market value : ${total_value:,.2f}
Total cost basis   : ${total_cost:,.2f}
Unrealised G/L     : ${total_gl:+,.2f}  ({gl_pct:+.1f}%)
Positions          : {len(holdings)}

HOLDINGS (ticker | name | qty | price | value | gain/loss | account)
──────────────────────────────────────────────────────────────────────
{holdings_rows if holdings_rows else "  (no holdings)"}

ACCOUNTS
────────
{accounts_rows if accounts_rows else "  (no accounts)"}

TASK
────
Analyse this retail investor's portfolio and return a JSON object with exactly these three keys:

{{
  "summary":     "<2-3 sentence executive summary: portfolio health, composition, and standout metrics>",
  "risk_flags":  ["<specific risk with numbers>", "<specific risk with numbers>"],
  "suggestions": ["<concrete actionable suggestion>", "<concrete actionable suggestion>"]
}}

Rules:
- Be specific: use actual ticker names and dollar/percentage figures from the data above.
- risk_flags: 2-3 items max. Focus on concentration (>25% single position), sector overweight, high unrealised loss, low diversification.
- suggestions: 2-3 items max. Be actionable (e.g. "Consider trimming NVDA from 34% to under 20% and adding international exposure via VXUS").
- Keep each string under 140 characters.
- Return ONLY the JSON object, no markdown, no explanation.
"""


@router.post("/portfolio", response_model=PortfolioAnalysisResponse)
async def analyze_portfolio(request: PortfolioAnalysisRequest):
    if not client.api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured — set GROQ_API_KEY environment variable"
        )

    if not request.holdings:
        return PortfolioAnalysisResponse(
            summary="No holdings found in this portfolio. Connect a brokerage account and sync your positions to receive AI-powered insights.",
            risk_flags=["Portfolio is empty — no risk data available"],
            suggestions=["Connect a brokerage account via Plaid to get started"]
        )

    prompt = _build_prompt(request.holdings, request.accounts)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},   # Guarantees valid JSON
            max_tokens=1024,
            temperature=0.3,   # Low temperature for consistent, factual analysis
        )

        raw = response.choices[0].message.content
        logger.debug("Groq raw response: %s", raw)
        parsed = json.loads(raw)

        return PortfolioAnalysisResponse(
            summary=parsed.get("summary", "Analysis unavailable"),
            risk_flags=parsed.get("risk_flags", []),
            suggestions=parsed.get("suggestions", []),
        )

    except json.JSONDecodeError as e:
        logger.error("Failed to parse Groq JSON response: %s", e)
        raise HTTPException(status_code=502, detail="AI model returned malformed response")
    except Exception as e:
        logger.error("Groq API error: %s", e)
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")
