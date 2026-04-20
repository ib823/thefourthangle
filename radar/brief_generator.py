"""Auto-generate pipeline-v3-format briefs from the T4A radar issue queue.

Reference: fourth-angle-pipeline-v3.md Part 6 (Research-brief format).

For every issue in the queue whose controversy_score exceeds the threshold
(default 0.6), this module emits an editor-ready .txt brief with:

    ISSUE / PERIOD / CONTEXT / ACTORS / RELEVANT LAW /
    12-DIMENSION AUDIT NOTES / RECOMMENDED LENSES

Context is assembled from whatever raw events are available: news RSS headlines
(first-sentence extracts), GDELT tone + actor data, Reddit titles, and Google
Trends breakouts. Actors are surfaced by pattern matching against a curated
Malaysian actors list (editable via config.yaml).

Dimension mapping (as specified in the task):
    polarization  → 2, 3, 4  (political, ethnic, religious)
    narrative     → 5        (narrative)
    silence       → 6        (completeness)
    bridge Malay↔Chinese → 3, 11  (ethnic, economic)
    Cox ramadan   → 4        (religious)
    Cox budget    → 11       (economic)

Quality gate: READY if ≥3 context points AND ≥1 actor AND ≥2 flagged
dimensions; otherwise DRAFT. Filenames always use the `auto-{issue_id}.txt`
convention so humans can see which briefs came from the radar.

Optional auto-trigger hook: when `config.brief_generator.auto_trigger` is
true AND the issue's score exceeds `auto_trigger_threshold` (default 0.8)
AND the brief is READY, the generator records an auto-trigger intent in
`engine/briefs/auto-trigger.log`. It never starts external LLM calls itself —
that step remains a human / external-orchestrator decision.

CLI: python run-radar.py --generate-briefs
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

# ---- canonical data ------------------------------------------------------

# 1-indexed to match the 12-DIMENSION RISK ASSESSMENT numbering used across
# existing briefs in engine/briefs/.
DIMENSIONS = [
    "Sentiment", "Political", "Ethnic", "Religious", "Narrative",
    "Completeness", "Temporal", "Confidence", "Sources", "Geographic",
    "Economic", "Gender",
]

# Map a dimension (1-12) to the primary T4A lens used in the editorial pipeline.
DIMENSION_TO_LENS = {
    1: "Social",        2: "Political",   3: "Social",
    4: "Theological",   5: "Critical",    6: "Governance",
    7: "Historical",    8: "Evidence",    9: "Sources",
    10: "Regional",     11: "Economic",   12: "Social",
}

# Curated Malaysian actors. The config.yaml `brief_generator.actors` key
# (when present) is *merged* into these defaults so operators can add rather
# than replace.
DEFAULT_ACTORS = {
    "politicians": [
        "Anwar Ibrahim", "Mahathir Mohamad", "Najib Razak", "Muhyiddin Yassin",
        "Ismail Sabri", "Hishammuddin Hussein", "Ahmad Zahid Hamidi",
        "Zahid Hamidi", "Lim Guan Eng", "Rafizi Ramli", "Saifuddin Nasution",
        "Azam Baki", "Hadi Awang", "Abdul Hadi", "Sanusi", "Fahmi Fadzil",
        "Nik Nazmi", "Tengku Zafrul", "Wan Fayhsal", "Hannah Yeoh",
        "Latheefa Koya",
    ],
    "institutions": [
        "MACC", "SPRM", "PAC", "AGC", "BNM", "Bank Negara", "EPF", "KWSP",
        "Petronas", "Khazanah", "MCMC", "JAKIM", "JAIS", "Parliament",
        "Parlimen", "Dewan Rakyat", "Dewan Negara", "High Court",
        "Federal Court", "Court of Appeal", "Home Ministry", "KDN", "MITI",
        "MOF", "RMP", "PDRM", "SUHAKAM", "Suruhanjaya", "Auditor General",
    ],
    "parties": [
        "UMNO", "PAS", "PKR", "DAP", "Bersatu", "Amanah", "MIC", "MCA",
        "Gerakan", "PBB", "GPS", "GRS", "Warisan", "Muda",
        "Perikatan Nasional", "Pakatan Harapan", "Barisan Nasional",
    ],
}

# Stream → dimension mapping (1-indexed dims as per task spec).
STREAM_DIMENSION_MAP = {
    "polarization": [2, 3, 4],
    "narrative_fragmentation": [5],
    "narrative": [5],                  # alias used in issue record
    "silence_detector": [6],
    "silence": [6],
    "network_bridge": [3, 11],         # Malay↔Chinese bridge
    "bridge": [3, 11],
}

# Cox risk-factor name → dimension list.
COX_FACTOR_DIMENSION_MAP = {
    "ramadan": [4],
    "days_to_budget": [11],
    "parliamentary_session": [2],
    "sensitivity_date": [3, 4],
    "religious_keyword": [4],
    "ethnic_keyword": [3],
    "elite_mention": [2],
    "initial_er_index": [2, 3],
    "initial_n_star": [5],
    "initial_bridge_score": [3, 11],
    "weekend": [],
}

# Thresholds that determine whether a raw signal is "strong enough" to flag
# its mapped dimensions.
FLAG_THRESHOLDS = {
    "polarization_er": 0.4,
    "narrative_jsd": 0.3,
    "silence_score": 0.5,
    "bridge_score": 0.5,
    "cox_contribution_abs": 0.05,
}

DEFAULT_SCORE_THRESHOLD = 0.6
DEFAULT_AUTO_TRIGGER_THRESHOLD = 0.8
DEFAULT_OUTPUT_DIR = Path("engine/briefs")
AUTO_TRIGGER_LOG_NAME = "auto-trigger.log"


# ---- law templates -------------------------------------------------------

LAW_KEYWORD_MAP: list[tuple[tuple[str, ...], str]] = [
    (("rasuah", "corruption", "macc", "sprm", "1mdb"),
     "MACC Act 2009 — Malaysian Anti-Corruption Commission framework"),
    (("islam", "masjid", "mosque", "jakim", "syariah", "fatwa", "halal"),
     "Federal Constitution, Article 3 and Article 11 — Islam and freedom of religion"),
    (("melayu", "malay", "cina", "chinese", "bumiputera", "ethnic", "race", "kaum"),
     "Federal Constitution, Article 153 — Special position of the Malays and natives"),
    (("sedition", "hasutan", "insult"),
     "Sedition Act 1948"),
    (("cma", "233", "offensive content", "fake news"),
     "Communications and Multimedia Act 1998, Section 233"),
    (("protest", "demonstrasi", "assembly", "himpunan"),
     "Peaceful Assembly Act 2012"),
    (("detention", "sosma", "poca", "isa"),
     "Security Offences (Special Measures) Act 2012 (SOSMA) / POCA"),
    (("budget", "belanjawan", "fiscal", "subsidy", "subsidi"),
     "Financial Procedure Act 1957 — budget and public-funds governance"),
    (("parliament", "parlimen", "dewan rakyat", "bill"),
     "Standing Orders of the Dewan Rakyat"),
    (("court", "ruling", "mahkamah", "judgment"),
     "Courts of Judicature Act 1964"),
    (("immigration", "migrant", "worker"),
     "Anti-Trafficking in Persons and Anti-Smuggling of Migrants Act 2007 (ATIPSOM) / Employment Act 1955"),
    (("defamation", "libel", "fitnah"),
     "Defamation Act 1957"),
    (("election", "pilihanraya", "spr"),
     "Elections Act 1958 / Election Offences Act 1954"),
]


# ---- helpers -------------------------------------------------------------


def _safe_actor_match(text: str, actor: str) -> bool:
    """Word-boundary actor match — prevents 'PAS' matching 'passenger'."""
    pattern = r"\b" + re.escape(actor) + r"\b"
    return re.search(pattern, text, flags=re.IGNORECASE) is not None


def _platform_of(event: dict) -> str:
    return str(event.get("platform", "")).lower()


def _issue_topic_keywords(title: str) -> list[str]:
    """Heuristic: pull 3-5 salient-looking tokens from a (possibly messy) issue title."""
    if not title:
        return []
    # Strip URLs, HTML entities, punctuation runs.
    cleaned = re.sub(r"https?://\S+", " ", title)
    cleaned = re.sub(r"&[a-z]+;", " ", cleaned)
    tokens = [t for t in re.split(r"[^A-Za-z\u00C0-\uFFFF]+", cleaned) if t]
    stop = {"the", "a", "an", "of", "to", "in", "on", "for", "and", "or",
            "is", "are", "was", "were", "be", "by", "with", "from"}
    return [t for t in tokens if len(t) > 2 and t.lower() not in stop][:5]


def _first_sentence(text: str, max_chars: int = 260) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    # Split on sentence-ending punctuation but keep it short.
    m = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)
    s = m[0] if m else text
    if len(s) > max_chars:
        s = s[:max_chars].rstrip() + "…"
    return s


def _derive_period(issue: dict, events: list[dict]) -> str:
    """Build a human-readable PERIOD line from the issue timestamp and event dates."""
    iso_ts = issue.get("timestamp") or ""
    try:
        issue_dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        issue_dt = None

    event_dts = []
    for e in events:
        try:
            event_dts.append(
                datetime.fromisoformat(str(e.get("timestamp", "")).replace("Z", "+00:00"))
            )
        except ValueError:
            pass

    if event_dts:
        start = min(event_dts)
        end = max(event_dts + ([issue_dt] if issue_dt else []))
    elif issue_dt:
        start = end = issue_dt
    else:
        now = datetime.now(timezone.utc)
        start = end = now

    if start.date() == end.date():
        return start.strftime("%B %d, %Y")
    return f"{start.strftime('%B %d, %Y')} – {end.strftime('%B %d, %Y')}"


# ---- brief generator -----------------------------------------------------


class BriefGenerator:
    """Emit pipeline-v3 research-brief stubs from the T4A issue queue."""

    def __init__(
        self,
        config: dict | None = None,
        calendar: dict | None = None,
        output_dir: Path | str = DEFAULT_OUTPUT_DIR,
    ):
        self.config = config or {}
        self.calendar = calendar or {}
        self.output_dir = Path(output_dir)

        bg_cfg = (config or {}).get("brief_generator", {}) or {}
        self.score_threshold = float(bg_cfg.get("score_threshold", DEFAULT_SCORE_THRESHOLD))
        self.auto_trigger_enabled = bool(bg_cfg.get("auto_trigger", False))
        self.auto_trigger_threshold = float(
            bg_cfg.get("auto_trigger_threshold", DEFAULT_AUTO_TRIGGER_THRESHOLD)
        )

        # Merge operator actors on top of defaults.
        self.actors: dict[str, list[str]] = {k: list(v) for k, v in DEFAULT_ACTORS.items()}
        extra_actors = bg_cfg.get("actors", {}) or {}
        for category, names in extra_actors.items():
            bucket = self.actors.setdefault(category, [])
            for n in names or []:
                if n not in bucket:
                    bucket.append(n)

    # ---- public API -----------------------------------------------------

    def generate(
        self,
        issues: list[dict],
        events: list[dict] | None = None,
    ) -> list[dict]:
        """Generate briefs for all qualifying issues.

        Returns a list of result dicts (one per brief attempted):
            {issue_id, title, path, status, quality, auto_triggered}
        """
        events = events or []
        results: list[dict] = []

        events_by_topic = self._group_events_by_topic(events, issues)

        for issue in issues:
            if float(issue.get("controversy_score", 0)) < self.score_threshold:
                continue
            topic_events = events_by_topic.get(issue.get("title", ""), [])
            text, quality = self.build_brief(issue, topic_events)
            path = self._write_brief(issue, text)
            auto_triggered = self._maybe_auto_trigger(issue, quality)
            results.append({
                "issue_id": issue.get("issue_id"),
                "title": issue.get("title"),
                "path": str(path),
                "status": quality["status"],
                "quality": quality,
                "auto_triggered": auto_triggered,
            })
        return results

    def build_brief(self, issue: dict, events: list[dict]) -> tuple[str, dict]:
        """Build brief text + quality dict for a single issue + its events."""
        context = self._extract_context(issue, events)
        actors = self._extract_actors(issue, events)
        laws = self._suggest_laws(issue, events)
        dimensions = self._map_dimensions(issue)
        lenses = self._recommend_lenses(dimensions)
        period = _derive_period(issue, events)
        quality = self._quality_check(context, actors, dimensions)
        text = self._render(issue, period, context, actors, laws, dimensions, lenses, quality)
        return text, quality

    # ---- section builders ----------------------------------------------

    def _group_events_by_topic(
        self, events: list[dict], issues: list[dict]
    ) -> dict[str, list[dict]]:
        """Crude topic-matching: each event is attached to every issue whose
        title keyword appears in the event text. Matches how radar's fusion
        already groups signals by keyword mentions."""
        title_terms = []
        for issue in issues:
            title = issue.get("title", "")
            kws = _issue_topic_keywords(title) or [title]
            title_terms.append((title, [t.lower() for t in kws]))

        out: dict[str, list[dict]] = {t: [] for t, _ in title_terms}
        for e in events:
            text = str(e.get("text", "")).lower()
            if not text:
                continue
            for title, kws in title_terms:
                if any(kw in text for kw in kws):
                    out[title].append(e)
        return out

    def _extract_context(self, issue: dict, events: list[dict]) -> list[dict]:
        """Assemble multi-source context points (RSS, GDELT, Reddit, Trends)."""
        points: list[dict] = []
        buckets: dict[str, list[dict]] = {}
        for e in events:
            buckets.setdefault(_platform_of(e), []).append(e)

        # RSS news — take headline + first sentence.
        for e in buckets.get("news", [])[:4]:
            text = _first_sentence(e.get("text", ""))
            if not text:
                continue
            points.append({
                "type": "rss",
                "text": text,
                "source": e.get("source_name", "news"),
                "timestamp": e.get("timestamp", ""),
            })

        # GDELT — aggregate tone, list top source domains.
        gdelt = buckets.get("gdelt", [])
        if gdelt:
            tones = []
            domains: dict[str, int] = {}
            for e in gdelt:
                md = e.get("metadata", {})
                if isinstance(md, dict) and "tone" in md:
                    tones.append(float(md.get("tone") or 0.0))
                dom = e.get("source_name")
                if dom:
                    domains[dom] = domains.get(dom, 0) + 1
            if tones:
                avg = sum(tones) / len(tones)
                polarity = "negative" if avg < -1 else "positive" if avg > 1 else "neutral"
                top_domains = ", ".join(
                    f"{d}({c})" for d, c in sorted(
                        domains.items(), key=lambda kv: -kv[1])[:5]
                )
                points.append({
                    "type": "gdelt_tone",
                    "text": f"GDELT aggregate tone across {len(tones)} articles: "
                            f"{avg:.2f} ({polarity}). Top domains: {top_domains or 'n/a'}.",
                    "source": "GDELT DOC API",
                    "timestamp": "",
                })

        # Reddit titles.
        for e in buckets.get("reddit", [])[:3]:
            text = _first_sentence(e.get("text", ""), max_chars=180)
            if not text:
                continue
            points.append({
                "type": "reddit",
                "text": text,
                "source": e.get("source_name", "reddit"),
                "timestamp": e.get("timestamp", ""),
            })

        # Google Trends breakouts.
        for e in buckets.get("google_trends", [])[:2]:
            md = e.get("metadata", {}) or {}
            label = "breakout" if md.get("breakout") else ("rising" if md.get("rising") else "search interest")
            points.append({
                "type": "trends",
                "text": f"Google Trends {label}: {e.get('text', '').strip()}",
                "source": "Google Trends",
                "timestamp": e.get("timestamp", ""),
            })

        # Fallback: if we got nothing from events, synthesize from issue signals.
        if not points:
            points.extend(self._signal_derived_context(issue))

        return points

    def _signal_derived_context(self, issue: dict) -> list[dict]:
        """Zero-events fallback: turn stream signals into context bullets."""
        out: list[dict] = []
        signals = issue.get("stream_signals", {}) or {}
        vol = signals.get("volume", {}) or {}
        if vol.get("alert"):
            out.append({
                "type": "signal",
                "text": (f"Mention-volume alert: z-score={vol.get('z_score', 0):.2f}, "
                         f"severity={vol.get('severity', 0):.2f}."),
                "source": "radar.volume_monitor",
                "timestamp": issue.get("timestamp", ""),
            })
        pol = signals.get("polarization", {}) or {}
        if pol.get("er_index", 0) > 0:
            out.append({
                "type": "signal",
                "text": (f"Polarization ER index={pol.get('er_index', 0):.2f}, "
                         f"divergence {pol.get('divergence_trend', 'stable')}."),
                "source": "radar.polarization",
                "timestamp": issue.get("timestamp", ""),
            })
        pred = issue.get("prediction") or {}
        if pred.get("regime"):
            out.append({
                "type": "signal",
                "text": (f"HMM regime={pred['regime']}; Cox median eruption="
                         f"{pred.get('eruption_hours', 'n/a')}h."),
                "source": "radar.prediction",
                "timestamp": issue.get("timestamp", ""),
            })
        return out

    def _extract_actors(self, issue: dict, events: list[dict]) -> dict[str, list[str]]:
        """Match issue + event text against curated actor lists."""
        pool_parts = [issue.get("title", "")]
        for e in events[:30]:
            pool_parts.append(str(e.get("text", "")))
        pool = " ".join(pool_parts)

        found: dict[str, list[str]] = {k: [] for k in self.actors}
        for category, names in self.actors.items():
            for n in names:
                if _safe_actor_match(pool, n) and n not in found[category]:
                    found[category].append(n)
        return found

    def _suggest_laws(self, issue: dict, events: list[dict]) -> list[str]:
        """Keyword-based suggestion of relevant Malaysian legislation."""
        pool = issue.get("title", "") + " " + " ".join(
            str(e.get("text", "")) for e in events[:10]
        )
        pool_lower = pool.lower()
        laws: list[str] = []
        for keywords, law in LAW_KEYWORD_MAP:
            if any(kw in pool_lower for kw in keywords):
                if law not in laws:
                    laws.append(law)
        if not laws:
            laws.append("Federal Constitution of Malaysia (general public-interest framing)")
        return laws

    def _map_dimensions(self, issue: dict) -> dict:
        """Flag 12-dimension audit entries from signals + Cox risk factors."""
        flagged: set[int] = set()
        notes: dict[int, list[str]] = {}

        signals = issue.get("stream_signals", {}) or {}

        pol = signals.get("polarization", {}) or {}
        if (pol.get("er_index", 0) > FLAG_THRESHOLDS["polarization_er"]
                or pol.get("divergence_trend") == "widening"):
            for d in STREAM_DIMENSION_MAP["polarization"]:
                flagged.add(d)
                notes.setdefault(d, []).append(
                    f"polarization: ER={pol.get('er_index', 0):.2f} "
                    f"trend={pol.get('divergence_trend', 'stable')}"
                )

        narr = signals.get("narrative", {}) or {}
        if (narr.get("jsd_overall", 0) > FLAG_THRESHOLDS["narrative_jsd"]
                or narr.get("fragmentation_trend") == "rising"):
            for d in STREAM_DIMENSION_MAP["narrative"]:
                flagged.add(d)
                notes.setdefault(d, []).append(
                    f"narrative: JSD={narr.get('jsd_overall', 0):.2f} "
                    f"trend={narr.get('fragmentation_trend', 'stable')}"
                )

        sil = signals.get("silence", {}) or {}
        if sil.get("silence_score", 0) > FLAG_THRESHOLDS["silence_score"]:
            for d in STREAM_DIMENSION_MAP["silence"]:
                flagged.add(d)
                notes.setdefault(d, []).append(
                    f"silence: score={sil.get('silence_score', 0):.2f} "
                    f"pattern={sil.get('suppression_pattern', 'NORMAL')}"
                )

        bridge = signals.get("bridge", {}) or {}
        if bridge.get("bridge_score", 0) > FLAG_THRESHOLDS["bridge_score"]:
            for d in STREAM_DIMENSION_MAP["bridge"]:
                flagged.add(d)
                notes.setdefault(d, []).append(
                    f"network bridge (Malay↔Chinese): "
                    f"score={bridge.get('bridge_score', 0):.2f}"
                )

        # Cox risk factors
        pred = issue.get("prediction") or {}
        for rf in pred.get("risk_factors") or []:
            name = rf.get("name")
            contribution = float(rf.get("contribution", 0.0))
            if name not in COX_FACTOR_DIMENSION_MAP:
                continue
            if abs(contribution) < FLAG_THRESHOLDS["cox_contribution_abs"]:
                continue
            for d in COX_FACTOR_DIMENSION_MAP[name]:
                flagged.add(d)
                direction = "accelerates" if contribution > 0 else "decelerates"
                notes.setdefault(d, []).append(
                    f"Cox factor `{name}` {direction} eruption "
                    f"(contribution={contribution:+.2f}, HR={rf.get('hazard_ratio', 1.0):.2f})"
                )

        return {"flagged": sorted(flagged), "notes": notes}

    def _recommend_lenses(self, dimensions: dict) -> list[str]:
        lenses: list[str] = []
        for d in dimensions["flagged"]:
            lens = DIMENSION_TO_LENS.get(d)
            if lens and lens not in lenses:
                lenses.append(lens)
        return lenses[:5] or ["Governance"]

    def _quality_check(
        self, context: list[dict], actors: dict, dimensions: dict,
    ) -> dict:
        total_actors = sum(len(v) for v in actors.values())
        n_dims = len(dimensions["flagged"])
        n_ctx = len(context)
        pass_ctx = n_ctx >= 3
        pass_actors = total_actors >= 1
        pass_dims = n_dims >= 2
        status = "READY" if (pass_ctx and pass_actors and pass_dims) else "DRAFT"
        return {
            "status": status,
            "context_points": n_ctx,
            "actors": total_actors,
            "dimensions": n_dims,
            "pass_context": pass_ctx,
            "pass_actors": pass_actors,
            "pass_dimensions": pass_dims,
        }

    # ---- rendering ------------------------------------------------------

    def _render(
        self,
        issue: dict,
        period: str,
        context: list[dict],
        actors: dict[str, list[str]],
        laws: list[str],
        dimensions: dict,
        lenses: list[str],
        quality: dict,
    ) -> str:
        issue_id = issue.get("issue_id", "UNKNOWN")
        title = issue.get("title", "(untitled)")
        score = float(issue.get("controversy_score", 0.0))
        priority = issue.get("priority", "unknown")

        lines: list[str] = []
        lines.append(f"# ISSUE {issue_id} — {title}")
        lines.append("")
        lines.append(f"**Source:** T4A Radar auto-brief — "
                     f"score={score:.2f} priority={priority} status={quality['status']}")
        lines.append(f"**Generated:** {datetime.now(timezone.utc).isoformat()}")
        lines.append("")

        lines.append("## PERIOD")
        lines.append(period)
        lines.append("")

        lines.append("## CONTEXT")
        if context:
            for p in context:
                src = p.get("source", "")
                ts = p.get("timestamp", "")
                suffix = f" ({src}"
                if ts:
                    suffix += f", {ts}"
                suffix += ")"
                lines.append(f"- [{p.get('type', 'fact')}] {p.get('text', '')}{suffix}")
        else:
            lines.append("- (no context points — fetch events before generating)")
        lines.append("")

        lines.append("## ACTORS")
        any_actor = False
        for category in ("politicians", "institutions", "parties"):
            names = actors.get(category, [])
            if names:
                any_actor = True
                lines.append(f"**{category.title()}:** " + ", ".join(names))
        if not any_actor:
            lines.append("*(no named actors matched — needs NER expansion)*")
        lines.append("")

        lines.append("## RELEVANT LAW")
        for i, law in enumerate(laws, 1):
            lines.append(f"{i}. {law}")
        lines.append("")

        lines.append("## 12-DIMENSION AUDIT NOTES")
        notes = dimensions["notes"]
        flagged = set(dimensions["flagged"])
        for i, name in enumerate(DIMENSIONS, 1):
            marker = "⚑" if i in flagged else "·"
            note_lines = notes.get(i, [])
            if note_lines:
                joined = "; ".join(note_lines)
                lines.append(f"{marker} {i:>2}. {name}: {joined}")
            else:
                lines.append(f"{marker} {i:>2}. {name}: —")
        lines.append("")

        lines.append("## RECOMMENDED LENSES")
        lines.append(", ".join(lenses))
        lines.append("")

        lines.append("## QUALITY GATE")
        lines.append(
            f"- context points: {quality['context_points']} "
            f"({'pass' if quality['pass_context'] else 'FAIL — need ≥3'})"
        )
        lines.append(
            f"- actors: {quality['actors']} "
            f"({'pass' if quality['pass_actors'] else 'FAIL — need ≥1'})"
        )
        lines.append(
            f"- dimensions flagged: {quality['dimensions']} "
            f"({'pass' if quality['pass_dimensions'] else 'FAIL — need ≥2'})"
        )
        lines.append(f"- overall: **{quality['status']}**")
        lines.append("")

        return "\n".join(lines)

    # ---- persistence + auto-trigger ------------------------------------

    def _write_brief(self, issue: dict, text: str) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        issue_id = str(issue.get("issue_id", "UNKNOWN")).replace("/", "_")
        path = self.output_dir / f"auto-{issue_id}.txt"
        path.write_text(text, encoding="utf-8")
        return path

    def _maybe_auto_trigger(self, issue: dict, quality: dict) -> bool:
        if not self.auto_trigger_enabled:
            return False
        if float(issue.get("controversy_score", 0)) < self.auto_trigger_threshold:
            return False
        if quality["status"] != "READY":
            return False
        self._log_auto_trigger(issue, quality)
        return True

    def _log_auto_trigger(self, issue: dict, quality: dict):
        """Append an auto-trigger intent to engine/briefs/auto-trigger.log.

        This does *not* start external LLM calls — it signals that the human
        or an external orchestrator should advance the issue into Stage 2-6.
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)
        log_path = self.output_dir / AUTO_TRIGGER_LOG_NAME
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "issue_id": issue.get("issue_id"),
            "title": issue.get("title"),
            "controversy_score": issue.get("controversy_score"),
            "priority": issue.get("priority"),
            "quality": quality,
        }
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, default=str) + "\n")


# ---- integration helpers used by run-radar.py CLI ------------------------


def generate_from_queue(
    queue_path: Path | str,
    config: dict,
    calendar: dict,
    events: list[dict] | None = None,
    output_dir: Path | str = DEFAULT_OUTPUT_DIR,
) -> list[dict]:
    """Convenience: load the queue and generate briefs in one shot.

    Called by `python run-radar.py --generate-briefs`.
    """
    queue_path = Path(queue_path)
    if not queue_path.exists():
        return []
    with open(queue_path) as f:
        issues = json.load(f)
    if not isinstance(issues, list):
        return []

    gen = BriefGenerator(config=config, calendar=calendar, output_dir=output_dir)
    return gen.generate(issues, events=events)
