# Sentiment Bake-off: FinBERT vs Local LLM

**Date:** 2026-07-17 · **Task:** classify regulatory documents as
Restrictive / Neutral / Facilitative (stance toward regulated businesses)
· **Gold set:** 30 hand-labelled documents (10 per class), see
`gold_sentiment.json` · **Runner:** `python -m eval.finbert_bakeoff`

## Results

| Model | Accuracy | Notes |
|---|---|---|
| FinBERT (ProsusAI/finbert, mapped) | 24/30 (80%) | negative->Restrictive, positive->Facilitative |
| qwen2.5:7b (enrich.py prompt) | 30/30 (100%) | labels as stored by the enrichment pipeline |

## FinBERT's failure mode is systematic, not random

All six FinBERT errors are the same conceptual mistake — it measures
financial *tone*, not regulatory *stance*:

- **4x scam/fraud alerts -> Restrictive** (gold: Neutral). Scams are
  negative-tone content, but a public scam warning imposes nothing on
  regulated firms.
- **2x enabling announcements -> Neutral** (gold: Facilitative), e.g.
  "simplified legislative instrument" — facilitative deregulation reads as
  tonally flat to a sentiment model.

Notably FinBERT scored 10/10 on Restrictive documents — enforcement actions
and penalties are both negative-tone AND restrictive-stance, so the concepts
coincide there. They diverge exactly where regulatory stance is not the same
thing as sentiment.

## Caveats (read before quoting the numbers)

- n=30; the sample was stratified by the LLM's own labels, so classes the
  LLM might systematically miss are undersampled by construction.
- Gold labels were assigned by a single rater (AI assistant) from title +
  summary, not blind to the LLM's label. Treat qwen's 100% as "no
  disagreements found on an easy, stratified sample", not as a measured
  accuracy. An independently labelled sample (e.g. by Mark or Xhoni) would
  strengthen the claim.
- FinBERT ran on title + summary (its 512-token window can't take full
  documents); the LLM saw fuller text at enrichment time.

## Decision

Keep LLM-based stance classification (Decision #6 stands). FinBERT is the
wrong tool for this label set — not because it is a weak model, but because
financial sentiment and regulatory stance are different constructs that only
correlate on enforcement news. Revisit only if per-document LLM cost becomes
a bottleneck at scale, in which case fine-tuning a small classifier on
LLM-generated labels would be the path.
