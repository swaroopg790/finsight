import os
import logging
from groq import Groq
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

MODEL = "llama-3.3-70b-versatile"


class ChatMessage(BaseModel):
    role: str    # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    user_id:              str
    message:              str
    conversation_history: list[ChatMessage] = []
    holdings:             list[dict] = []
    accounts:             list[dict] = []


class ChatResponse(BaseModel):
    reply: str


def _build_system_prompt(holdings: list[dict], accounts: list[dict]) -> str:
    total_value = sum(h.get("currentValue") or 0 for h in holdings)
    total_cost  = sum(h.get("costBasis")    or 0 for h in holdings)
    total_gl    = total_value - total_cost
    gl_pct      = (total_gl / total_cost * 100) if total_cost > 0 else 0

    holdings_rows = "\n".join(
        f"  {h.get('ticker','?'):8s}  qty={h.get('quantity',0):>8.2f}  "
        f"price=${h.get('currentPrice') or 0:>9.2f}  "
        f"value=${h.get('currentValue') or 0:>10.2f}  "
        f"cost=${h.get('costBasis') or 0:>10.2f}  "
        f"gl=${((h.get('currentValue') or 0) - (h.get('costBasis') or 0)):>+9.2f}  "
        f"{h.get('name','')[:30]}"
        for h in holdings
    ) or "  (no priced holdings)"

    accounts_rows = "\n".join(
        f"  {a.get('name','')}: ${a.get('balanceCurrent') or 0:,.2f} "
        f"({a.get('institutionName','')}, {a.get('type','')})"
        for a in accounts
    ) or "  (no accounts)"

    return f"""You are FinSight Copilot — a sharp, concise AI financial advisor embedded in FinSight, a personal portfolio intelligence platform.

CURRENT PORTFOLIO SNAPSHOT
───────────────────────────
Total market value : ${total_value:,.2f}
Total cost basis   : ${total_cost:,.2f}
Unrealised G/L     : ${total_gl:+,.2f}  ({gl_pct:+.1f}%)
Positions          : {len(holdings)}

HOLDINGS (ticker | qty | price | value | cost | gain/loss | name)
───────────────────────────────────────────────────────────────────
{holdings_rows}

ACCOUNTS
────────
{accounts_rows}

INSTRUCTIONS
────────────
- Answer the user's question about their portfolio using the data above.
- Be direct, specific, and quantitative — use actual figures from the snapshot.
- If the question is not about their portfolio or finance, politely redirect.
- Keep answers concise: 2-4 sentences for simple questions, short bullet lists for comparisons.
- Never make up prices or data not shown above.
- Do not suggest specific trades or give regulated financial advice. Use "consider" and "you may want to".
- If holdings data is empty or prices are missing, mention that syncing prices will improve your analysis."""


@router.post("/message", response_model=ChatResponse)
async def chat_message(request: ChatRequest):
    if not client.api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured — set GROQ_API_KEY environment variable"
        )

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    system_prompt = _build_system_prompt(request.holdings, request.accounts)

    # Build message list: system context + prior conversation + new user message
    messages = [{"role": "system", "content": system_prompt}]

    # Include up to the last 10 turns to stay within token limits
    history = request.conversation_history[-10:]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": request.message})

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=512,
            temperature=0.5,
        )

        reply = response.choices[0].message.content.strip()
        logger.debug("Chat reply for user=%s: %s", request.user_id, reply[:80])
        return ChatResponse(reply=reply)

    except Exception as e:
        logger.error("Groq chat error for user=%s: %s", request.user_id, e)
        raise HTTPException(status_code=502, detail=f"AI chat failed: {str(e)}")
