"""
generate_receipt_pdf.py
Pure-ReportLab PDF generator for payment receipts.
Uses Nirmala UI (pre-installed on Windows) for correct Bengali ৳ rendering.
"""
import os
import re
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

TK = '৳'  # Bengali Taka — supported directly by Nirmala UI font


def _register_nirmala():
    """Register Nirmala UI (Bengali-capable font) with ReportLab."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    for fp in [r'C:\Windows\Fonts\Nirmala.ttc', r'C:\Windows\Fonts\Nirmala.ttf']:
        if os.path.exists(fp):
            try:
                pdfmetrics.registerFont(TTFont('Nirmala', fp, subfontIndex=0))
                try:
                    pdfmetrics.registerFont(TTFont('NirmalaBold', fp, subfontIndex=1))
                except Exception:
                    pdfmetrics.registerFont(TTFont('NirmalaBold', fp, subfontIndex=0))
                return 'Nirmala', 'NirmalaBold'
            except Exception as e:
                logger.warning(f"Nirmala font registration failed: {e}")
    return 'Helvetica', 'Helvetica-Bold'


def generate_receipt_pdf_reportlab(payment_data):
    """
    Build a styled, single-page A4 PDF receipt matching the frontend design.
    Uses ReportLab Platypus for layout. Bengali ৳ renders correctly.
    Returns bytes of the PDF.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer,
        Table, TableStyle, HRFlowable, Flowable
    )

    class BuildingIcon(Flowable):
        def __init__(self, color, size=45):
            Flowable.__init__(self)
            self.color = color
            self.size = size
            self.width = size
            self.height = size
        def draw(self):
            # teal_bg (light teal) and building (teal) match the modal
            bg_color = colors.HexColor("#F0FDFA")
            build_color = self.color # Brand teal
            
            self.canv.saveState()
            # Draw circular background
            self.canv.setFillColor(bg_color)
            self.canv.circle(self.size/2.0, self.size/2.0, self.size/2.0, fill=1, stroke=0)
            
            # Draw building in brand teal
            self.canv.setFillColor(build_color)
            s = self.size * 0.55
            offset = (self.size - s) / 2.0
            self.canv.translate(offset, offset)
            
            self.canv.rect(s*0.35, 0, s*0.3, s*0.95, fill=1, stroke=0) # main
            self.canv.rect(s*0.2, 0, s*0.15, s*0.7, fill=1, stroke=0) # left wing
            self.canv.rect(s*0.65, 0, s*0.15, s*0.7, fill=1, stroke=0) # right wing
            
            # Windows in light teal (matching the background circle)
            self.canv.setFillColor(bg_color)
            for y in range(2, 9, 2):
                self.canv.rect(s*0.42, s*y*0.1, s*0.06, s*0.06, fill=1, stroke=0)
                self.canv.rect(s*0.52, s*y*0.1, s*0.06, s*0.06, fill=1, stroke=0)
            self.canv.restoreState()

    class PillBadge(Flowable):
        def __init__(self, text, bg_color, fg_color, font_name, width=45, height=15):
            Flowable.__init__(self)
            self.text = text
            self.bg_color = bg_color
            self.fg_color = fg_color
            self.font_name = font_name
            self.width = width
            self.height = height
        def draw(self):
            # Draw a pill-shaped badge using direct canvas commands
            self.canv.saveState()
            self.canv.setFillColor(self.bg_color)
            r = self.height / 2.0
            self.canv.roundRect(0, 0, self.width, self.height, r, fill=1, stroke=0)
            self.canv.setFillColor(self.fg_color)
            self.canv.setFont(self.font_name, 7.5)
            # Center text vertically and horizontally
            self.canv.drawCentredString(self.width/2.0, (self.height - 7.5)/2.0 + 1, self.text)
            self.canv.restoreState()

    font_r, font_b = _register_nirmala()

    # ── Utility helpers ────────────────────────────────────────────────────
    def ps(name, font=None, size=8, color=None, bold=False, align='LEFT', leading=None):
        f = (font_b if bold else font_r) if font is None else font
        clr = color or colors.HexColor('#1F2937')
        return ParagraphStyle(
            name, fontName=f, fontSize=size, textColor=clr,
            alignment={'LEFT': 0, 'CENTER': 1, 'RIGHT': 2}[align],
            leading=leading or (size * 1.35),
            wordWrap='CJK'
        )

    def p(text, **kwargs):
        return Paragraph(str(text), ps('x', **kwargs))

    def safe_float(v):
        try:
            return float(str(v))
        except Exception:
            return 0.0

    from datetime import datetime

    MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']

    def fmt_money(v, prefix=True):
        f = safe_float(v)
        s = f'{int(f):,}' if f == int(f) else f'{f:,.2f}'
        return f'{TK}{s}' if prefix else s

    # ── Colours ────────────────────────────────────────────────────────────
    C = {
        'dark':    colors.HexColor('#111827'),
        'gray':    colors.HexColor('#6B7280'),
        'teal':    colors.HexColor('#3D9D9B'),
        'green':   colors.HexColor('#059669'),
        'red':     colors.HexColor('#EF4444'),
        'purple':  colors.HexColor('#7C3AED'),
        'blue_fg': colors.HexColor('#1E40AF'),
        'blue_bg': colors.HexColor('#EFF6FF'),
        'meta_bg': colors.HexColor('#F9FAFB'),
        'lim_bg':  colors.HexColor('#ECFDF5'),
        'lim_br':  colors.HexColor('#A7F3D0'),
        'border':  colors.HexColor('#E5E7EB'),
        'row_sep': colors.HexColor('#F3F4F6'),
        'hdr_bg':  colors.HexColor('#F8FAFC'),
        'sum_bg':  colors.HexColor('#F9FAFB'),
        'paid_bg': colors.HexColor('#D1FAE5'),
        'paid_fg': colors.HexColor('#047857'),
        'part_bg': colors.HexColor('#FEF3C7'),
        'part_fg': colors.HexColor('#B45309'),
    }

    # ── Extract payment values ─────────────────────────────────────────────
    receipt_no  = payment_data.get('receipt_id') or 'N/A'
    txn_id      = payment_data.get('transaction_id', 'N/A')
    pay_date_raw = payment_data.get('payment_date', '')
    try:
        from datetime import date
        if isinstance(pay_date_raw, str) and pay_date_raw:
            d = date.fromisoformat(pay_date_raw[:10])
            pay_date = d.strftime('%d-%b-%Y')
        else:
            pay_date = str(pay_date_raw) or 'N/A'
    except Exception:
        pay_date = str(pay_date_raw)

    method   = payment_data.get('payment_method_display') or 'N/A'
    frm_acc  = 'N/A'
    to_acc   = 'N/A'
    parsed_pd = payment_data.get('parsed_payment_details', [])
    if parsed_pd:
        pd = parsed_pd[0]
        if pd.get('payment_method'): method = pd.get('payment_method')
        notes_s = pd.get('notes', '')
        if 'From:' in notes_s:
            parts = notes_s.split('From:')
            if len(parts) > 1:
                frm_acc = parts[1].split(',')[0].split('-')[0].strip()
        if pd.get('to_account_number'): to_acc = pd.get('to_account_number')

    tower    = payment_data.get('tower_name', 'N/A')
    res_name = (payment_data.get('primary_name') or payment_data.get('resident_name') or 'N/A')
    phone    = (payment_data.get('phone') or payment_data.get('owner_phone') or payment_data.get('resident_number') or 'N/A')
    unit     = (payment_data.get('unit_display') or payment_data.get('unit_number') or 'N/A')
    email    = (payment_data.get('email') or payment_data.get('owner_email') or payment_data.get('resident_email') or 'N/A')
    notes    = (payment_data.get('notes') or
                f"Service fee payment for {tower} - {unit}.")
    rec_by   = payment_data.get('created_by_name', 'System')
    rec_at   = datetime.now().strftime('%d/%m/%Y, %I:%M:%S %p')

    total_val   = safe_float(payment_data.get('total_amount') or 0)
    advance_val = safe_float(payment_data.get('advance_amount') or 0)
    subtotal    = total_val - advance_val
    allocs      = payment_data.get('payment_details') or []

    # ── Build document ─────────────────────────────────────────────────────
    buf = BytesIO()
    W, _ = A4
    PW = W - 24*mm  # printable width

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=12*mm, rightMargin=12*mm,
        topMargin=10*mm, bottomMargin=10*mm
    )
    story = []

    # ── Header ─────────────────────────────────────────────────────────────
    # Company Icon
    icon_tbl = Table([[BuildingIcon(C['teal'], size=40)]], colWidths=[PW])
    icon_tbl.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER')]))
    story.append(icon_tbl)
    story.append(Spacer(1, 1*mm))

    story.append(p('Estate Link', size=17, bold=True, align='CENTER', color=C['dark']))
    story.append(p('Property Management Services', size=9, color=C['gray'], align='CENTER'))
    story.append(Spacer(1, 4*mm))

    badge_inner = Table(
        [[p('✓  PAYMENT RECEIVED', size=8, bold=True, color=C['green'], align='CENTER')]],
        colWidths=[56*mm]
    )
    badge_inner.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), C['lim_bg']),
        ('BOX',           (0,0),(-1,-1), 0.7, C['lim_br']),
        ('TOPPADDING',    (0,0),(-1,-1), 4),
        ('BOTTOMPADDING', (0,0),(-1,-1), 4),
        ('ALIGN',         (0,0),(-1,-1), 'CENTER'),
    ]))
    badge_wrap = Table([[badge_inner]], colWidths=[PW])
    badge_wrap.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER')]))
    story.append(badge_wrap)
    story.append(Spacer(1, 4*mm))

    # ── Meta bar ───────────────────────────────────────────────────────────
    def lv(label, value):
        return (label, value)

    def meta_section(data_tuples, col_widths):
        # Build exactly one row with N columns
        row = []
        for label, val in data_tuples:
            row.append([p(label, size=7, color=C['gray'], bold=True),
                        p(val or 'N/A', size=9, bold=True)])
        tbl = Table([row], colWidths=col_widths)
        tbl.setStyle(TableStyle([
            ('TOPPADDING',    (0,0),(-1,-1), 2),
            ('BOTTOMPADDING', (0,0),(-1,-1), 2),
            ('VALIGN',        (0,0),(-1,-1), 'TOP'),
            ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ]))
        return tbl

    # Create the meta bar with 3 columns across
    row1 = meta_section([lv('RECEIPT NUMBER', receipt_no),
                          lv('TRANSACTION ID', txn_id),
                          lv('PAYMENT DATE', pay_date)],
                         [PW/3, PW/3, PW/3])
    row2 = meta_section([lv('METHOD', method),
                          lv('FROM ACCOUNT', frm_acc),
                          lv('TO ACCOUNT', to_acc)],
                         [PW/3, PW/3, PW/3])

    meta_tbl = Table(
        [[row1], [p('', size=0.5)], [row2]],
        colWidths=[PW]
    )
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), C['meta_bg']),
        ('BOX',           (0,0),(-1,-1), 0.6, C['border']),
        ('ROUNDEDCORNERS',[8, 8, 8, 8]),
        ('LINEBELOW',     (0,0),(0,0),   0.5, C['border']),
        ('TOPPADDING',    (0,0),(-1,-1), 8),
        ('BOTTOMPADDING', (0,0),(-1,-1), 8),
        ('LEFTPADDING',   (0,0),(-1,-1), 10),
        ('RIGHTPADDING',  (0,0),(-1,-1), 10),
        ('TOPPADDING',    (0,1),(0,1),   1),
        ('BOTTOMPADDING', (0,1),(0,1),   1),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Resident info ──────────────────────────────────────────────────────
    def info_pair(label, value):
        return p(f'<font color="#6B7280" size="7">{label}</font><br/><b>{value or "N/A"}</b>',
                 size=9)

    left_items  = [info_pair('Tower', tower), info_pair('Resident Name', res_name), info_pair('Phone', phone)]
    right_items = [info_pair('Unit Number', unit), info_pair('Email', email)]

    max_r = max(len(left_items), len(right_items))
    while len(left_items)  < max_r: left_items.append(Paragraph('', ps('e')))
    while len(right_items) < max_r: right_items.append(Paragraph('', ps('e')))

    res_inner = Table([[l, r] for l, r in zip(left_items, right_items)],
                       colWidths=[PW/2, PW/2])
    res_inner.setStyle(TableStyle([
        ('TOPPADDING',    (0,0),(-1,-1), 3),
        ('BOTTOMPADDING', (0,0),(-1,-1), 3),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
    ]))

    res_tbl = Table(
        [[p('Resident Information', size=9, bold=True)], [res_inner]],
        colWidths=[PW]
    )
    res_tbl.setStyle(TableStyle([
        ('BOX',          (0,0),(-1,-1), 0.6, C['border']),
        ('ROUNDEDCORNERS',[8, 8, 8, 8]),
        ('LINEBELOW',    (0,0),(0,0),   0.5, C['row_sep']),
        ('TOPPADDING',   (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
        ('LEFTPADDING',  (0,0),(-1,-1), 8),
        ('RIGHTPADDING', (0,0),(-1,-1), 8),
    ]))
    story.append(res_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Payment allocation table ───────────────────────────────────────────
    def th(text, align='LEFT'):
        return p(text, size=6.5, color=C['gray'], bold=True, align=align)

    def td(text, align='LEFT', color=None, bold=False, size=8.5):
        return p(str(text), size=size, align=align, color=color, bold=bold)

    def make_badge(text, bg_color, fg_color, width):
        # Use custom Flowable for guaranteed pill shape
        return PillBadge(text, bg_color, fg_color, font_b, width=width)

    cw = [PW*f for f in [0.22, 0.15, 0.17, 0.13, 0.16, 0.17]]

    hdr_row = [th('BILL MONTH'), th('BILL AMOUNT', 'RIGHT'), th('GROSS PENALTY', 'RIGHT'),
               th('WAIVED', 'RIGHT'), th('PAID', 'RIGHT'), th('STATUS', 'CENTER')]

    data_rows = [hdr_row]
    badge_colors = []  # list of (row_idx, bg, fg)

    if allocs:
        for alloc in allocs:
            m = alloc.get('service_period_month')
            y = alloc.get('service_period_year')
            month_txt = f"{MONTH_NAMES[int(m)]} {y}" if m and y else alloc.get('month_name', 'N/A')
            amt   = safe_float(alloc.get('amount') or 0)
            pen   = safe_float(alloc.get('gross_penalty_amount') or alloc.get('penalty_amount') or 0)
            wav   = safe_float(alloc.get('waived_amount') or alloc.get('waived') or 0)
            stat  = str(alloc.get('service_status') or alloc.get('status') or 'N/A')

            is_paid = stat.lower() == 'paid'
            sbg = C['paid_bg'] if is_paid else C['part_bg']
            sfg = C['paid_fg'] if is_paid else C['part_fg']
            badge_colors.append((len(data_rows), sbg, sfg))

            pen_txt  = fmt_money(pen) if pen > 0 else '-'
            wav_txt  = fmt_money(wav) if wav > 0 else '-'

            data_rows.append([
                td(f'<b>{month_txt}</b>', bold=True),
                td(fmt_money(amt), 'RIGHT'),
                td(pen_txt, 'RIGHT', color=C['red']),
                td(wav_txt, 'RIGHT', color=C['green']),
                td(fmt_money(amt), 'RIGHT', color=C['teal'], bold=True),
                make_badge(stat.upper(), sbg, sfg, cw[5] * 0.7),
            ])
    else:
        m = payment_data.get('service_period_month')
        y = payment_data.get('service_period_year')
        month_txt = f"{MONTH_NAMES[int(m)]} {y}" if m and y else 'N/A'
        badge_colors.append((1, C['meta_bg'], C['gray']))
        data_rows.append([
            td(f'<b>{month_txt}</b>', bold=True),
            td(fmt_money(total_val), 'RIGHT'),
            td('-', 'RIGHT'), td('-', 'RIGHT'),
            td(fmt_money(total_val), 'RIGHT', color=C['teal'], bold=True),
            make_badge('-', C['meta_bg'], C['gray'], cw[5] * 0.7),
        ])

    pay_tbl = Table(data_rows, colWidths=cw, repeatRows=1)
    pay_ts = [
        ('BACKGROUND',    (0,0),(-1,0),   C['hdr_bg']),
        ('LINEBELOW',     (0,0),(-1,0),   0.6, colors.HexColor('#E2E8F0')),
        ('LINEBELOW',     (0,1),(-1,-1),  0.3, C['row_sep']),
        ('TOPPADDING',    (0,1),(-1,-1),  9),
        ('BOTTOMPADDING', (0,1),(-1,-1),  9),
        ('VALIGN',        (0,0),(-1,-1),  'MIDDLE'),
        ('ALIGN',         (5,0),(5,-1),   'CENTER'),
        ('LEFTPADDING',   (0,0),(0,-1),   0),
        ('RIGHTPADDING',  (-1,0),(-1,-1), 0),
    ]
    # for ri, sbg, sfg in badge_colors:
    #     pay_ts.append(('BACKGROUND', (-1,ri), (-1,ri), sbg))
    pay_tbl.setStyle(TableStyle(pay_ts))

    # Summary
    has_adv = advance_val > 0
    sum_rows = [
        [td('Subtotal (Bills Payment)', color=C['gray']),
         td(fmt_money(subtotal), 'RIGHT', bold=True)],
    ]
    if has_adv:
        sum_rows.append([
            td('Advance Payment (Future Bills)', color=C['purple'], bold=True),
            td(fmt_money(advance_val), 'RIGHT', color=C['purple'], bold=True),
        ])
    sum_rows.append([Paragraph('', ps('sp')), Paragraph('', ps('sp2'))])  # separator slot
    sum_rows.append([
        td('Total Amount Paid', size=11, bold=True),
        td(fmt_money(total_val), 'RIGHT', color=C['teal'], bold=True, size=14),
    ])

    sep_idx = len(sum_rows) - 2
    # Fix 'outside text' by ensuring inner table fits inside parent padding (8+8=16 units)
    inner_pw = PW - 16
    sum_tbl = Table(sum_rows, colWidths=[inner_pw*0.7, inner_pw*0.3])
    sum_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), C['sum_bg']),
        ('TOPPADDING',    (0,0),(-1,-1), 4),
        ('BOTTOMPADDING', (0,0),(-1,-1), 4),
        ('LINEABOVE',     (0,sep_idx+1),(1,sep_idx+1), 1.5, C['border'], 0, (3, 3)),
        ('ROWBACKGROUNDS',(0,sep_idx),(1,sep_idx), [C['sum_bg']]),
    ]))

    alloc_tbl = Table(
        [[p('Payment Allocation', size=9, bold=True)],
         [pay_tbl],
         [sum_tbl]],
        colWidths=[PW]
    )
    alloc_tbl.setStyle(TableStyle([
        ('BOX',           (0,0),(-1,-1), 0.6, C['border']),
        ('ROUNDEDCORNERS',[8, 8, 8, 8]),
        ('LINEBELOW',     (0,0),(0,0),   0.5, C['row_sep']),
        ('TOPPADDING',    (0,0),(0,0),   6),
        ('BOTTOMPADDING', (0,0),(0,0),   5),
        ('TOPPADDING',    (0,1),(-1,-1), 4),
        ('BOTTOMPADDING', (0,1),(-1,-1), 4),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
    ]))
    story.append(alloc_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Notes ──────────────────────────────────────────────────────────────
    note_tbl = Table(
        [[p('NOTES', size=7, color=C['blue_fg'], bold=True)],
         [p(notes or 'N/A', size=8.5, color=C['blue_fg'])]],
        colWidths=[PW]
    )
    note_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), C['blue_bg']),
        ('BOX',           (0,0),(-1,-1), 0.6, C['blue_bg']),
        ('ROUNDEDCORNERS',[6, 6, 6, 6]),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
    ]))
    story.append(note_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Footer ─────────────────────────────────────────────────────────────
    foot_tbl = Table([[
        p(f'Recorded By: <b>{rec_by}</b>', size=7.5, color=C['gray']),
        p(f'Recorded At: <b>{rec_at}</b>', size=7.5, color=C['gray'], align='RIGHT'),
    ]], colWidths=[PW*0.5, PW*0.5])
    foot_tbl.setStyle(TableStyle([
        ('LINEABOVE',     (0,0),(-1,0), 0.5, C['border']),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 10), # extra padding at bottom
    ]))
    story.append(foot_tbl)

    doc.build(story)
    return buf.getvalue()
