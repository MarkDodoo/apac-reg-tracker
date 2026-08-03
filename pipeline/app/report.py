"""Stateless questionnaire-driven regulatory briefing.

Takes an explicit, one-off profile (jurisdictions, categories, institution
type, goals) and generates a written report on demand. Nothing is persisted
-- no database row, no history -- matching the "explicit input, used
immediately, nothing collected" pattern already used for the client-side
recommendation profile (see PROJECT_LOG Session 18). If a "my past reports"
feature is ever wanted, that's the point to get real privacy advice first,
per the compliance discussion.

Reuses recommend.recommend() to pick source documents and the same
LLM_PROVIDER switch as rag.py (Decision #7) to write the narrative --
Ollama locally (free), OpenAI when deployed (no GPU there).
"""

import os

from app.recommend import recommend

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")
ANSWER_MODEL = os.environ.get("ANSWER_MODEL", "qwen2.5:7b")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

REPORT_PROMPT = """You are a regulatory analyst writing a briefing for a
compliance professional. Use ONLY the numbered sources below — never invent
regulations, dates, or requirements not present in them.

READER PROFILE
Institution type: {institution_type}
Jurisdictions of interest: {jurisdictions}
Topics of interest: {categories}
What they're trying to figure out: {goals}

Write a markdown briefing with this structure:
1. A one-paragraph executive summary addressed to this reader specifically —
   what matters most to them right now, given their profile and goals.
2. "Key Developments" — group the sources by theme, 2-4 sentences each,
   citing sources inline as [1], [2] etc. Note sentiment (Restrictive/
   Neutral/Facilitative) and impact where it affects the reader.
3. "Watch List" — up to 3 items from the sources that need the most
   attention, with a one-line reason each.
End with: "This is regulatory information, not legal advice."
If the sources don't meaningfully cover the reader's stated interests, say
so plainly rather than stretching thin sources to fit.

SOURCES:
{context}
"""


def _context_blocks(docs: list[dict]) -> tuple[str, list[dict]]:
    blocks = []
    sources = []
    for n, d in enumerate(docs, 1):
        blocks.append(
            f"[{n}] {d['title']}\n"
            f"    {d['source']} ({d['jurisdiction']}), published "
            f"{d['published_date']}, {d['sentiment_label']}/"
            f"{d['impact_level']} impact\n"
            f"    {d['summary']}"
        )
        sources.append(
            {
                "n": n,
                "title": d["title"],
                "source": d["source"],
                "published_date": d["published_date"],
                "url": d["url"],
            }
        )
    return "\n\n".join(blocks), sources


def generate_report(
    jurisdictions: list[str],
    categories: list[str],
    institution_type: str,
    goals: str,
    k: int = 10,
) -> dict:
    docs = recommend(jurisdictions, categories, limit=k)
    if not docs:
        return {
            "report": "No documents matched your profile yet — try widening "
            "your jurisdictions or topics.",
            "model": None,
            "sources": [],
        }

    context, sources = _context_blocks(docs)
    prompt = REPORT_PROMPT.format(
        institution_type=institution_type or "Not specified",
        jurisdictions=", ".join(jurisdictions) or "Any",
        categories=", ".join(categories) or "Any",
        goals=goals or "Not specified",
        context=context,
    )
    messages = [{"role": "user", "content": prompt}]

    if LLM_PROVIDER == "openai":
        from openai import OpenAI  # lazy: not installed for local Ollama-only dev

        resp = OpenAI().chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=1200,
        )
        text = (resp.choices[0].message.content or "").strip()
        model = OPENAI_MODEL
    else:
        import ollama  # lazy: not installed in the deploy/automation image

        resp = ollama.chat(
            model=ANSWER_MODEL,
            messages=messages,
            options={"temperature": 0.2, "num_ctx": 12288},
        )
        text = (resp.message.content or "").strip()
        model = ANSWER_MODEL

    return {"report": text, "model": model, "sources": sources}
