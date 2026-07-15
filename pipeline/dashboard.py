"""Streamlit dashboard over the enriched regulations corpus.

Run (from pipeline/):  streamlit run dashboard.py

Reads the same DB as the API. Sentiment uses a diverging encoding:
Facilitative = blue, Neutral = gray (deliberate "nothing" midpoint),
Restrictive = red — poles CVD-validated light and dark.
"""

import json

import altair as alt
import pandas as pd
import streamlit as st

from app.db import engine

# Diverging polarity colors (validated): blue pole / gray midpoint / red pole.
SENTIMENT_COLORS = {
    "Facilitative": "#2a78d6",
    "Neutral": "#898781",
    "Restrictive": "#e34948",
}
SENTIMENT_ORDER = ["Restrictive", "Neutral", "Facilitative"]
BAR_BLUE = "#2a78d6"

st.set_page_config(
    page_title="APAC Regulation Tracker", page_icon="📡", layout="wide"
)


@st.cache_data(ttl=60)
def load_data() -> pd.DataFrame:
    df = pd.read_sql("SELECT * FROM regulations", engine)
    df["published_date"] = pd.to_datetime(df["published_date"])
    for col in ("categories", "affected_entities"):
        df[col] = df[col].apply(lambda v: json.loads(v) if isinstance(v, str) else [])
    return df


df = load_data()

st.title("APAC Regulation Tracker")
st.caption(
    "Regulatory developments across Asia-Pacific financial regulators, "
    "tagged and summarised by local LLMs."
)

# ── Filters (one row above the charts) ──────────────────────────────────
fcols = st.columns([1, 1, 1, 1, 2])
sources = fcols[0].multiselect("Source", sorted(df["source"].unique()))
sentiments = fcols[1].multiselect("Sentiment", SENTIMENT_ORDER)
impacts = fcols[2].multiselect("Impact", ["High", "Medium", "Low"])
all_cats = sorted({c for cats in df["categories"] for c in cats})
categories = fcols[3].multiselect("Category", all_cats)
query = fcols[4].text_input("Search title / summary")

view = df
if sources:
    view = view[view["source"].isin(sources)]
if sentiments:
    view = view[view["sentiment_label"].isin(sentiments)]
if impacts:
    view = view[view["impact_level"].isin(impacts)]
if categories:
    view = view[view["categories"].apply(lambda cs: any(c in cs for c in categories))]
if query:
    hay = view["title"].fillna("") + " " + view["summary"].fillna("")
    view = view[hay.str.contains(query, case=False, regex=False)]

# ── Stat tiles ──────────────────────────────────────────────────────────
m = st.columns(4)
m[0].metric("Documents", len(view))
m[1].metric("Jurisdictions", view["jurisdiction"].nunique())
m[2].metric("High impact", int((view["impact_level"] == "High").sum()))
newest = view["published_date"].max()
m[3].metric("Most recent", newest.strftime("%d %b %Y") if pd.notna(newest) else "—")

st.divider()

# ── Charts ──────────────────────────────────────────────────────────────
c1, c2, c3 = st.columns(3)

monthly = (
    view.dropna(subset=["published_date"])
    .assign(month=lambda d: d["published_date"].dt.to_period("M").dt.to_timestamp())
    .groupby("month")
    .size()
    .reset_index(name="documents")
)
c1.subheader("Documents over time")
c1.altair_chart(
    alt.Chart(monthly)
    .mark_bar(color=BAR_BLUE, cornerRadiusTopLeft=4, cornerRadiusTopRight=4, width=18)
    .encode(
        x=alt.X("month:T", title=None, axis=alt.Axis(format="%b %y")),
        y=alt.Y("documents:Q", title=None),
        tooltip=[
            alt.Tooltip("month:T", title="Month", format="%B %Y"),
            alt.Tooltip("documents:Q", title="Documents"),
        ],
    ),
    use_container_width=True,
)

sent = (
    view["sentiment_label"]
    .value_counts()
    .reindex(SENTIMENT_ORDER)
    .fillna(0)
    .reset_index()
)
sent.columns = ["sentiment", "documents"]
c2.subheader("Sentiment")
c2.altair_chart(
    alt.Chart(sent)
    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4, width=40)
    .encode(
        x=alt.X("sentiment:N", sort=SENTIMENT_ORDER, title=None),
        y=alt.Y("documents:Q", title=None),
        color=alt.Color(
            "sentiment:N",
            scale=alt.Scale(
                domain=SENTIMENT_ORDER,
                range=[SENTIMENT_COLORS[s] for s in SENTIMENT_ORDER],
            ),
            legend=None,  # bars are axis-labelled; color is reinforcement
        ),
        tooltip=[
            alt.Tooltip("sentiment:N", title="Sentiment"),
            alt.Tooltip("documents:Q", title="Documents"),
        ],
    ),
    use_container_width=True,
)

cats = (
    view.explode("categories")
    .dropna(subset=["categories"])
    .groupby("categories")
    .size()
    .reset_index(name="documents")
    .sort_values("documents", ascending=False)
    .head(8)
)
c3.subheader("Top categories")
c3.altair_chart(
    alt.Chart(cats)
    .mark_bar(color=BAR_BLUE, cornerRadiusTopRight=4, cornerRadiusBottomRight=4, height=16)
    .encode(
        x=alt.X("documents:Q", title=None),
        y=alt.Y("categories:N", sort="-x", title=None),
        tooltip=[
            alt.Tooltip("categories:N", title="Category"),
            alt.Tooltip("documents:Q", title="Documents"),
        ],
    ),
    use_container_width=True,
)

st.divider()

# ── Document table ──────────────────────────────────────────────────────
st.subheader(f"Documents ({len(view)})")
table = (
    view.sort_values("published_date", ascending=False)[
        [
            "published_date", "source", "title", "sentiment_label",
            "impact_level", "summary", "source_url",
        ]
    ]
    .rename(
        columns={
            "published_date": "Date",
            "source": "Source",
            "title": "Title",
            "sentiment_label": "Sentiment",
            "impact_level": "Impact",
            "summary": "Summary",
            "source_url": "Link",
        }
    )
)
st.dataframe(
    table,
    use_container_width=True,
    hide_index=True,
    column_config={
        "Date": st.column_config.DateColumn(format="DD MMM YYYY", width="small"),
        "Source": st.column_config.TextColumn(width="small"),
        "Title": st.column_config.TextColumn(width="large"),
        "Sentiment": st.column_config.TextColumn(width="small"),
        "Impact": st.column_config.TextColumn(width="small"),
        "Summary": st.column_config.TextColumn(width="large"),
        "Link": st.column_config.LinkColumn(display_text="Open ↗", width="small"),
    },
)
