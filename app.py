"""
app.py — SignalSense: AI-Powered Technical Analysis Dashboard
Run: streamlit run app.py
"""

import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
import os
import hashlib
import hmac
from dotenv import load_dotenv
load_dotenv()

from data_fetcher import (
    fetch_stock_data,
    fetch_ticker_info,
    get_current_price,
    fetch_news,
    POPULAR_TICKERS,
)
from indicators import compute_indicators, build_indicator_summary, INDICATOR_OPTIONS, DEFAULT_INDICATORS
from charts import build_candlestick_chart, build_rsi_chart, build_macd_chart, build_stoch_chart
from ai_analysis import run_ai_analysis
from watchlist import load_watchlist, add_ticker, remove_ticker, get_watchlist_row_data

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SignalSense — AI Stock Analysis",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Auth helpers ──────────────────────────────────────────────────────────────
def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _check_credentials(username: str, password: str) -> bool:
    env_user = os.environ.get("SS_USERNAME", "admin")
    env_hash = os.environ.get("SS_PASSWORD_HASH", "")
    if env_hash:
        return hmac.compare_digest(username, env_user) and hmac.compare_digest(_hash_pw(password), env_hash)
    env_pass = os.environ.get("SS_PASSWORD", "changeme")
    return hmac.compare_digest(username, env_user) and hmac.compare_digest(password, env_pass)

def _is_authenticated() -> bool:
    return st.session_state.get("authenticated", False)

# ── Theme helpers ─────────────────────────────────────────────────────────────
def _is_light() -> bool:
    return st.session_state.get("light_mode", False)  # default: dark

def _theme_colors(light: bool) -> dict:
    if light:
        return dict(
            bg="#f0f4f8", bg2="#ffffff", bg3="#f8fafc",
            text_pri="#0f172a", text_sec="#334155", text_mute="#64748b",
            border="rgba(0,0,0,0.08)", btn_bg="rgba(0,0,0,0.04)",
            btn_border="rgba(0,0,0,0.12)", btn_color="#475569",
            neon_bull="#00A86B", neon_bear="#CC0033", neon_acc="#0070BB",
            divider="rgba(0,0,0,0.07)",
        )
    return dict(
        bg="#080B10", bg2="#111622", bg3="#0D1420",
        text_pri="#E8EEF4", text_sec="#B0BDD6", text_mute="#5A6B8C",
        border="rgba(255,255,255,0.08)", btn_bg="rgba(255,255,255,0.04)",
        btn_border="rgba(255,255,255,0.08)", btn_color="#7A8FA8",
        neon_bull="#00FF9D", neon_bear="#FF0055", neon_acc="#00C8FF",
        divider="rgba(255,255,255,0.06)",
    )

# ── CSS injector ──────────────────────────────────────────────────────────────
def inject_css(light: bool) -> None:
    tc = _theme_colors(light)
    bg         = tc["bg"]
    bg2        = tc["bg2"]
    bg3        = tc["bg3"]
    border     = tc["border"]
    text_pri   = tc["text_pri"]
    text_sec   = tc["text_sec"]
    text_mute  = tc["text_mute"]
    btn_bg     = tc["btn_bg"]
    btn_border = tc["btn_border"]
    btn_color  = tc["btn_color"]
    neon_bull  = tc["neon_bull"]
    neon_bear  = tc["neon_bear"]
    neon_acc   = tc["neon_acc"]
    divider_color = tc["divider"]

    if light:
        input_bg     = "#ffffff"
        input_border = "rgba(0,0,0,0.15)"
        scroll_thumb = "#94a3b8"
        section_color= "#94a3b8"
        btn_hover_bg = f"rgba(0,112,187,0.10)"
        gloss_ab     = "rgba(0,0,0,0.08)"
        login_bg     = "#ffffff"
        login_border = "rgba(0,0,0,0.10)"
        tab_active_bg= "#ffffff"
        rsi_marker   = "#1e293b"
        wl_btn_bg    = "#edf0f5"   # solid — no bleed-through on light theme
        wl_btn_color = "#475569"
    else:
        input_bg     = "#111622"
        input_border = "rgba(255,255,255,0.12)"
        scroll_thumb = "#1E3A5F"
        section_color= "#3A4E6A"
        btn_hover_bg = "rgba(0,200,255,0.10)"
        gloss_ab     = "rgba(255,255,255,0.06)"
        login_bg     = "#111622"
        login_border = "rgba(255,255,255,0.10)"
        tab_active_bg= "#111622"
        rsi_marker   = "#ffffff"
        wl_btn_bg    = "#1e2d40"   # solid — no bleed-through on dark theme
        wl_btn_color = "#7A8FA8"

    cs = "light" if light else "dark"

    st.markdown(f'<meta name="color-scheme" content="{cs}">', unsafe_allow_html=True)
    st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

html, body, [data-testid="stAppViewContainer"] {{
    background: {bg} !important;
    color: {text_sec} !important;
    font-family: 'Space Grotesk', system-ui, sans-serif !important;
}}
#MainMenu, footer, header {{ visibility: hidden; }}
.block-container {{
    padding: 0.8rem 1rem 5rem !important;
    max-width: 1440px !important;
}}
::-webkit-scrollbar {{ width: 4px; }}
::-webkit-scrollbar-thumb {{ background: {scroll_thumb}; border-radius: 4px; }}

/* ── Mobile column stacking ── */
@media (max-width: 768px) {{
    [data-testid="stHorizontalBlock"] {{
        flex-direction: column !important;
    }}
    [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {{
        width: 100% !important;
        min-width: 100% !important;
        flex: none !important;
    }}
    .block-container {{ padding: 0.5rem 0.5rem 5.5rem !important; }}
    .ss-price {{ font-size: 1.7rem !important; }}
    .ss-title {{ font-size: 1.05rem !important; }}
}}

/* ── Login screen ── */
.ss-login-wrap {{
    max-width: 400px; margin: 6vh auto 0;
    background: {login_bg}; border: 1px solid {login_border};
    border-radius: 18px; padding: 2.5rem 2rem 2rem;
    box-shadow: 0 8px 40px rgba(0,0,0,0.22);
}}
.ss-login-logo {{ font-size: 2.4rem; text-align: center; margin-bottom: 0.4rem; }}
.ss-login-title {{
    font-size: 1.45rem; font-weight: 700; color: {neon_acc};
    font-family: 'JetBrains Mono', monospace;
    text-align: center; margin-bottom: 0.15rem;
}}
.ss-login-sub {{ font-size: 0.78rem; color: {text_mute}; text-align: center; margin-bottom: 1.8rem; }}
.ss-login-label {{
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; color: {text_mute}; margin-bottom: 4px;
}}

/* ── App header ── */
.ss-header {{
    display: flex; align-items: center; gap: 12px;
    padding: 0 0 0.75rem; border-bottom: 1px solid {border};
    margin-bottom: 0.75rem;
}}
.ss-header-right {{ margin-left: auto; display: flex; align-items: center; gap: 8px; }}
.ss-title {{
    font-size: 1.3rem; font-weight: 700; letter-spacing: -0.5px;
    color: {neon_acc}; font-family: 'JetBrains Mono', monospace;
}}
.ss-subtitle {{ font-size: 0.70rem; color: {text_mute}; margin-top: 1px; }}
.ss-user-badge {{
    font-size: 0.70rem; font-weight: 600; color: {text_mute};
    background: {btn_bg}; border: 1px solid {btn_border};
    border-radius: 20px; padding: 3px 11px;
}}
.ss-theme-btn-wrap {{ position: relative; height: 0; overflow: visible; }}
.ss-theme-btn-wrap > div[data-testid="stButton"] {{ position: absolute; top: -48px; right: 0; }}
.ss-theme-btn-wrap > div[data-testid="stButton"] button {{
    padding: 3px 10px !important; min-height: 30px !important;
    font-size: 0.95rem !important; line-height: 1 !important; border-radius: 8px !important;
}}

/* ── Cards ── */
.ss-card {{
    background: {bg2}; border: 1px solid {border};
    border-radius: 14px; padding: 0.9rem 1rem; margin-bottom: 0.7rem;
}}
.ss-card-title {{
    font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: {text_mute}; margin-bottom: 0.5rem;
}}

/* ── Price display ── */
.ss-price {{
    font-size: 2rem; font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: {text_pri}; line-height: 1.1;
}}
.ss-change-pos {{
    font-size: 0.96rem; font-weight: 600;
    color: {neon_bull}; font-family: 'JetBrains Mono', monospace;
    text-shadow: 0 0 10px {neon_bull}55;
}}
.ss-change-neg {{
    font-size: 0.96rem; font-weight: 600;
    color: {neon_bear}; font-family: 'JetBrains Mono', monospace;
    text-shadow: 0 0 10px {neon_bear}55;
}}

/* ── Stat pills ── */
.ss-stats {{ display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }}
.ss-stat {{
    background: {btn_bg}; border: 1px solid {btn_border};
    border-radius: 7px; padding: 4px 9px;
    font-size: 0.72rem; color: {text_mute};
}}
.ss-stat b {{ color: {text_sec}; font-weight: 600; }}

/* ── Signal badges ── */
.ss-signal-buy {{
    display: inline-block;
    background: rgba(0,255,157,0.08); border: 1.5px solid {neon_bull};
    color: {neon_bull}; font-size: 1.35rem; font-weight: 700;
    letter-spacing: 0.08em; padding: 9px 26px; border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 0 18px {neon_bull}33;
}}
.ss-signal-sell {{
    display: inline-block;
    background: rgba(255,0,85,0.08); border: 1.5px solid {neon_bear};
    color: {neon_bear}; font-size: 1.35rem; font-weight: 700;
    letter-spacing: 0.08em; padding: 9px 26px; border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 0 18px {neon_bear}33;
}}
.ss-signal-hold {{
    display: inline-block;
    background: rgba(0,200,255,0.07); border: 1.5px solid {neon_acc};
    color: {neon_acc}; font-size: 1.35rem; font-weight: 700;
    letter-spacing: 0.08em; padding: 9px 26px; border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 0 14px {neon_acc}22;
}}
.ss-bias-bullish {{ color: {neon_bull}; font-weight: 600; }}
.ss-bias-bearish {{ color: {neon_bear}; font-weight: 600; }}
.ss-bias-neutral  {{ color: {neon_acc}; font-weight: 600; }}

/* ── Confidence bar ── */
.ss-conf-bar-wrap {{
    background: {btn_bg}; border-radius: 6px;
    height: 8px; width: 100%; overflow: hidden; margin-top: 6px;
}}
.ss-conf-bar {{ height: 8px; border-radius: 6px; }}

/* ── RSI gauge ── */
.ss-rsi-wrap {{
    position: relative; height: 13px;
    background: linear-gradient(to right, {neon_bull}, #fbbf24, {neon_bear});
    border-radius: 7px; overflow: hidden;
}}
.ss-rsi-marker {{
    position: absolute; top: 0; height: 100%; width: 3px;
    background: {rsi_marker}; border-radius: 2px;
    box-shadow: 0 0 6px rgba(0,0,0,0.5);
}}
.ss-rsi-labels {{
    display: flex; justify-content: space-between;
    font-size: 0.63rem; color: {text_mute}; margin-top: 3px;
}}

/* ── Factor chips ── */
.ss-factors {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }}
.ss-factor {{
    background: {neon_acc}11; border: 1px solid {neon_acc}33;
    border-radius: 20px; padding: 4px 11px;
    font-size: 0.74rem; color: {neon_acc};
}}

/* ── Signal interpretation pills ── */
.ss-interp {{
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.71rem; font-weight: 600; padding: 3px 10px;
    border-radius: 20px; margin-top: 6px;
}}
.ss-interp-bull {{
    background: {neon_bull}18; border: 1px solid {neon_bull}40; color: {neon_bull};
}}
.ss-interp-bear {{
    background: {neon_bear}18; border: 1px solid {neon_bear}40; color: {neon_bear};
}}
.ss-interp-neut {{
    background: {neon_acc}12; border: 1px solid {neon_acc}35; color: {neon_acc};
}}
.ss-interp-warn {{
    background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.3); color: #fbbf24;
}}

/* ── Glossary ── */
.ss-gloss-card {{
    background: {bg3}; border: 1px solid {border};
    border-radius: 11px; padding: 0.8rem 0.9rem; margin-bottom: 0.55rem;
}}
.ss-gloss-title {{ font-size: 0.78rem; font-weight: 700; color: {text_pri}; margin-bottom: 3px; }}
.ss-gloss-what {{ font-size: 0.74rem; color: {text_mute}; line-height: 1.5; margin-bottom: 5px; }}
.ss-gloss-row {{ display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }}
.ss-gloss-zone {{ font-size: 0.68rem; padding: 2px 9px; border-radius: 5px; font-weight: 600; }}
.ss-gloss-zone-bull {{ background: {neon_bull}18; color: {neon_bull}; }}
.ss-gloss-zone-bear {{ background: {neon_bear}18; color: {neon_bear}; }}
.ss-gloss-zone-neut {{ background: {neon_acc}12; color: {neon_acc}; }}
.ss-gloss-action {{
    font-size: 0.72rem; color: {text_sec}; line-height: 1.55;
    margin-top: 7px; padding-top: 7px; border-top: 1px solid {gloss_ab};
}}

/* ── Buttons ── */
.stButton > button,
button[data-testid="baseButton-secondary"] {{
    background: {btn_bg} !important;
    border: 1px solid {btn_border} !important;
    color: {btn_color} !important;
    border-radius: 8px !important;
    font-size: 0.76rem !important;
    padding: 4px 12px !important;
    min-height: 36px !important;
    font-family: 'JetBrains Mono', monospace !important;
    transition: all 0.15s !important;
}}
.stButton > button:hover,
button[data-testid="baseButton-secondary"]:hover {{
    background: {btn_hover_bg} !important;
    border-color: {neon_acc}66 !important;
    color: {neon_acc} !important;
}}
button[data-testid="baseButton-primary"] {{
    background: linear-gradient(135deg, {neon_acc}1A, {neon_acc}33) !important;
    border: 1px solid {neon_acc}77 !important;
    color: {neon_acc} !important;
    font-size: 0.96rem !important; font-weight: 600 !important;
    padding: 0.65rem 1.6rem !important; min-height: 50px !important;
    border-radius: 12px !important; letter-spacing: 0.02em !important;
    box-shadow: 0 0 20px {neon_acc}1A !important;
    font-family: 'JetBrains Mono', monospace !important;
}}
button[data-testid="baseButton-primary"]:hover {{
    background: linear-gradient(135deg, {neon_acc}2A, {neon_acc}44) !important;
    box-shadow: 0 0 28px {neon_acc}2A !important;
}}

/* ── Inputs ── */
.stTextInput input {{
    background: {input_bg} !important;
    border: 1px solid {input_border} !important;
    color: {text_pri} !important;
    border-radius: 10px !important;
    font-size: 1rem !important; font-weight: 600 !important;
    font-family: 'JetBrains Mono', monospace !important;
    min-height: 44px !important; padding: 7px 13px !important;
}}
.stTextInput input:focus {{
    border-color: {neon_acc} !important;
    box-shadow: 0 0 0 2px {neon_acc}30 !important;
}}
.stDateInput input {{
    background: {input_bg} !important; color: {text_pri} !important;
    border-color: {input_border} !important;
    min-height: 42px !important; border-radius: 10px !important;
}}

/* ── Selectbox / Multiselect ── */
.stSelectbox div[data-baseweb="select"] > div,
.stMultiSelect div[data-baseweb="select"] > div {{
    background: {input_bg} !important;
    border: 1px solid {input_border} !important;
    border-radius: 10px !important;
}}
.stSelectbox div[data-baseweb="select"] span,
.stSelectbox div[data-baseweb="select"] div,
.stMultiSelect div[data-baseweb="select"] span,
.stMultiSelect div[data-baseweb="select"] div {{
    color: {text_pri} !important; background: transparent !important;
}}
.stMultiSelect span[data-baseweb="tag"] {{
    background: {btn_bg} !important;
    border: 1px solid {input_border} !important;
    color: {text_pri} !important;
}}
ul[data-baseweb="menu"],
div[data-baseweb="popover"] ul,
div[role="listbox"] {{ background: {input_bg} !important; border: 1px solid {input_border} !important; }}
ul[data-baseweb="menu"] li,
div[data-baseweb="popover"] li,
div[role="listbox"] li,
div[role="option"] {{ background: {input_bg} !important; color: {text_pri} !important; }}
ul[data-baseweb="menu"] li:hover,
div[data-baseweb="popover"] li:hover,
div[role="listbox"] li:hover,
div[role="option"]:hover {{ background: {btn_hover_bg} !important; color: {text_pri} !important; }}
li[aria-selected="true"],
div[role="option"][aria-selected="true"] {{
    background: {neon_acc}20 !important; color: {text_pri} !important;
}}
.stSelectbox svg, .stMultiSelect svg {{ fill: {text_mute} !important; }}
div[data-baseweb="popover"] > div, div[data-baseweb="popover"] > div > div {{
    background: {input_bg} !important; border: 1px solid {input_border} !important;
}}
div[data-baseweb="popover"] li span, div[data-baseweb="popover"] li div,
[role="option"] span {{ color: {text_pri} !important; }}
[data-baseweb="tag"] span {{ color: {text_pri} !important; }}
[data-baseweb="select"] [data-testid="stMarkdownContainer"] p,
[data-baseweb="select"] input {{ color: {text_pri} !important; background: transparent !important; }}
[data-baseweb="select"] > div:first-child {{
    background: {input_bg} !important; border-color: {input_border} !important;
}}

/* ── Expander ── */
[data-testid="stExpander"] {{
    background: {bg2} !important; border: 1px solid {border} !important;
    border-radius: 12px !important; overflow: hidden !important;
}}
[data-testid="stExpander"] summary,
[data-testid="stExpander"] summary p,
[data-testid="stExpander"] summary span {{
    background: {bg2} !important; color: {text_sec} !important;
}}
[data-testid="stExpander"] > div > div {{ background: {bg2} !important; color: {text_sec} !important; }}
[data-testid="stExpander"] p, [data-testid="stExpander"] label,
[data-testid="stExpander"] span:not([data-baseweb="tag"]) {{ color: {text_sec} !important; }}
div[data-testid="stExpanderDetails"] {{ background: {bg2} !important; }}

/* ── Sidebar ── */
[data-testid="stSidebar"] {{ background: {bg2} !important; }}
[data-testid="stSidebar"] p, [data-testid="stSidebar"] span,
[data-testid="stSidebar"] label {{ color: {text_sec} !important; }}

/* ── Markdown text ── */
.stMarkdown p, .stMarkdown span, .stMarkdown div {{ color: {text_sec} !important; }}

/* ── Section label ── */
.ss-section {{
    font-size: 0.64rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: {section_color};
    margin: 0.9rem 0 0.35rem;
}}

/* ── Disclaimer ── */
.ss-disclaimer {{
    background: {neon_bear}08; border: 1px solid {neon_bear}25;
    border-radius: 10px; padding: 0.75rem 0.9rem;
    font-size: 0.68rem; color: {text_mute};
    margin-top: 1.5rem; line-height: 1.6;
}}
.ss-disclaimer b {{ color: {neon_bear}; }}

/* ── Divider ── */
.ss-divider {{ border: none; border-top: 1px solid {divider_color}; margin: 0.9rem 0; }}

/* ── DataFrame ── */
[data-testid="stDataFrame"], [data-testid="stDataFrame"] iframe,
.stDataFrame, .stDataFrame > div {{
    background: {bg2} !important; color: {text_pri} !important;
}}
[data-testid="stDataFrame"] iframe {{ color-scheme: {cs} !important; filter: none !important; }}

/* ── Password eye icon ── */
[data-testid="stTextInput"] button {{
    background: transparent !important; border: none !important; padding: 0 6px !important;
}}
[data-testid="stTextInput"] button svg,
[data-testid="stTextInput"] button svg path {{ fill: {text_mute} !important; color: {text_mute} !important; }}
[data-testid="stTextInput"] button:hover svg,
[data-testid="stTextInput"] button:hover svg path {{ fill: {text_pri} !important; }}
[data-testid="stTextInput"] svg, [data-testid="stSelectbox"] svg,
[data-testid="stMultiSelect"] svg {{ fill: {text_mute} !important; }}

/* ── Top nav tabs (Analysis / Watchlist) ── */
[data-testid="stTabs"] [role="tablist"] {{
    border-bottom: 1px solid {border} !important;
    gap: 2px !important; margin-bottom: 0 !important;
    background: {bg} !important;
}}
[data-testid="stTabs"] button[role="tab"] {{
    background: transparent !important; color: {text_mute} !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 0.84rem !important; font-weight: 500 !important;
    border-radius: 8px 8px 0 0 !important; padding: 8px 22px !important;
    border: 1px solid transparent !important; border-bottom: none !important;
    transition: all 0.15s !important; letter-spacing: 0.01em !important;
}}
[data-testid="stTabs"] button[role="tab"][aria-selected="true"] {{
    background: {tab_active_bg} !important; color: {neon_acc} !important;
    border-color: {border} !important; border-bottom-color: {tab_active_bg} !important;
    font-weight: 600 !important;
}}
[data-testid="stTabs"] button[role="tab"]:hover:not([aria-selected="true"]) {{
    color: {text_pri} !important; background: {btn_bg} !important;
}}
[data-testid="stTabs"] [data-testid="stTabContent"] {{
    padding-top: 0.9rem !important; background: {bg} !important;
}}

/* ── Panel secondary tabs (News / Analysis / Order Book) ── */
.ss-panel-tabs [data-testid="stTabs"] [role="tablist"] {{
    background: {bg2} !important;
    border-bottom: 1px solid {border} !important;
}}
.ss-panel-tabs [data-testid="stTabs"] button[role="tab"] {{
    font-size: 0.78rem !important; padding: 6px 14px !important;
}}
.ss-panel-tabs [data-testid="stTabs"] [data-testid="stTabContent"] {{
    background: {bg2} !important; padding-top: 0.8rem !important;
}}
.ss-panel-tabs div[data-testid="stVerticalBlock"] {{
    background: {bg2} !important;
}}

/* ── Panel container ── */
.ss-panel {{
    background: {bg2}; border: 1px solid {border};
    border-radius: 14px; overflow: hidden; height: 100%;
}}

/* ── Timeframe strip ── */
.ss-tf-strip {{
    display: flex; gap: 4px; margin-bottom: 0.5rem;
    padding-bottom: 0.5rem; border-bottom: 1px solid {border};
    overflow-x: auto; white-space: nowrap;
    -webkit-overflow-scrolling: touch;
}}
.ss-tf-btn {{
    display: inline-flex; align-items: center; justify-content: center;
    padding: 4px 13px; border-radius: 6px;
    font-size: 0.72rem; font-weight: 600;
    border: 1px solid {btn_border}; background: {btn_bg};
    color: {text_mute}; font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
}}
.ss-tf-btn-active {{
    background: {neon_acc}1A !important;
    border-color: {neon_acc}55 !important;
    color: {neon_acc} !important;
    box-shadow: 0 0 8px {neon_acc}18;
}}

/* ── News ── */
.ss-news-list {{ padding: 0; }}
.ss-news-item {{
    padding: 0.65rem 0; border-bottom: 1px solid {border};
}}
.ss-news-item:last-child {{ border-bottom: none; }}
.ss-news-title {{
    font-size: 0.82rem; font-weight: 600; color: {text_pri};
    line-height: 1.42; margin-bottom: 4px;
}}
.ss-news-title a {{
    color: {text_pri} !important; text-decoration: none;
}}
.ss-news-title a:hover {{ color: {neon_acc} !important; }}
.ss-news-meta {{
    font-size: 0.65rem; color: {text_mute};
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
}}
.ss-news-source {{ color: {neon_acc}; font-weight: 600; }}

/* ── Analyst consensus ── */
.ss-analyst-row {{
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0; border-bottom: 1px solid {border};
    font-size: 0.78rem;
}}
.ss-analyst-row:last-child {{ border-bottom: none; }}
.ss-analyst-label {{ color: {text_mute}; }}
.ss-analyst-val {{ color: {text_pri}; font-weight: 600; font-family: 'JetBrains Mono', monospace; }}

/* ── Watchlist ── */
.ss-wl-ticker {{
    font-size: 0.98rem; font-weight: 700; color: {text_pri};
    font-family: 'JetBrains Mono', monospace; line-height: 1.2;
}}
.ss-wl-price {{
    font-size: 1.15rem; font-weight: 700;
    font-family: 'JetBrains Mono', monospace; color: {text_pri};
}}
.ss-wl-pos {{
    color: {neon_bull}; font-size: 0.78rem; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    text-shadow: 0 0 8px {neon_bull}44;
}}
.ss-wl-neg {{
    color: {neon_bear}; font-size: 0.78rem; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    text-shadow: 0 0 8px {neon_bear}44;
}}
.ss-wl-chips {{ display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }}
.ss-wl-chip {{
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 0.66rem; font-weight: 600; padding: 2px 7px;
    border-radius: 5px; font-family: 'JetBrains Mono', monospace;
}}
.ss-wl-chip-bull {{ background: {neon_bull}15; border: 1px solid {neon_bull}35; color: {neon_bull}; }}
.ss-wl-chip-bear {{ background: {neon_bear}15; border: 1px solid {neon_bear}35; color: {neon_bear}; }}
.ss-wl-chip-neut {{ background: {btn_bg}; border: 1px solid {btn_border}; color: {text_mute}; }}
.ss-wl-pill-buy {{
    display: inline-block; background: {neon_bull}15;
    border: 1px solid {neon_bull}40; color: {neon_bull};
    font-size: 0.68rem; font-weight: 700; padding: 2px 11px;
    border-radius: 20px; letter-spacing: 0.05em;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 0 8px {neon_bull}18;
}}
.ss-wl-pill-sell {{
    display: inline-block; background: {neon_bear}15;
    border: 1px solid {neon_bear}40; color: {neon_bear};
    font-size: 0.68rem; font-weight: 700; padding: 2px 11px;
    border-radius: 20px; letter-spacing: 0.05em;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 0 8px {neon_bear}18;
}}
.ss-wl-pill-hold {{
    display: inline-block; background: {neon_acc}10;
    border: 1px solid {neon_acc}33; color: {neon_acc};
    font-size: 0.68rem; font-weight: 700; padding: 2px 11px;
    border-radius: 20px; letter-spacing: 0.05em;
    font-family: 'JetBrains Mono', monospace;
}}
.ss-wl-empty {{
    text-align: center; padding: 3rem 1rem;
    color: {text_mute}; font-size: 0.84rem; line-height: 2;
}}

/* ── Container (border=True) ── */
div[data-testid="stVerticalBlockBorderWrapper"] {{
    background: {bg2} !important; border: 1px solid {border} !important;
    border-radius: 13px !important; padding: 0 !important; margin-bottom: 0.5rem !important;
}}
div[data-testid="stVerticalBlockBorderWrapper"] > div[data-testid="stVerticalBlock"] {{
    padding: 0.8rem 0.9rem 0.6rem !important;
}}
/* Solid bg so Streamlit's internal dark surface never bleeds through */
[data-testid="stTabContent"] div[data-testid="stVerticalBlockBorderWrapper"] button[data-testid="baseButton-secondary"],
[data-testid="stTabContent"] div[data-testid="stVerticalBlockBorderWrapper"] .stButton > button,
div[data-testid="stVerticalBlockBorderWrapper"] button[data-testid="baseButton-secondary"] {{
    background: {wl_btn_bg} !important;
    border: 1px solid {btn_border} !important;
    color: {wl_btn_color} !important;
    padding: 3px 10px !important;
    min-height: 30px !important;
    font-size: 0.85rem !important;
    width: auto !important;
}}
[data-testid="stTabContent"] div[data-testid="stVerticalBlockBorderWrapper"] button[data-testid="baseButton-secondary"]:hover,
[data-testid="stTabContent"] div[data-testid="stVerticalBlockBorderWrapper"] .stButton > button:hover,
div[data-testid="stVerticalBlockBorderWrapper"] button[data-testid="baseButton-secondary"]:hover {{
    background: {btn_hover_bg} !important;
    border-color: {neon_acc}55 !important;
    color: {neon_acc} !important;
}}

/* ── Order book ── */
.ss-ob-row {{
    display: flex; justify-content: space-between; align-items: center;
    padding: 5px 0; font-size: 0.78rem; font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid {border};
}}
.ss-ob-row:last-child {{ border-bottom: none; }}
.ss-ob-label {{ color: {text_mute}; }}
.ss-ob-ask {{ color: {neon_bear}; font-weight: 600; }}
.ss-ob-bid {{ color: {neon_bull}; font-weight: 600; }}
.ss-ob-neutral {{ color: {text_pri}; font-weight: 600; }}

/* ── Day trade setup ── */
.ss-dt-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px; margin: 10px 0;
}}
.ss-dt-cell {{
    background: {bg3}; border: 1px solid {border};
    border-radius: 9px; padding: 8px 10px;
}}
.ss-dt-cell-label {{
    font-size: 0.62rem; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: {text_mute}; margin-bottom: 3px;
}}
.ss-dt-cell-val {{
    font-size: 0.96rem; font-weight: 700;
    font-family: 'JetBrains Mono', monospace; color: {text_pri};
    line-height: 1.2;
}}
.ss-dt-cell-sub {{
    font-size: 0.64rem; color: {text_mute}; margin-top: 2px;
    font-family: 'JetBrains Mono', monospace;
}}
.ss-dt-target-row {{
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 0; border-bottom: 1px solid {border};
    font-size: 0.78rem;
}}
.ss-dt-target-row:last-child {{ border-bottom: none; }}
.ss-dt-target-label {{ color: {text_mute}; font-weight: 600; min-width: 70px; }}
.ss-dt-target-price {{
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700; font-size: 0.88rem;
}}
.ss-dt-target-note {{
    font-size: 0.68rem; color: {text_mute}; text-align: right; flex: 1; padding-left: 8px;
}}
.ss-dt-signal-row {{
    display: flex; align-items: center; gap: 6px;
    font-size: 0.74rem; padding: 3px 0; color: {text_sec};
}}
.ss-dt-signal-ok  {{ color: {neon_bull}; font-size: 0.8rem; }}
.ss-dt-signal-no  {{ color: {neon_bear}; font-size: 0.8rem; }}
.ss-dt-signal-neut{{ color: {text_mute}; font-size: 0.8rem; }}
.ss-dt-quality-bar-wrap {{
    background: {btn_bg}; border-radius: 4px; height: 6px;
    width: 100%; overflow: hidden; margin: 4px 0 8px;
}}
.ss-dt-quality-bar {{ height: 6px; border-radius: 4px; }}
.ss-dt-entry-note {{
    font-size: 0.74rem; color: {text_sec}; line-height: 1.55;
    background: {neon_acc}0A; border: 1px solid {neon_acc}22;
    border-radius: 8px; padding: 8px 10px; margin-top: 10px;
}}

/* ── Watchlist action column: 📊 and ✕ side by side ── */
[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"] {{
    display: flex !important;
    flex-direction: row !important;
    gap: 4px !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    justify-content: flex-end !important;
}}
[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"] > [data-testid="stButton"] button {{
    padding: 3px 8px !important;
    min-height: 30px !important;
    width: auto !important;
    font-size: 0.9rem !important;
}}
</style>""", unsafe_allow_html=True)


# ── Inject CSS ────────────────────────────────────────────────────────────────
inject_css(_is_light())
tc = _theme_colors(_is_light())

# ─────────────────────────────────────────────────────────────────────────────
# LOGIN GATE
# ─────────────────────────────────────────────────────────────────────────────
if not _is_authenticated():
    st.markdown(
        f'''<div class="ss-login-wrap">
    <div class="ss-login-logo">📡</div>
    <div class="ss-login-title">SignalSense</div>
    <div class="ss-login-sub">AI-Powered Technical Analysis</div>
</div>''',
        unsafe_allow_html=True,
    )
    _, mid, _ = st.columns([1, 1.6, 1])
    with mid:
        st.markdown('<div class="ss-login-label">Username</div>', unsafe_allow_html=True)
        login_user = st.text_input("Username", label_visibility="collapsed", key="login_user")
        st.markdown('<div class="ss-login-label" style="margin-top:10px">Password</div>', unsafe_allow_html=True)
        login_pass = st.text_input("Password", type="password", label_visibility="collapsed", key="login_pass")
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("Sign in →", type="primary", use_container_width=True):
            if _check_credentials(login_user, login_pass):
                st.session_state["authenticated"] = True
                st.session_state["username"] = login_user
                st.rerun()
            else:
                st.error("Incorrect username or password.")
        st.caption("Set SS_USERNAME and SS_PASSWORD env vars to configure credentials.")
    st.stop()

# ─────────────────────────────────────────────────────────────────────────────
# AUTHENTICATED — Header
# ─────────────────────────────────────────────────────────────────────────────
username = st.session_state.get("username", "user")
theme_icon  = "☀️" if not _is_light() else "🌙"
theme_label = "Light mode" if not _is_light() else "Dark mode"

st.markdown(
    f'''<div class="ss-header">
    <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:24px;line-height:1">📡</div>
        <div>
            <div class="ss-title">SignalSense</div>
            <div class="ss-subtitle">AI-Powered Technical Analysis</div>
        </div>
    </div>
    <div class="ss-header-right">
        <span class="ss-user-badge">👤 {username}</span>
    </div>
</div>''',
    unsafe_allow_html=True,
)
st.markdown('<div class="ss-theme-btn-wrap">', unsafe_allow_html=True)
if st.button(theme_icon, help=theme_label, key="theme_toggle"):
    st.session_state["light_mode"] = not _is_light()
    st.rerun()
st.markdown('</div>', unsafe_allow_html=True)

# ── Sidebar — settings ────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### ⚙️ Settings")
    api_key_input = st.text_input(
        "Anthropic API Key",
        type="password",
        placeholder="sk-ant-…",
        help="Required for AI analysis. Get yours at console.anthropic.com",
    )
    st.caption("Your key is never stored or logged.")
    st.divider()
    if st.button("🚪  Sign out", use_container_width=True):
        st.session_state.clear()
        st.rerun()
    st.caption(f"Signed in as **{username}**")
    st.divider()
    st.caption("SignalSense v2.0 · Educational use only")

api_key = api_key_input.strip() or os.environ.get("ANTHROPIC_API_KEY", "")

# ── JS: tab-switch from watchlist Analyse button ──────────────────────────────
if st.session_state.pop("goto_analysis", False):
    components.html(
        """<script>
        setTimeout(function(){
            var tabs = window.parent.document.querySelectorAll('button[role="tab"]');
            if (tabs && tabs.length > 0) tabs[0].click();
        }, 180);
        </script>""",
        height=0,
    )

# ── Mobile bottom nav injection ───────────────────────────────────────────────
components.html(
    """<script>
(function() {
    var p = window.parent.document;
    var old = p.getElementById('ss-mob-nav');
    if (old) old.remove();
    var old_s = p.getElementById('ss-mob-nav-style');
    if (old_s) old_s.remove();

    var style = p.createElement('style');
    style.id = 'ss-mob-nav-style';
    style.textContent = [
        '#ss-mob-nav{',
        '  position:fixed;bottom:0;left:0;right:0;height:56px;',
        '  background:#0D1420;border-top:1px solid rgba(255,255,255,0.08);',
        '  display:flex;align-items:stretch;z-index:9999;',
        '}',
        '#ss-mob-nav button{',
        '  flex:1;background:transparent;border:none;',
        '  color:#5A6B8C;cursor:pointer;',
        '  display:flex;flex-direction:column;',
        '  align-items:center;justify-content:center;gap:2px;',
        '}',
        '#ss-mob-nav button .ico{font-size:1.25rem;line-height:1;}',
        '#ss-mob-nav button .lbl{font-size:0.55rem;font-family:sans-serif;letter-spacing:0.04em;text-transform:uppercase;}',
        '#ss-mob-nav button:hover{color:#00C8FF;}',
        '@media(min-width:769px){#ss-mob-nav{display:none!important;}}'
    ].join('');
    p.head.appendChild(style);

    var nav = p.createElement('div');
    nav.id = 'ss-mob-nav';
    nav.innerHTML = [
        '<button onclick="ssMobNav(0)"><span class=\\"ico\\">📊</span><span class=\\"lbl\\">Analysis</span></button>',
        '<button onclick="ssMobNav(1)"><span class=\\"ico\\">📋</span><span class=\\"lbl\\">Watchlist</span></button>',
        '<button onclick="ssMobNav(2)"><span class=\\"ico\\">⚙️</span><span class=\\"lbl\\">Settings</span></button>'
    ].join('');
    p.body.appendChild(nav);

    p.ssMobNav = function(idx) {
        if (idx === 2) {
            var btn = p.querySelector('[data-testid="stSidebarCollapseButton"] button');
            if (btn) { btn.click(); return; }
        }
        var tabs = p.querySelectorAll('[data-testid="stTabs"] button[role="tab"]');
        if (tabs[idx]) tabs[idx].click();
    };
})();
</script>""",
    height=0,
)

# ── Main tabs ─────────────────────────────────────────────────────────────────
tab_analysis, tab_watchlist = st.tabs(["📊  Analysis", "📋  Watchlist"])

# ═══════════════════════════════════════════════════════════════════════════════
# TAB 1 — ANALYSIS (Bento grid layout)
# ═══════════════════════════════════════════════════════════════════════════════
with tab_analysis:

    # ── Controls row ─────────────────────────────────────────────────────────
    ctrl_col, ind_col = st.columns([2.5, 1.5], gap="small")
    with ctrl_col:
        ticker_raw = st.text_input(
            "Ticker symbol",
            value=st.session_state.get("ticker", "AAPL"),
            placeholder="e.g. AAPL, TSLA, SPY …",
            label_visibility="collapsed",
        )
        ticker = ticker_raw.strip().upper() if ticker_raw else "AAPL"
        st.session_state["ticker"] = ticker

    with ind_col:
        with st.expander("⚙️  Indicators", expanded=False):
            selected_indicators = st.multiselect(
                "Active indicators",
                options=list(INDICATOR_OPTIONS.keys()),
                default=DEFAULT_INDICATORS,
                format_func=lambda k: INDICATOR_OPTIONS[k],
                label_visibility="collapsed",
            )
    if not selected_indicators:
        selected_indicators = DEFAULT_INDICATORS

    # ── Timeframe selector ────────────────────────────────────────────────────
    period_opts = {"1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730}
    current_tf = st.session_state.get("tf_label", "6M")
    tf_cols = st.columns(len(period_opts), gap="small")
    for i, (lbl, days_val) in enumerate(period_opts.items()):
        with tf_cols[i]:
            btn_type = "primary" if lbl == current_tf else "secondary"
            if st.button(lbl, key=f"tf_{lbl}", type=btn_type, use_container_width=True):
                st.session_state["tf_label"] = lbl
                st.rerun()

    days = period_opts[current_tf]
    end_dt   = date.today()
    start_dt = end_dt - timedelta(days=days)

    # ── Fetch data ────────────────────────────────────────────────────────────
    ticker = st.session_state.get("ticker", "AAPL")
    with st.spinner(f"Fetching {ticker} …"):
        df_raw  = fetch_stock_data(ticker, str(start_dt), str(end_dt))
        info    = fetch_ticker_info(ticker)
        price, change, pct = get_current_price(ticker)

    if df_raw is None or df_raw.empty:
        st.error(f"❌ Could not load data for **{ticker}**. Check the ticker and try again.")
        st.stop()

    df          = compute_indicators(df_raw, selected_indicators)
    ind_summary = build_indicator_summary(df)

    # ── Bento grid: chart pane | secondary panel ──────────────────────────────
    col_chart, col_panel = st.columns([3.5, 2.5], gap="small")

    # ────────────────── LEFT — Chart pane ─────────────────────────────────────
    with col_chart:
        # Price header
        company_name = info.get("longName", ticker)
        sector       = info.get("sector", "")
        market_cap   = info.get("marketCap", None)
        cap_str      = f"${market_cap / 1e9:.2f}B" if market_cap else "—"
        pe_ratio     = info.get("trailingPE", None)
        week_52_high = info.get("fiftyTwoWeekHigh", None)
        week_52_low  = info.get("fiftyTwoWeekLow", None)
        avg_vol      = info.get("averageVolume", None)

        change_class = "ss-change-pos" if (change or 0) >= 0 else "ss-change-neg"
        change_icon  = "▲" if (change or 0) >= 0 else "▼"
        price_str    = f"${price:,.2f}" if price else "—"
        change_str   = f"{change_icon} ${abs(change):.2f} ({abs(pct):.2f}%)" if change is not None else "—"

        stats_html = ""
        for label, val in [
            ("Mkt Cap", cap_str),
            ("P/E",     f"{pe_ratio:.1f}x" if pe_ratio else "—"),
            ("52W H",   f"${week_52_high:,.2f}" if week_52_high else "—"),
            ("52W L",   f"${week_52_low:,.2f}" if week_52_low else "—"),
            ("Avg Vol", f"{avg_vol/1e6:.1f}M" if avg_vol else "—"),
            ("Sector",  sector or "—"),
        ]:
            stats_html += f'<div class="ss-stat">{label} <b>{val}</b></div>'

        st.markdown(
            f"""<div class="ss-card" style="margin-bottom:0.5rem">
    <div style="font-size:0.72rem;color:{tc['text_mute']};margin-bottom:2px">
        {ticker} · {company_name}
    </div>
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
        <div class="ss-price">{price_str}</div>
        <div class="{change_class}">{change_str}</div>
    </div>
    <div class="ss-stats">{stats_html}</div>
</div>""",
            unsafe_allow_html=True,
        )

        # ── Indicator snapshot (shown first) ─────────────────────────────────
        st.markdown('<div class="ss-section">Indicator Snapshot</div>', unsafe_allow_html=True)

        val_color  = tc["text_pri"]
        mute_color = tc["text_mute"]

        def snap_card(label, value, status_html="", pill_class="ss-interp-neut", pill_label="", action=""):
            pill_html   = f'<span class="ss-interp {pill_class}">{pill_label}</span>' if pill_label else ""
            action_html = f'<div style="font-size:0.70rem;color:{mute_color};margin-top:5px;line-height:1.5">{action}</div>' if action else ""
            return (
                f'<div class="ss-card" style="margin-bottom:0.5rem">'
                f'<div class="ss-card-title">{label}</div>'
                f'<div style="font-size:1.25rem;font-weight:700;font-family:JetBrains Mono,monospace;color:{val_color}">{value}</div>'
                f'<div style="font-size:0.70rem;color:{mute_color};margin-top:2px">{status_html}</div>'
                f'{pill_html}{action_html}</div>'
            )

        snap_cols = st.columns(3, gap="small")
        rsi_val      = ind_summary.get("RSI")
        macd_val     = ind_summary.get("MACD")
        macd_sig_val = ind_summary.get("MACD_Signal")
        sma20_val    = ind_summary.get("SMA_20")
        sma50_val    = ind_summary.get("SMA_50")
        ema20_val    = ind_summary.get("EMA_20")

        with snap_cols[0]:
            if rsi_val is not None:
                rsi_status = "Overbought" if rsi_val > 70 else "Oversold" if rsi_val < 30 else "Neutral"
                rsi_color  = tc["neon_bear"] if rsi_val > 70 else tc["neon_bull"] if rsi_val < 30 else tc["neon_acc"]
                if rsi_val > 70:
                    rsi_pill_cls, rsi_pill_lbl = "ss-interp-bear", "&#128308; May pull back"
                    rsi_action = f"At {rsi_val:.1f}, RSI is overbought. Watch for a reversal candle or RSI dropping below 70."
                elif rsi_val < 30:
                    rsi_pill_cls, rsi_pill_lbl = "ss-interp-bull", "&#128994; Potential bounce"
                    rsi_action = f"At {rsi_val:.1f}, RSI signals oversold. Look for a bounce once RSI starts rising above 30."
                else:
                    rsi_pill_cls, rsi_pill_lbl = "ss-interp-neut", "&#128993; Neutral zone"
                    rsi_action = f"At {rsi_val:.1f}, RSI is neutral. Watch for breaks above 70 or below 30."
                st.markdown(snap_card(
                    "RSI (14)", f"{rsi_val:.1f}",
                    status_html=f'<span style="color:{rsi_color}">{rsi_status}</span>',
                    pill_class=rsi_pill_cls, pill_label=rsi_pill_lbl, action=rsi_action,
                ), unsafe_allow_html=True)
                st.markdown(
                    f'<div class="ss-rsi-wrap"><div class="ss-rsi-marker" style="left:{rsi_val}%"></div></div>'
                    f'<div class="ss-rsi-labels"><span>0</span><span>30</span><span>50</span><span>70</span><span>100</span></div>',
                    unsafe_allow_html=True,
                )

        with snap_cols[1]:
            if macd_val is not None and macd_sig_val is not None:
                bullish_cross = macd_val > macd_sig_val
                cross         = "Bullish Cross ↑" if bullish_cross else "Bearish Cross ↓"
                cross_color   = tc["neon_bull"] if bullish_cross else tc["neon_bear"]
                macd_hist     = ind_summary.get("MACD_Hist")
                if bullish_cross:
                    macd_pill_cls, macd_pill_lbl = "ss-interp-bull", "&#128994; Bullish momentum"
                    macd_action = (
                        f"MACD ({macd_val:.3f}) above signal — upward momentum active. "
                        + ("Histogram growing: trend strengthening." if macd_hist and macd_hist > 0
                           else "Watch histogram: shrinking = fading momentum.")
                    )
                else:
                    macd_pill_cls, macd_pill_lbl = "ss-interp-bear", "&#128308; Bearish momentum"
                    macd_action = (
                        f"MACD ({macd_val:.3f}) below signal — downward momentum dominates. "
                        + ("Histogram deepening: continued selling pressure." if macd_hist and macd_hist < 0
                           else "Narrowing histogram may signal early reversal.")
                    )
                st.markdown(snap_card(
                    "MACD", f"{macd_val:.3f}",
                    status_html=f'<span style="color:{cross_color}">{cross}</span>',
                    pill_class=macd_pill_cls, pill_label=macd_pill_lbl, action=macd_action,
                ), unsafe_allow_html=True)

        with snap_cols[2]:
            if sma20_val and sma50_val:
                golden      = sma20_val > sma50_val
                label_txt   = "Golden Cross &#127825;" if golden else "Death Cross &#9899;"
                label_color = "#fbbf24" if golden else tc["text_mute"]
                if golden:
                    sma_pill_cls, sma_pill_lbl = "ss-interp-bull", "&#128994; Bullish trend"
                    sma_action = f"SMA 20 ({sma20_val:.2f}) > SMA 50 ({sma50_val:.2f}): Golden Cross. Pullbacks to SMA 20 are buy opportunities."
                else:
                    sma_pill_cls, sma_pill_lbl = "ss-interp-bear", "&#128308; Bearish trend"
                    sma_action = f"SMA 20 ({sma20_val:.2f}) < SMA 50 ({sma50_val:.2f}): Death Cross. Rallies to SMA 20 are exit opportunities."
                st.markdown(snap_card(
                    "SMA 20 / 50", f"{sma20_val:.2f} / {sma50_val:.2f}",
                    status_html=f'<span style="color:{label_color}">{label_txt}</span>',
                    pill_class=sma_pill_cls, pill_label=sma_pill_lbl, action=sma_action,
                ), unsafe_allow_html=True)
            elif ema20_val and price:
                above       = price > ema20_val
                ema_pill_cls= "ss-interp-bull" if above else "ss-interp-bear"
                ema_pill_lbl= "&#128994; Price above EMA" if above else "&#128308; Price below EMA"
                ema_action  = (
                    f"Price (${price:.2f}) is {'above' if above else 'below'} EMA 20 ({ema20_val:.2f}). "
                    + ("Short-term bullish. EMA acts as dynamic support." if above
                       else "Short-term bearish. EMA acts as dynamic resistance.")
                )
                st.markdown(snap_card(
                    "EMA 20", f"{ema20_val:.2f}", status_html="20-day exponential MA",
                    pill_class=ema_pill_cls, pill_label=ema_pill_lbl, action=ema_action,
                ), unsafe_allow_html=True)

        # ── Day Trade Setup ───────────────────────────────────────────────────
        st.markdown('<div class="ss-section">Day Trade Setup</div>', unsafe_allow_html=True)

        # Compute ATR from raw data (always, independent of indicator selection)
        _atr = ind_summary.get("ATR")
        if _atr is None and len(df_raw) >= 15:
            _h = df_raw["High"]; _l = df_raw["Low"]; _c = df_raw["Close"]
            _tr = pd.concat([(_h - _l), (_h - _c.shift(1)).abs(), (_l - _c.shift(1)).abs()], axis=1).max(axis=1)
            _atr = float(_tr.rolling(14).mean().iloc[-1])

        # Support / resistance proxies
        _bb_upper = ind_summary.get("BB_Upper")
        _bb_lower = ind_summary.get("BB_Lower")
        _recent_high = float(df_raw["High"].tail(10).max()) if len(df_raw) >= 10 else None
        _recent_low  = float(df_raw["Low"].tail(10).min())  if len(df_raw) >= 10 else None
        _support     = max(filter(None, [_bb_lower, _recent_low * 1.001 if _recent_low else None]), default=None)
        _resistance  = min(filter(None, [_bb_upper, _recent_high * 0.999 if _recent_high else None]), default=None)

        # Signal scoring (4 signals checked)
        _sig_details = []
        _bull = 0; _bear = 0
        if rsi_val is not None:
            if rsi_val < 50:
                _bull += 1; _sig_details.append(("ok",  f"RSI {rsi_val:.1f} — below midline (bullish bias)"))
            else:
                _bear += 1; _sig_details.append(("no",  f"RSI {rsi_val:.1f} — above midline (bearish bias)"))
        if macd_val is not None and macd_sig_val is not None:
            if macd_val > macd_sig_val:
                _bull += 1; _sig_details.append(("ok",  "MACD above signal — upward momentum"))
            else:
                _bear += 1; _sig_details.append(("no",  "MACD below signal — downward momentum"))
        if sma20_val and sma50_val:
            if sma20_val > sma50_val:
                _bull += 1; _sig_details.append(("ok",  f"Golden Cross — SMA20 ({sma20_val:.2f}) > SMA50 ({sma50_val:.2f})"))
            else:
                _bear += 1; _sig_details.append(("no",  f"Death Cross — SMA20 ({sma20_val:.2f}) < SMA50 ({sma50_val:.2f})"))
        if price and ema20_val:
            if price > ema20_val:
                _bull += 1; _sig_details.append(("ok",  f"Price above EMA20 ({ema20_val:.2f}) — short-term bullish"))
            else:
                _bear += 1; _sig_details.append(("no",  f"Price below EMA20 ({ema20_val:.2f}) — short-term bearish"))
        if not _sig_details:
            _sig_details.append(("neut", "Not enough indicators active — enable RSI, MACD, SMA"))

        _total_sigs = _bull + _bear
        _dominant   = "LONG" if _bull > _bear else "SHORT" if _bear > _bull else "NEUTRAL"
        _quality    = max(_bull, _bear) if _total_sigs else 0
        _quality_pct= int(_quality / max(_total_sigs, 1) * 100)
        _quality_lbl= "Strong" if _quality_pct >= 75 else "Moderate" if _quality_pct >= 50 else "Weak"
        _qual_color = tc["neon_bull"] if _quality_pct >= 75 else "#fbbf24" if _quality_pct >= 50 else tc["neon_bear"]

        if price and _atr:
            _entry     = price
            _risk      = _atr * 1.5           # stop distance (1.5× ATR)
            if _dominant == "LONG":
                _stop  = _entry - _risk
                _t1    = _entry + _risk        # R:R 1:1
                _t2    = _entry + _risk * 2    # R:R 1:2
                _stop_pct = (_stop  - _entry) / _entry * 100
                _t1_pct   = (_t1   - _entry) / _entry * 100
                _t2_pct   = (_t2   - _entry) / _entry * 100
                _dir_color= tc["neon_bull"]
                _dir_icon = "↑"
            elif _dominant == "SHORT":
                _stop  = _entry + _risk
                _t1    = _entry - _risk
                _t2    = _entry - _risk * 2
                _stop_pct = (_stop  - _entry) / _entry * 100
                _t1_pct   = (_t1   - _entry) / _entry * 100
                _t2_pct   = (_t2   - _entry) / _entry * 100
                _dir_color= tc["neon_bear"]
                _dir_icon = "↓"
            else:
                _stop = _t1 = _t2 = None
                _stop_pct = _t1_pct = _t2_pct = None
                _dir_color= tc["neon_acc"]
                _dir_icon = "—"

            # Entry note
            if _dominant == "LONG":
                if rsi_val and rsi_val < 35:
                    _entry_note = f"⚡ RSI is oversold ({rsi_val:.1f}). Wait for a confirmation candle (green close above prior candle) before entering. Set stop at <b>${_stop:.2f}</b>."
                elif _support and price < _support * 1.015:
                    _entry_note = f"⚡ Price is near support (~${_support:.2f}). Enter on bounce confirmation. Avoid chasing — wait for a candle close above the support level."
                else:
                    _entry_note = f"⚡ Bullish confluence. Enter near <b>${_entry:.2f}</b> with stop at <b>${_stop:.2f}</b>. Tighten stop if price moves to T1."
            elif _dominant == "SHORT":
                if rsi_val and rsi_val > 65:
                    _entry_note = f"⚡ RSI is overbought ({rsi_val:.1f}). Wait for a bearish reversal candle before shorting. Set stop at <b>${_stop:.2f}</b>."
                elif _resistance and price > _resistance * 0.985:
                    _entry_note = f"⚡ Price is near resistance (~${_resistance:.2f}). Enter short on rejection confirmation. Avoid shorting into momentum."
                else:
                    _entry_note = f"⚡ Bearish confluence. Enter short near <b>${_entry:.2f}</b> with stop at <b>${_stop:.2f}</b>. Cover at T1 to lock in gains."
            else:
                _entry_note = "⚡ Signals are mixed — no clear directional edge right now. Wait for RSI, MACD, and price to align before taking a position."

            # Render direction badge + quality bar
            _dir_label = f"{'LONG SETUP' if _dominant == 'LONG' else 'SHORT SETUP' if _dominant == 'SHORT' else 'NO CLEAR SETUP'}"
            st.markdown(
                f'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
                f'<span style="font-size:0.9rem;font-weight:700;font-family:JetBrains Mono,monospace;'
                f'color:{_dir_color}">{_dir_icon} {_dir_label}</span>'
                f'<span style="font-size:0.72rem;color:{_qual_color};font-weight:600">'
                f'{_quality_lbl} ({_quality}/{_total_sigs} signals)</span>'
                f'</div>'
                f'<div class="ss-dt-quality-bar-wrap">'
                f'<div class="ss-dt-quality-bar" style="width:{_quality_pct}%;background:{_qual_color}"></div>'
                f'</div>',
                unsafe_allow_html=True,
            )

            # Entry / Stop / Risk grid
            _stop_str = f"${_stop:.2f}" if _stop else "—"
            _risk_str = f"${_risk:.2f}"
            st.markdown(
                f'<div class="ss-dt-grid">'
                f'<div class="ss-dt-cell">'
                f'<div class="ss-dt-cell-label">Entry (current)</div>'
                f'<div class="ss-dt-cell-val">${_entry:.2f}</div>'
                f'<div class="ss-dt-cell-sub">ATR = ${_atr:.2f}</div>'
                f'</div>'
                f'<div class="ss-dt-cell">'
                f'<div class="ss-dt-cell-label">Stop Loss</div>'
                f'<div class="ss-dt-cell-val" style="color:{tc["neon_bear"]}">{_stop_str}</div>'
                f'<div class="ss-dt-cell-sub">{f"{_stop_pct:+.2f}%" if _stop_pct else "1.5× ATR"}</div>'
                f'</div>'
                f'<div class="ss-dt-cell">'
                f'<div class="ss-dt-cell-label">Risk / Share</div>'
                f'<div class="ss-dt-cell-val">{_risk_str}</div>'
                f'<div class="ss-dt-cell-sub">1.5× ATR</div>'
                f'</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

            # Profit targets
            if _t1 and _t2:
                _t_color = tc["neon_bull"] if _dominant == "LONG" else tc["neon_bear"]
                st.markdown(
                    f'<div class="ss-card" style="padding:0.6rem 0.8rem;margin-bottom:0.5rem">'
                    f'<div class="ss-card-title">Profit Targets</div>'
                    f'<div class="ss-dt-target-row">'
                    f'<span class="ss-dt-target-label">T1 · 1:1 R:R</span>'
                    f'<span class="ss-dt-target-price" style="color:{_t_color}">${_t1:.2f} '
                    f'<span style="font-size:0.7rem;opacity:0.8">({_t1_pct:+.2f}%)</span></span>'
                    f'<span class="ss-dt-target-note">Cover 50–75% of position</span>'
                    f'</div>'
                    f'<div class="ss-dt-target-row">'
                    f'<span class="ss-dt-target-label">T2 · 1:2 R:R</span>'
                    f'<span class="ss-dt-target-price" style="color:{_t_color}">${_t2:.2f} '
                    f'<span style="font-size:0.7rem;opacity:0.8">({_t2_pct:+.2f}%)</span></span>'
                    f'<span class="ss-dt-target-note">Trail stop on remainder</span>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # Signal checklist
            sig_rows_html = ""
            _icon_map = {"ok": ("ss-dt-signal-ok", "✓"), "no": ("ss-dt-signal-no", "✗"), "neut": ("ss-dt-signal-neut", "–")}
            for _kind, _desc in _sig_details:
                _cls, _ico = _icon_map[_kind]
                sig_rows_html += (
                    f'<div class="ss-dt-signal-row">'
                    f'<span class="{_cls}">{_ico}</span>'
                    f'<span>{_desc}</span>'
                    f'</div>'
                )
            st.markdown(
                f'<div class="ss-card" style="padding:0.6rem 0.8rem;margin-bottom:0.5rem">'
                f'<div class="ss-card-title">Signal Checklist</div>'
                f'{sig_rows_html}'
                f'</div>',
                unsafe_allow_html=True,
            )

            # Entry note
            st.markdown(f'<div class="ss-dt-entry-note">{_entry_note}</div>', unsafe_allow_html=True)

        else:
            st.markdown(
                f'<div style="padding:1rem;text-align:center;color:{tc["text_mute"]};font-size:0.82rem">'
                f'Not enough data to compute trade setup. Enable at least one indicator.</div>',
                unsafe_allow_html=True,
            )

        st.markdown('<hr class="ss-divider">', unsafe_allow_html=True)

        # ── Charts in collapsed expanders ─────────────────────────────────────
        with st.expander("📈  Price Chart", expanded=False):
            chart = build_candlestick_chart(df, selected_indicators, ticker, light=_is_light())
            st.plotly_chart(
                chart, use_container_width=True,
                config={"scrollZoom": True, "displaylogo": False},
            )

        show_rsi  = "RSI"  in selected_indicators and "RSI"  in df.columns
        show_macd = "MACD" in selected_indicators and "MACD" in df.columns
        if show_rsi or show_macd:
            osc_label = "📊  RSI & MACD" if (show_rsi and show_macd) else ("📊  RSI" if show_rsi else "📊  MACD")
            with st.expander(osc_label, expanded=False):
                if show_rsi and show_macd:
                    r1, r2 = st.columns(2, gap="small")
                    with r1:
                        st.plotly_chart(build_rsi_chart(df, light=_is_light()),
                                        use_container_width=True, config={"displaylogo": False})
                    with r2:
                        st.plotly_chart(build_macd_chart(df, light=_is_light()),
                                        use_container_width=True, config={"displaylogo": False})
                elif show_rsi:
                    st.plotly_chart(build_rsi_chart(df, light=_is_light()),
                                    use_container_width=True, config={"displaylogo": False})
                else:
                    st.plotly_chart(build_macd_chart(df, light=_is_light()),
                                    use_container_width=True, config={"displaylogo": False})

        if "STOCH" in selected_indicators and "STOCH_K" in df.columns:
            with st.expander("📊  Stochastic", expanded=False):
                st.plotly_chart(build_stoch_chart(df, light=_is_light()),
                                use_container_width=True, config={"displaylogo": False})

        # ── Chart reading hints ───────────────────────────────────────────────
        CHART_HINTS = {
            "Price Chart": (
                "Each candle shows open, high, low, close. Green = bullish day. Red = bearish day. "
                "Long wicks signal indecision or rejection near support/resistance."
            ),
            "RSI": (
                "RSI measures momentum 0–100. Above 70 = overbought. Below 30 = oversold. "
                "Divergence: price new high but RSI doesn't follow — potential reversal."
            ),
            "MACD": (
                "MACD crossing above signal = bullish momentum. Histogram: growing = strengthening, shrinking = fading."
            ),
            "BB": (
                "Bands widen in volatile markets. Price at upper band = potentially overbought. "
                "A band squeeze often precedes a large breakout."
            ),
            "STOCH": (
                "%K crossing above %D in oversold zone (<20) = bullish. "
                "Best in ranging markets; confirm with MACD in trends."
            ),
        }

        # Raw data expander
        with st.expander("📊  Raw Data", expanded=False):
            show_cols = ["Open", "High", "Low", "Close", "Volume"] + [
                c for c in df.columns if c not in ("Open", "High", "Low", "Close", "Volume")
            ]
            show_cols = [c for c in show_cols if c in df.columns]
            _tdf      = df[show_cols].tail(60).copy()
            for _c in show_cols:
                if _c != "Volume":
                    _tdf[_c] = _tdf[_c].map(lambda x: f"{x:.2f}" if x == x else "")
            _tdf.index = _tdf.index.strftime("%Y-%m-%d")
            _t        = _is_light()
            _tbl_bg   = "#ffffff" if _t else "#0f1923"
            _tbl_bg2  = "#f8fafc" if _t else "#0a1220"
            _tb       = "rgba(0,0,0,0.08)" if _t else "rgba(255,255,255,0.07)"
            _tt       = "#0f172a" if _t else "#e2e8f0"
            _tm       = "#64748b"
            _hdr = "".join(
                f'<th style="padding:6px 10px;text-align:right;font-size:0.68rem;font-weight:700;'
                f'letter-spacing:0.06em;text-transform:uppercase;color:{_tm};'
                f'border-bottom:2px solid {_tb};white-space:nowrap;">{c}</th>'
                for c in ["Date"] + show_cols
            )
            _rows = ""
            for i, (_idx, _row) in enumerate(_tdf.iterrows()):
                _rbg  = _tbl_bg if i % 2 == 0 else _tbl_bg2
                _cell = (f'<td style="padding:5px 10px;font-size:0.74rem;color:{_tm};'
                         f'border-bottom:1px solid {_tb};font-family:JetBrains Mono,monospace;">{_idx}</td>')
                for _c in show_cols:
                    _v  = _row[_c]
                    _vc = _tt
                    if _c == "Close" and str(_v) != "":
                        try:
                            _vc = tc["neon_bull"] if float(_v) >= float(df["Close"].iloc[-1]) else tc["neon_bear"]
                        except Exception:
                            pass
                    _cell += (f'<td style="padding:5px 10px;text-align:right;font-size:0.74rem;'
                              f'color:{_vc};border-bottom:1px solid {_tb};'
                              f'font-family:JetBrains Mono,monospace;">{_v}</td>')
                _rows += f'<tr style="background:{_rbg}">{_cell}</tr>'
            st.markdown(
                f'<div style="overflow-x:auto;overflow-y:auto;max-height:300px;border-radius:10px;border:1px solid {_tb};">'
                f'<table style="width:100%;border-collapse:collapse;background:{_tbl_bg};">'
                f'<thead style="position:sticky;top:0;background:{_tbl_bg};z-index:1;"><tr>{_hdr}</tr></thead>'
                f'<tbody>{_rows}</tbody></table></div>',
                unsafe_allow_html=True,
            )

        hint_keys = ["Price Chart"] + [k for k in ["RSI", "MACD", "BB", "STOCH"] if k in selected_indicators]
        with st.expander("ℹ️  How to read these charts", expanded=True):
            for hk in hint_keys:
                st.markdown(
                    f'<div class="ss-gloss-card">'
                    f'<div class="ss-gloss-title">{hk}</div>'
                    f'<div class="ss-gloss-what">{CHART_HINTS[hk]}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    # ────────────────── RIGHT — Secondary panel ────────────────────────────────
    with col_panel:
        st.markdown(f'<div class="ss-panel">', unsafe_allow_html=True)
        st.markdown('<div class="ss-panel-tabs">', unsafe_allow_html=True)

        pan_analysis, pan_orderbook, pan_news = st.tabs(["🔍 Analysis", "📊 Order Book", "📰 News"])

        # ── News tab ──────────────────────────────────────────────────────────
        with pan_news:
            with st.spinner("Loading news …"):
                news_items = fetch_news(ticker)

            if not news_items:
                st.markdown(
                    f'<div style="padding:2rem 1rem;text-align:center;color:{tc["text_mute"]};font-size:0.82rem">'
                    f'No recent news found for {ticker}.</div>',
                    unsafe_allow_html=True,
                )
            else:
                news_html = '<div class="ss-news-list">'
                for item in news_items[:12]:
                    title     = item.get("title", "")
                    link      = item.get("link", "#")
                    publisher = item.get("publisher", "")
                    pub_time  = item.get("providerPublishTime", None)
                    if pub_time:
                        try:
                            dt_str = datetime.fromtimestamp(pub_time).strftime("%b %d, %H:%M")
                        except Exception:
                            dt_str = ""
                    else:
                        dt_str = ""
                    if not title:
                        continue
                    news_html += (
                        f'<div class="ss-news-item">'
                        f'<div class="ss-news-title">'
                        f'<a href="{link}" target="_blank" rel="noopener">{title}</a>'
                        f'</div>'
                        f'<div class="ss-news-meta">'
                        + (f'<span class="ss-news-source">{publisher}</span>' if publisher else "")
                        + (f'<span>{dt_str}</span>' if dt_str else "")
                        + f'</div></div>'
                    )
                news_html += '</div>'
                st.markdown(news_html, unsafe_allow_html=True)

        # ── Analysis tab ──────────────────────────────────────────────────────
        with pan_analysis:
            # Analyst consensus from yfinance
            target_mean  = info.get("targetMeanPrice")
            target_high  = info.get("targetHighPrice")
            target_low   = info.get("targetLowPrice")
            rec_mean     = info.get("recommendationMean")
            rec_key      = info.get("recommendationKey", "")
            analyst_count= info.get("numberOfAnalystOpinions")

            if any([target_mean, target_high, target_low, rec_mean]):
                rec_label_map = {
                    "strong_buy": "Strong Buy", "buy": "Buy",
                    "hold": "Hold", "sell": "Sell", "strong_sell": "Strong Sell",
                }
                rec_label = rec_label_map.get(rec_key.lower(), rec_key.title()) if rec_key else "—"
                rec_color = (
                    tc["neon_bull"] if rec_key.lower() in ("buy", "strong_buy") else
                    tc["neon_bear"] if rec_key.lower() in ("sell", "strong_sell") else
                    tc["neon_acc"]
                )

                rows_html = ""
                if analyst_count:
                    rows_html += f'<div class="ss-analyst-row"><span class="ss-analyst-label">Analysts</span><span class="ss-analyst-val">{analyst_count}</span></div>'
                if rec_label:
                    rows_html += (
                        f'<div class="ss-analyst-row"><span class="ss-analyst-label">Consensus</span>'
                        f'<span class="ss-analyst-val" style="color:{rec_color}">{rec_label}</span></div>'
                    )
                if target_mean and price:
                    upside = ((target_mean - price) / price) * 100
                    upside_color = tc["neon_bull"] if upside > 0 else tc["neon_bear"]
                    rows_html += (
                        f'<div class="ss-analyst-row"><span class="ss-analyst-label">Price Target</span>'
                        f'<span class="ss-analyst-val">${target_mean:.2f} '
                        f'<span style="font-size:0.7rem;color:{upside_color}">({upside:+.1f}%)</span></span></div>'
                    )
                if target_high:
                    rows_html += f'<div class="ss-analyst-row"><span class="ss-analyst-label">High Target</span><span class="ss-analyst-val">${target_high:.2f}</span></div>'
                if target_low:
                    rows_html += f'<div class="ss-analyst-row"><span class="ss-analyst-label">Low Target</span><span class="ss-analyst-val">${target_low:.2f}</span></div>'

                st.markdown(
                    f'<div class="ss-card" style="margin-bottom:0.7rem">'
                    f'<div class="ss-card-title">Analyst Consensus</div>'
                    f'{rows_html}</div>',
                    unsafe_allow_html=True,
                )

            # AI analysis
            st.markdown('<div class="ss-section">AI Trade Signal</div>', unsafe_allow_html=True)
            if not api_key:
                st.info("🔑 Add your Anthropic API key in the sidebar to enable AI signals.")

            analyze_btn = st.button(
                "🤖  Analyse with Claude" if api_key else "🔑  Enter API Key",
                type="primary",
                disabled=not api_key,
                use_container_width=True,
                key="ai_analyze_btn",
            )

            if analyze_btn and api_key:
                with st.spinner("Claude is analysing the technicals …"):
                    result = run_ai_analysis(ticker, ind_summary, info, api_key)

                if result is None:
                    st.error("❌ AI analysis failed. Check your API key and try again.")
                else:
                    signal     = result.get("signal", "HOLD").upper()
                    bias       = result.get("bias", "Neutral")
                    confidence = result.get("confidence", 50)
                    summary_t  = result.get("summary", "")
                    key_factors= result.get("key_factors", [])
                    risk_note  = result.get("risk_note", "")
                    support    = result.get("support")
                    resistance = result.get("resistance")

                    sig_cls = {"BUY": "ss-signal-buy", "SELL": "ss-signal-sell"}.get(signal, "ss-signal-hold")
                    bias_cls= {"Bullish": "ss-bias-bullish", "Bearish": "ss-bias-bearish"}.get(bias, "ss-bias-neutral")
                    conf_color = (
                        tc["neon_bull"] if confidence >= 65 else
                        "#fbbf24" if confidence >= 45 else
                        tc["neon_bear"]
                    )
                    factors_html = "".join(f'<span class="ss-factor">{f}</span>' for f in key_factors)
                    sup_res_html = ""
                    if support:
                        sup_res_html += f'<div class="ss-stat">Support <b>${support:.2f}</b></div>'
                    if resistance:
                        sup_res_html += f'<div class="ss-stat">Resistance <b>${resistance:.2f}</b></div>'

                    st.markdown(
                        f"""<div class="ss-card">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px">
        <div class="{sig_cls}">{signal}</div>
        <div>
            <div style="font-size:0.72rem;color:{tc['text_mute']};margin-bottom:2px">Bias</div>
            <div class="{bias_cls}" style="font-size:1rem">{bias}</div>
        </div>
        <div style="flex:1;min-width:120px">
            <div style="font-size:0.72rem;color:{tc['text_mute']};margin-bottom:4px">Confidence — {confidence}%</div>
            <div class="ss-conf-bar-wrap">
                <div class="ss-conf-bar" style="width:{confidence}%;background:{conf_color}"></div>
            </div>
        </div>
    </div>
    <p style="font-size:0.86rem;color:{tc['text_sec']};line-height:1.6;margin-bottom:9px">{summary_t}</p>
    <div class="ss-factors">{factors_html}</div>
    <div class="ss-stats" style="margin-top:9px">{sup_res_html}</div>
    {"" if not risk_note else f'<div style="margin-top:10px;padding:7px 11px;background:{tc["neon_bear"]}0A;border:1px solid {tc["neon_bear"]}33;border-radius:8px;font-size:0.74rem;color:{tc["neon_bear"]}CC">⚠️ {risk_note}</div>'}
</div>""",
                        unsafe_allow_html=True,
                    )

            # Indicator glossary (expanded by default)
            GLOSSARY = {
                "RSI": {
                    "title": "RSI — Relative Strength Index",
                    "what": "Momentum oscillator 0–100. Above 70 = overbought. Below 30 = oversold.",
                    "zones": [("bear",">70","Overbought"),("neut","30–70","Neutral"),("bull","<30","Oversold")],
                    "action": "<b>Above 70:</b> Watch for pullback. <b>Below 30:</b> Potential buy. <b>Divergence:</b> Price new high, RSI doesn't — reversal signal.",
                },
                "MACD": {
                    "title": "MACD (12, 26, 9)",
                    "what": "Difference between 12 and 26-day EMA. Signal line is 9-day EMA of MACD.",
                    "zones": [("bull","MACD>Signal","Bullish"),("bear","MACD<Signal","Bearish")],
                    "action": "<b>Bullish cross (below zero):</b> Strong buy signal. <b>Histogram shrinking:</b> Momentum fading.",
                },
                "SMA_20": {
                    "title": "SMA 20",
                    "what": "Average close over 20 days. Short-term dynamic support/resistance.",
                    "zones": [("bull","Price>SMA20","Uptrend"),("bear","Price<SMA20","Downtrend")],
                    "action": "<b>Price above:</b> Pullbacks are buy ops. <b>Price below:</b> Rallies are sell ops.",
                },
                "SMA_50": {
                    "title": "SMA 50 — Golden/Death Cross",
                    "what": "Average close over 50 days. SMA20 vs SMA50 defines Golden or Death Cross.",
                    "zones": [("bull","SMA20>SMA50","Golden Cross"),("bear","SMA20<SMA50","Death Cross")],
                    "action": "<b>Golden Cross:</b> Medium-term buy signal. <b>Death Cross:</b> Medium-term sell signal.",
                },
                "EMA_20": {
                    "title": "EMA 20",
                    "what": "Like SMA 20 but weights recent prices more heavily — faster signal.",
                    "zones": [("bull","Price>EMA20","Bullish"),("bear","Price<EMA20","Bearish")],
                    "action": "<b>Above EMA 20:</b> Use as trailing stop. <b>Below:</b> EMA acts as resistance.",
                },
                "EMA_50": {
                    "title": "EMA 50",
                    "what": "Medium-term momentum, reacts faster than SMA 50.",
                    "zones": [("bull","Price>EMA50","Uptrend"),("bear","Price<EMA50","Downtrend")],
                    "action": "<b>Deep pullback to EMA 50 in uptrend:</b> High-quality buy setup.",
                },
                "BB": {
                    "title": "Bollinger Bands (20, 2σ)",
                    "what": "SMA 20 ± 2 standard deviations. Expand with volatility, contract in calm periods.",
                    "zones": [("bear","Near upper","Overbought"),("bull","Near lower","Oversold"),("warn","Squeezing","Breakout brewing")],
                    "action": "<b>Band squeeze:</b> Trade the breakout direction. <b>Walking the band:</b> Strong trend — don't fade it.",
                },
                "ATR": {
                    "title": "ATR (14)",
                    "what": "Average daily price range. Higher = more volatile. No direction signal.",
                    "zones": [("warn","Rising ATR","Volatility up"),("neut","Falling ATR","Compression")],
                    "action": "<b>Stop-loss:</b> Set 1.5–2× ATR from entry. <b>Position size:</b> Risk ÷ ATR.",
                },
                "OBV": {
                    "title": "OBV — On-Balance Volume",
                    "what": "Cumulative volume flow: adds on up-days, subtracts on down-days.",
                    "zones": [("bull","Rising OBV","Accumulation"),("bear","Falling OBV","Distribution")],
                    "action": "<b>OBV rising, price flat:</b> Breakout may be brewing. <b>OBV falling as price rises:</b> Bearish divergence.",
                },
                "STOCH": {
                    "title": "Stochastic (14, 3, 3)",
                    "what": "%K vs %D. Compares close to high-low range over 14 periods.",
                    "zones": [("bear","%K>80","Overbought"),("neut","20–80","Neutral"),("bull","%K<20","Oversold")],
                    "action": "<b>%K crosses %D in oversold:</b> Buy signal. <b>%K crosses %D in overbought:</b> Sell signal.",
                },
            }

            active_gloss = [k for k in selected_indicators if k in GLOSSARY]
            if active_gloss:
                zone_cls_map = {"bull": "ss-gloss-zone-bull", "bear": "ss-gloss-zone-bear", "neut": "ss-gloss-zone-neut", "warn": "ss-gloss-zone-neut"}
                with st.expander("📖  Indicator glossary", expanded=True):
                    for key in active_gloss:
                        g = GLOSSARY[key]
                        zones_html = "".join(
                            f'<span class="ss-gloss-zone {zone_cls_map.get(z[0], "ss-gloss-zone-neut")}">'
                            + z[1] + " — " + z[2] + "</span>"
                            for z in g["zones"]
                        )
                        st.markdown(
                            f'<div class="ss-gloss-card">'
                            f'<div class="ss-gloss-title">{g["title"]}</div>'
                            f'<div class="ss-gloss-what">{g["what"]}</div>'
                            f'<div class="ss-gloss-row">{zones_html}</div>'
                            f'<div class="ss-gloss-action">{g["action"]}</div>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

        # ── Order Book tab ────────────────────────────────────────────────────
        with pan_orderbook:
            bid      = info.get("bid")
            ask      = info.get("ask")
            bid_size = info.get("bidSize")
            ask_size = info.get("askSize")
            volume   = info.get("volume")
            avg_vol3m= info.get("averageVolume10days")
            open_p   = info.get("open")
            prev_c   = info.get("previousClose")
            day_high = info.get("dayHigh")
            day_low  = info.get("dayLow")

            rows = []
            if bid and ask:
                spread     = ask - bid
                spread_pct = (spread / ask * 100) if ask else 0
                rows += [
                    ("Ask", f"${ask:.2f}" + (f" × {ask_size}" if ask_size else ""), "ss-ob-ask"),
                    ("Bid", f"${bid:.2f}" + (f" × {bid_size}" if bid_size else ""), "ss-ob-bid"),
                    ("Spread", f"${spread:.4f} ({spread_pct:.3f}%)", "ss-ob-neutral"),
                ]
            if open_p:
                rows.append(("Open", f"${open_p:.2f}", "ss-ob-neutral"))
            if prev_c:
                rows.append(("Prev Close", f"${prev_c:.2f}", "ss-ob-neutral"))
            if day_high and day_low:
                rows.append(("Day Range", f"${day_low:.2f} – ${day_high:.2f}", "ss-ob-neutral"))
            if volume:
                rows.append(("Volume", f"{volume:,.0f}", "ss-ob-neutral"))
            if avg_vol3m:
                rows.append(("10d Avg Vol", f"{avg_vol3m:,.0f}", "ss-ob-neutral"))

            if rows:
                ob_html = '<div class="ss-card" style="margin-bottom:0.5rem">'
                ob_html += '<div class="ss-card-title">Market Data</div>'
                for lbl, val, cls in rows:
                    ob_html += (
                        f'<div class="ss-ob-row">'
                        f'<span class="ss-ob-label">{lbl}</span>'
                        f'<span class="{cls}">{val}</span>'
                        f'</div>'
                    )
                ob_html += '</div>'
                st.markdown(ob_html, unsafe_allow_html=True)
            else:
                st.markdown(
                    f'<div style="padding:1.5rem;text-align:center;color:{tc["text_mute"]};font-size:0.82rem">'
                    f'Market data unavailable for {ticker}.</div>',
                    unsafe_allow_html=True,
                )

            # Add to watchlist shortcut
            st.markdown('<div class="ss-section">Watchlist</div>', unsafe_allow_html=True)
            if st.button(f"＋ Add {ticker} to Watchlist", use_container_width=True, key="ob_add_wl"):
                current_wl = load_watchlist(username)
                if ticker not in current_wl:
                    add_ticker(username, ticker)
                    st.success(f"{ticker} added to watchlist.")
                else:
                    st.info(f"{ticker} is already in your watchlist.")

        st.markdown('</div></div>', unsafe_allow_html=True)  # close ss-panel-tabs, ss-panel

    # Disclaimer at bottom of analysis tab
    st.markdown(
        f"""<div class="ss-disclaimer">
<b>⚠️ DISCLAIMER — EDUCATIONAL USE ONLY</b><br>
SignalSense is for informational and educational purposes only. Nothing here constitutes financial,
investment, legal, or tax advice. Technical indicators and AI signals are not guarantees of future
performance. Trading involves significant risk, including possible loss of your entire investment.
Always do your own due diligence and consult a licensed financial advisor.
</div>""",
        unsafe_allow_html=True,
    )

# ═══════════════════════════════════════════════════════════════════════════════
# TAB 2 — WATCHLIST
# ═══════════════════════════════════════════════════════════════════════════════
with tab_watchlist:

    wl = load_watchlist(username)

    st.markdown('<div class="ss-section">My Watchlist</div>', unsafe_allow_html=True)

    col_add, col_addbtn, col_refresh = st.columns([2.2, 0.8, 0.8], gap="small")
    with col_add:
        new_ticker_raw = st.text_input(
            "Add ticker",
            placeholder="e.g. NVDA, SPY, MSFT …",
            label_visibility="collapsed",
            key="wl_add_input",
        )
    with col_addbtn:
        if st.button("＋ Add", use_container_width=True, key="wl_add_btn"):
            if new_ticker_raw and new_ticker_raw.strip():
                wl = add_ticker(username, new_ticker_raw.strip())
                st.rerun()
    with col_refresh:
        if st.button("🔄 Refresh", use_container_width=True, key="wl_refresh"):
            fetch_stock_data.clear()
            fetch_ticker_info.clear()
            st.rerun()

    if not wl:
        st.markdown(
            '<div class="ss-wl-empty">'
            '📋<br><b>Your watchlist is empty</b><br>'
            'Add a ticker above to start tracking stocks.'
            '</div>',
            unsafe_allow_html=True,
        )
    else:
        with st.spinner("Loading watchlist data …"):
            for t in wl:
                row = get_watchlist_row_data(t)

                pill_map = {
                    "BUY":  '<span class="ss-wl-pill-buy">BUY</span>',
                    "SELL": '<span class="ss-wl-pill-sell">SELL</span>',
                    "HOLD": '<span class="ss-wl-pill-hold">HOLD</span>',
                }
                sig_html = pill_map.get(row["signal"], f'<span>{row["signal"]}</span>')

                rsi_v = row["rsi"]
                if rsi_v is not None:
                    rsi_cls = "ss-wl-chip-bear" if rsi_v > 70 else "ss-wl-chip-bull" if rsi_v < 30 else "ss-wl-chip-neut"
                    rsi_chip = f'<span class="ss-wl-chip {rsi_cls}">RSI {rsi_v:.1f}</span>'
                else:
                    rsi_chip = '<span class="ss-wl-chip ss-wl-chip-neut">RSI —</span>'

                mc = row["macd_cross"]
                macd_chip = (
                    '<span class="ss-wl-chip ss-wl-chip-bull">MACD ↑</span>' if mc == "Bull" else
                    '<span class="ss-wl-chip ss-wl-chip-bear">MACD ↓</span>' if mc == "Bear" else
                    '<span class="ss-wl-chip ss-wl-chip-neut">MACD —</span>'
                )

                sc = row["sma_cross"]
                sma_chip = (
                    '<span class="ss-wl-chip ss-wl-chip-bull">Golden ✦</span>' if sc == "Golden" else
                    '<span class="ss-wl-chip ss-wl-chip-bear">Death ✗</span>'   if sc == "Death"  else
                    '<span class="ss-wl-chip ss-wl-chip-neut">SMA —</span>'
                )

                price_txt = f"${row['price']:,.2f}" if row["price"] else "—"
                if row["pct"] is not None:
                    chg_cls  = "ss-wl-pos" if row["pct"] >= 0 else "ss-wl-neg"
                    chg_icon = "▲" if row["pct"] >= 0 else "▼"
                    chg_html = f'<span class="{chg_cls}">{chg_icon} {abs(row["pct"]):.2f}%</span>'
                    if row["change"] is not None:
                        chg_html += f' <span style="font-size:0.74rem;color:{tc["text_mute"]}">(${abs(row["change"]):.2f})</span>'
                else:
                    chg_html = f'<span style="color:{tc["text_mute"]}">—</span>'

                with st.container(border=True):
                    col_info, col_actions = st.columns([3.5, 1.5], gap="small")

                    with col_info:
                        st.markdown(
                            f'<div class="ss-wl-ticker">{t}</div>'
                            f'<div style="display:flex;align-items:baseline;gap:8px;margin:3px 0 2px">'
                            f'<span class="ss-wl-price">{price_txt}</span>{chg_html}'
                            f'<span style="margin-left:4px">{sig_html}</span></div>'
                            f'<div class="ss-wl-chips">{rsi_chip}{macd_chip}{sma_chip}</div>',
                            unsafe_allow_html=True,
                        )

                    with col_actions:
                        if st.button("📊", key=f"wl_analyse_{t}", help=f"Analyse {t}"):
                            st.session_state["ticker"] = t
                            st.session_state["goto_analysis"] = True
                            st.rerun()
                        if st.button("✕", key=f"wl_remove_{t}", help=f"Remove {t}"):
                            remove_ticker(username, t)
                            st.rerun()

        st.caption(
            f"{len(wl)} ticker{'s' if len(wl) != 1 else ''} · "
            f"Signal = majority vote of RSI, MACD, SMA · Data cached 5 min"
        )

