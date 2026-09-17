#!/usr/bin/env python3
"""F1 Performance Intelligence — PDF report generator.

Reads a JSON payload (session + analytics) from stdin and writes a vector PDF
to stdout. Used by the Next.js API route /api/reports/pdf/[sessionId].

Report sections:
  1. Cover / header (Racing Bulls branding, session context)
  2. Circuit summary
  3. Driver comparison (best laps, our vs rival)
  4. Delta-P summary table (avg / max per pair)
  5. Top problem zones (channel deltas)
  6. Recommendations
"""
import json
import sys
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---- Font registration (DejaVu — full Latin + mono coverage) ----
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("Sans", f"{FONT_DIR}/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Bold", f"{FONT_DIR}/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Mono", f"{FONT_DIR}/DejaVuSansMono.ttf"))
pdfmetrics.registerFont(TTFont("Mono-Bold", f"{FONT_DIR}/DejaVuSansMono-Bold.ttf"))

# ---- Racing Bulls palette (carbon + racing red, no blue/indigo) ----
C_BG = colors.HexColor("#16161a")
C_CARD = colors.HexColor("#1d1d24")
C_FG = colors.HexColor("#f5f5f5")
C_MUTED = colors.HexColor("#a1a1aa")
C_BORDER = colors.HexColor("#3f3f46")
C_RED = colors.HexColor("#f87171")
C_RED_DARK = colors.HexColor("#dc2626")
C_AMBER = colors.HexColor("#fbbf24")
C_EMERALD = colors.HexColor("#34d399")

STYLES = None

def build_styles():
    global STYLES
    if STYLES:
        return STYLES
    ss = getSampleStyleSheet()
    STYLES = {
        "title": ParagraphStyle("title", parent=ss["Title"], fontName="Sans-Bold",
                                fontSize=22, leading=26, textColor=C_FG, spaceAfter=2, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("subtitle", parent=ss["Normal"], fontName="Sans",
                                    fontSize=10, leading=13, textColor=C_MUTED, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontName="Sans-Bold",
                             fontSize=13, leading=16, textColor=C_RED, spaceBefore=10, spaceAfter=6),
        "body": ParagraphStyle("body", parent=ss["Normal"], fontName="Sans",
                               fontSize=9.5, leading=13, textColor=C_FG, spaceAfter=4),
        "small": ParagraphStyle("small", parent=ss["Normal"], fontName="Sans",
                                 fontSize=8, leading=10, textColor=C_MUTED),
        "kpi_label": ParagraphStyle("kpi_label", parent=ss["Normal"], fontName="Sans",
                                     fontSize=7.5, leading=9, textColor=C_MUTED, alignment=TA_CENTER),
        "kpi_value": ParagraphStyle("kpi_value", parent=ss["Normal"], fontName="Mono-Bold",
                                     fontSize=14, leading=16, textColor=C_FG, alignment=TA_CENTER),
        "rec": ParagraphStyle("rec", parent=ss["Normal"], fontName="Sans",
                              fontSize=9.5, leading=13, textColor=C_FG, leftIndent=10, spaceAfter=4),
    }
    return STYLES


def fmt_lap(ms):
    if ms is None:
        return "—"
    m = int(ms // 60000)
    s = int((ms % 60000) // 1000)
    cs = int((ms % 1000) // 10)
    return f"{m}:{s:02d}.{cs:02d}"


def fmt_delta(ms):
    sign = "+" if ms > 0 else ""
    return f"{sign}{ms/1000:.3f}"


def page_background(canv, doc):
    w, h = A4
    canv.saveState()
    canv.setFillColor(C_BG)
    canv.rect(0, 0, w, h, fill=1, stroke=0)
    # subtle grid
    canv.setStrokeColor(colors.HexColor("#27272a"))
    canv.setLineWidth(0.3)
    for x in range(0, int(w), 22):
        canv.line(x, 0, x, h)
    for y in range(0, int(h), 22):
        canv.line(0, y, w, y)
    # red top accent bar
    canv.setFillColor(C_RED)
    canv.rect(0, h - 4, w, 4, fill=1, stroke=0)
    # footer
    canv.setFillColor(C_MUTED)
    canv.setFont("Sans", 7.5)
    canv.drawString(20 * mm, 12 * mm, "Racing Bulls · Performance Intelligence Platform")
    canv.drawRightString(w - 20 * mm, 12 * mm, f"Page {doc.page}  ·  Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    canv.setStrokeColor(C_BORDER)
    canv.setLineWidth(0.5)
    canv.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
    canv.restoreState()


def first_page(canv, doc):
    page_background(canv, doc)
    w, h = A4
    canv.saveState()
    canv.setFillColor(C_RED_DARK)
    canv.roundRect(20 * mm, h - 28 * mm, 12 * mm, 12 * mm, 2, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Sans-Bold", 12)
    canv.drawCentredString(26 * mm, h - 24 * mm, "RB")
    canv.restoreState()


def later_page(canv, doc):
    page_background(canv, doc)


def kpi_card(label, value, accent=C_FG):
    styles = build_styles()
    tbl = Table([
        [Paragraph(label.upper(), styles["kpi_label"])],
        [Paragraph(str(value), styles["kpi_value"])],
    ], colWidths=[42 * mm], rowHeights=[8 * mm, 12 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_CARD),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, accent),
    ]))
    return tbl


def build_report(payload):
    styles = build_styles()
    story = []

    session = payload.get("session", {})
    circuit = session.get("circuit", {})
    drivers_data = session.get("drivers", [])
    pair_summary = payload.get("pairSummary", [])
    problem_zones = payload.get("problemZones", [])
    best_laps = payload.get("bestLaps", [])
    recommendations = payload.get("recommendations", [])

    # ---- Cover / header ----
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("PERFORMANCE INTELLIGENCE REPORT", styles["subtitle"]))
    story.append(Paragraph(f"Round {session.get('round', '?')} · {circuit.get('name', '?')} · {session.get('type', '?')}", styles["title"]))
    cond = session.get("condition", "dry")
    story.append(Paragraph(
        f"{circuit.get('country', '')} · {session.get('date', '')[:10]} · "
        f"Air {session.get('airTemp', 0):.1f}°C  Track {session.get('trackTemp', 0):.1f}°C  {cond}",
        styles["subtitle"]
    ))
    story.append(Spacer(1, 4 * mm))

    # KPI row
    our_best = min((bl.get("bestMs", 1e9) for bl in best_laps), default=0)
    fastest_rival_ms = min(
        (d["laps"][0]["lapTimeMs"] for d in drivers_data if d["driver"].get("isRival") and d.get("laps")),
        default=0,
    )
    avg_delta = pair_summary[0].get("avgDeltaMs", 0) if pair_summary else 0

    kpi_row = Table([[
        kpi_card("Best lap (ours)", fmt_lap(our_best) or "—", C_RED),
        kpi_card("Best lap (rival)", fmt_lap(fastest_rival_ms) or "—", C_AMBER),
        kpi_card("Avg Δ vs rival", fmt_delta(avg_delta), C_EMERALD if avg_delta <= 0 else C_RED),
        kpi_card("Problem zones", str(len(problem_zones)), C_AMBER),
    ]], colWidths=[42 * mm] * 4)
    kpi_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(kpi_row)
    story.append(Spacer(1, 6 * mm))

    # ---- Circuit summary ----
    story.append(Paragraph("Circuit Summary", styles["h2"]))
    circuit_rows = [
        ["Circuit", circuit.get("name", "—"), "Country", circuit.get("country", "—")],
        ["Track length", f"{circuit.get('trackLength', 0):.3f} km", "Corners", str(circuit.get("corners", "—"))],
        ["Session type", session.get("type", "—"), "Status", session.get("status", "—")],
        ["Air temp", f"{session.get('airTemp', 0):.1f} °C", "Track temp", f"{session.get('trackTemp', 0):.1f} °C"],
    ]
    ct = Table(circuit_rows, colWidths=[35 * mm, 50 * mm, 35 * mm, 50 * mm])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_CARD),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, C_BORDER),
        ("FONTNAME", (0, 0), (0, -1), "Sans-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Sans-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Mono"),
        ("FONTNAME", (3, 0), (3, -1), "Mono"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), C_MUTED),
        ("TEXTCOLOR", (2, 0), (2, -1), C_MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), C_FG),
        ("TEXTCOLOR", (3, 0), (3, -1), C_FG),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ct)
    story.append(Spacer(1, 6 * mm))

    # ---- Driver comparison table ----
    story.append(Paragraph("Driver Comparison — Best Laps", styles["h2"]))
    hdr = [["Pos", "Driver", "Team", "Cmp", "Lap", "Time", "Δ to best"]]
    rows = []
    all_best = []
    for d in drivers_data:
        drv = d["driver"]
        laps = [l for l in d.get("laps", []) if l.get("isValid")]
        if not laps:
            continue
        best = min(laps, key=lambda l: l["lapTimeMs"])
        all_best.append((drv, best))
    all_best.sort(key=lambda x: x[1]["lapTimeMs"])
    fastest_ms = all_best[0][1]["lapTimeMs"] if all_best else 0
    for i, (drv, best) in enumerate(all_best, 1):
        rows.append([
            str(i),
            f"{drv['code']}  {drv['name']}",
            drv.get("team", ""),
            (best.get("tireCompound") or "—").upper()[:1],
            str(best["lapNumber"]),
            fmt_lap(best["lapTimeMs"]),
            fmt_delta(best["lapTimeMs"] - fastest_ms) if i > 1 else "—",
        ])
    comp_tbl = Table(hdr + rows, colWidths=[12 * mm, 45 * mm, 38 * mm, 12 * mm, 12 * mm, 22 * mm, 22 * mm])
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), C_CARD),
        ("TEXTCOLOR", (0, 0), (-1, 0), C_MUTED),
        ("FONTNAME", (0, 0), (-1, 0), "Sans-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("BACKGROUND", (0, 1), (-1, -1), C_CARD),
        ("FONTNAME", (1, 1), (-1, -1), "Mono"),
        ("FONTNAME", (1, 1), (1, -1), "Sans-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), C_FG),
        ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, C_BORDER),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (5, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for i, (drv, best) in enumerate(all_best, 1):
        if not drv.get("isRival"):
            ts.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#2a1a1a")))
            ts.append(("TEXTCOLOR", (1, i), (1, i), C_RED))
    comp_tbl.setStyle(TableStyle(ts))
    story.append(comp_tbl)
    story.append(Spacer(1, 6 * mm))

    # ---- Delta-P summary ----
    if pair_summary:
        story.append(Paragraph("Delta-P Summary vs Rivals", styles["h2"]))
        d_hdr = [["Our driver", "Rival", "Avg Δ (s)", "Max Δ (s)", "Min Δ (s)", "Laps"]]
        d_rows = []
        for p in pair_summary:
            d_rows.append([
                p.get("driverCode", "—"),
                p.get("rivalCode", "—"),
                fmt_delta(p.get("avgDeltaMs", 0)),
                fmt_delta(p.get("maxDeltaMs", 0)),
                fmt_delta(p.get("minDeltaMs", 0)),
                str(p.get("lapCount", 0)),
            ])
        dt = Table(d_hdr + d_rows, colWidths=[28 * mm, 28 * mm, 25 * mm, 25 * mm, 25 * mm, 18 * mm])
        dt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C_CARD),
            ("TEXTCOLOR", (0, 0), (-1, 0), C_MUTED),
            ("FONTNAME", (0, 0), (-1, 0), "Sans-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), C_CARD),
            ("FONTNAME", (0, 1), (-1, -1), "Mono"),
            ("FONTNAME", (0, 1), (1, -1), "Sans-Bold"),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), C_FG),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, C_BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ]))
        story.append(dt)
        story.append(Spacer(1, 6 * mm))

    # ---- Problem zones ----
    if problem_zones:
        story.append(PageBreak())
        story.append(Paragraph("Top Problem Zones — Channel Diffs", styles["h2"]))
        story.append(Paragraph(
            "Largest absolute deltas between our driver and the rival across the selected channel. "
            "These are the corners/segments where we are losing the most performance.",
            styles["body"]
        ))
        story.append(Spacer(1, 3 * mm))
        p_hdr = [["#", "Distance (m)", "Lap", "Sector", "Channel", "Δ value", "Severity"]]
        p_rows = []
        for i, z in enumerate(problem_zones, 1):
            delta = z.get("delta", 0)
            sev = "CRITICAL" if abs(delta) > 5 else "WARNING" if abs(delta) > 2 else "INFO"
            p_rows.append([
                str(i),
                str(z.get("distance", z.get("distanceM", "—"))),
                str(z.get("lap", z.get("lapNumber", "—"))),
                str(z.get("sector", "—")),
                str(z.get("channelKey", "—")),
                f"{delta:+.2f}",
                sev,
            ])
        pt = Table(p_hdr + p_rows, colWidths=[10 * mm, 25 * mm, 15 * mm, 15 * mm, 30 * mm, 22 * mm, 25 * mm])
        pstyle = [
            ("BACKGROUND", (0, 0), (-1, 0), C_CARD),
            ("TEXTCOLOR", (0, 0), (-1, 0), C_MUTED),
            ("FONTNAME", (0, 0), (-1, 0), "Sans-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), C_CARD),
            ("FONTNAME", (0, 1), (-1, -1), "Mono"),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), C_FG),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (5, 0), (6, -1), "RIGHT"),
            ("BOX", (0, 0), (-1, -1), 0.5, C_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, C_BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ]
        for i, z in enumerate(problem_zones, 1):
            delta = z.get("delta", 0)
            if abs(delta) > 5:
                pstyle.append(("BACKGROUND", (6, i), (6, i), colors.HexColor("#3a1a1a")))
                pstyle.append(("TEXTCOLOR", (6, i), (6, i), C_RED))
            elif abs(delta) > 2:
                pstyle.append(("BACKGROUND", (6, i), (6, i), colors.HexColor("#3a2e1a")))
                pstyle.append(("TEXTCOLOR", (6, i), (6, i), C_AMBER))
            else:
                pstyle.append(("TEXTCOLOR", (6, i), (6, i), C_EMERALD))
        pt.setStyle(TableStyle(pstyle))
        story.append(pt)
        story.append(Spacer(1, 6 * mm))

    # ---- Recommendations ----
    if recommendations:
        story.append(Paragraph("Engineering Recommendations", styles["h2"]))
        for i, rec in enumerate(recommendations, 1):
            story.append(Paragraph(f"<b><font color='#f87171'>{i}.</font></b>  {rec}", styles["rec"]))
        story.append(Spacer(1, 4 * mm))

    # ---- Sign-off ----
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "Generated by the Racing Bulls F1 Performance Intelligence Platform. "
        "Data sources: Kafka telemetry stream · Snowflake warehouse · dbt materialised models. "
        "Query latency target &lt; 2s on 5-year history.",
        styles["small"]
    ))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title=f"RB Performance Report — R{session.get('round', '?')} {circuit.get('name', '')} {session.get('type', '')}",
        author="Racing Bulls Performance Engineering",
        subject="F1 telemetry analysis report",
        creator="RB-F1-IP v2.4.1",
    )
    doc.build(story, onFirstPage=first_page, onLaterPages=later_page)
    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    build_report(payload)
