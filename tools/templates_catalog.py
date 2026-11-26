"""Catálogo estendido de templates comerciais offline para Pocket Studio.

Cada layout retorna um documento `pp-editor` v1 compatível com Fabric 7.4.0
(origem central padrão) usando apenas as fontes empacotadas OFL e papéis do BrandKit.
"""
import math


# ---------------- primitivos Fabric 7 (origem padrão = centro) ----------------

def rect(cx, cy, w, h, fill, role=None, rx=0, **kw):
    o = {'type': 'Rect', 'left': cx, 'top': cy, 'width': w, 'height': h, 'fill': fill, 'rx': rx, 'ry': rx}
    if role:
        o['brandColor'] = role
    o.update(kw)
    return o


def circle(cx, cy, r, fill, role=None, **kw):
    o = {'type': 'Circle', 'left': cx, 'top': cy, 'radius': r, 'fill': fill}
    if role:
        o['brandColor'] = role
    o.update(kw)
    return o


def text(cx, cy, w, s, size, font, fill='#222222', weight=400, role=None, font_role=None, align='center', **kw):
    o = {
        'type': 'Textbox', 'left': cx, 'top': cy, 'width': w, 'text': s,
        'fontSize': size, 'fontFamily': font, 'fontWeight': weight,
        'fill': fill, 'textAlign': align, 'lineHeight': 1.15,
    }
    if role:
        o['brandColor'] = role
    if font_role:
        o['brandFont'] = font_role
    o.update(kw)
    return o


def star_points(n, outer, inner):
    pts = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = math.pi * i / n - math.pi / 2
        pts.append({'x': round(r * math.cos(a), 2), 'y': round(r * math.sin(a), 2)})
    return pts


def diamond_points(rx, ry):
    return [{'x': 0, 'y': -ry}, {'x': rx, 'y': 0}, {'x': 0, 'y': ry}, {'x': -rx, 'y': 0}]


def hex_points(r):
    return [{'x': round(r * math.cos(math.pi / 3 * i), 2), 'y': round(r * math.sin(math.pi / 3 * i), 2)} for i in range(6)]


def polygon(cx, cy, points, fill, role=None, **kw):
    o = {'type': 'Polygon', 'left': cx, 'top': cy, 'points': points, 'fill': fill}
    if role:
        o['brandColor'] = role
    o.update(kw)
    return o


def doc(name, w, h, background, objects, brand_background='background'):
    fabric = {'version': '7.4.0', 'background': background, 'objects': objects}
    if brand_background:
        fabric['brandBackground'] = brand_background
    return {'format': 'pp-editor', 'version': 1, 'name': name, 'width': w, 'height': h, 'fabric': fabric}


# ---------------- arquétipos de layout ----------------

def layout_impact_offer(
    name, w, h, bg, primary, accent, text_fg, on_primary,
    eyebrow, headline, subline, badge, cta, footer='{{company}} · {{phone}}',
    head_font='Anton', body_font='Montserrat', dark_canvas=False,
):
    cx = w / 2
    slot_y = h * 0.56 if h > w else h * 0.55
    slot_size = min(w * 0.54, h * 0.36)
    objs = [
        rect(cx, h * 0.17, w, h * 0.34, primary, 'primary'),
        circle(w * 0.88, h * 0.08, w * 0.16, '#ffffff', opacity=0.08),
        rect(cx, h * 0.09, w * 0.44, 54, accent, 'accent', rx=27),
        text(cx, h * 0.09, w * 0.40, eyebrow, 28, body_font, '#111827', 800, font_role='heading', charSpacing=60),
        text(cx, h * 0.21, w * 0.86, headline, 118 if len(headline) <= 14 else 92, head_font, on_primary, 400, font_role='heading'),
        text(cx, h * 0.30, w * 0.84, subline, 36, body_font, on_primary, 500, font_role='body'),
        rect(cx, slot_y, slot_size + 40, slot_size + 40, '#ffffff' if not dark_canvas else '#1f2937', rx=36,
             stroke=primary, brandStroke='primary', strokeWidth=4),
        text(cx, slot_y, slot_size - 40, 'Toque em Imagem\npara inserir foto', 34, body_font,
             '#64748b' if not dark_canvas else '#9ca3af', 500, font_role='body'),
        polygon(w * 0.82, slot_y - slot_size * 0.42, star_points(14, 108, 86), accent, 'accent'),
        text(w * 0.82, slot_y - slot_size * 0.42, 160, badge, 42, head_font, '#111827', 700, font_role='heading'),
        rect(cx, h * 0.84, w * 0.62, 104, primary, 'primary', rx=52),
        text(cx, h * 0.84, w * 0.56, cta, 42, body_font, on_primary, 800, font_role='heading'),
        text(cx, h * 0.93, w * 0.86, footer, 30, body_font, text_fg, 500, role=None if dark_canvas else 'text', font_role='body'),
    ]
    return doc(name, w, h, bg, objs, None if dark_canvas else 'background')


def layout_coupon_frame(
    name, bg, card_bg, primary, accent, text_fg,
    title, code, discount, conditions, cta, body_font='Montserrat', head_font='Bebas Neue',
):
    objs = [
        rect(540, 540, 960, 960, card_bg, rx=36, stroke=primary, brandStroke='primary', strokeWidth=6, strokeDashArray=[22, 14]),
        circle(60, 540, 42, bg),
        circle(1020, 540, 42, bg),
        text(540, 175, 800, title, 40, body_font, primary, 800, role='primary', font_role='heading', charSpacing=100),
        text(540, 325, 840, discount, 154, head_font, text_fg, 400, role='text', font_role='heading'),
        text(540, 455, 760, conditions, 38, body_font, text_fg, 500, font_role='body'),
        rect(540, 605, 620, 144, accent, 'accent', rx=24, stroke=text_fg, strokeWidth=3, strokeDashArray=[14, 10]),
        text(540, 605, 580, code, 68, 'Anton', '#111827', 400, font_role='heading', charSpacing=90),
        rect(540, 795, 540, 96, primary, 'primary', rx=48),
        text(540, 795, 500, cta, 38, body_font, '#ffffff', 800, font_role='heading'),
        text(540, 920, 820, '{{company}}  ·  {{website}}', 32, body_font, text_fg, 600, role='text', font_role='body'),
    ]
    return doc(name, 1080, 1080, bg, objs)


def layout_diagonal_promo(
    name, w, h, bg, primary, accent, on_primary,
    tag, big1, big2, desc, cta, head_font='Anton', body_font='Montserrat',
):
    cx = w / 2
    objs = [
        rect(cx, h * 0.25, w * 1.4, h * 0.56, primary, 'primary', angle=-10),
        rect(w * 0.28, h * 0.11, 340, 56, accent, 'accent', rx=28),
        text(w * 0.28, h * 0.11, 310, tag, 28, body_font, '#111827', 800, font_role='heading', charSpacing=50),
        text(cx, h * 0.24, w * 0.88, big1, 128, head_font, on_primary, 400, font_role='heading'),
        text(cx, h * 0.36, w * 0.88, big2, 74, head_font, accent, 400, role='accent', font_role='heading'),
        rect(cx, h * 0.63, w * 0.72, h * 0.25, '#ffffff', rx=32, opacity=0.10, stroke=accent, brandStroke='accent', strokeWidth=3),
        text(cx, h * 0.63, w * 0.64, desc, 40, body_font, '#f8fafc', 600, font_role='body'),
        rect(cx, h * 0.84, w * 0.58, 106, accent, 'accent', rx=53),
        text(cx, h * 0.84, w * 0.52, cta, 42, body_font, '#111827', 800, font_role='heading'),
        text(cx, h * 0.94, w * 0.86, '{{company}} · {{website}}', 30, body_font, '#cbd5e1', 500, font_role='body'),
    ]
    return doc(name, w, h, bg, objs, brand_background=None)


def layout_editorial_showcase(
    name, w, h, bg, card_bg, primary, secondary, text_fg,
    eyebrow, title, subtitle, detail, badge_label, head_font='Playfair Display', body_font='Raleway',
):
    cx = w / 2
    img_y = h * 0.49
    img_w = w * 0.68
    img_h = h * 0.42
    objs = [
        rect(cx, h / 2, w - 72, h - 72, card_bg, rx=28, stroke=secondary, brandStroke='secondary', strokeWidth=3),
        text(cx, h * 0.10, w * 0.78, eyebrow, 28, body_font, primary, 700, role='primary', font_role='body', charSpacing=140),
        text(cx, h * 0.18, w * 0.80, title, 78, head_font, text_fg, 800, role='text', font_role='heading'),
        rect(cx, h * 0.245, 140, 4, primary, 'primary'),
        rect(cx, img_y, img_w, img_h, bg, rx=28, stroke=primary, brandStroke='primary', strokeWidth=2),
        text(cx, img_y, img_w - 60, 'Toque em Imagem para\npor a foto do produto', 34, body_font, secondary, 500, font_role='body'),
        rect(w * 0.74, img_y - img_h * 0.42, 230, 60, primary, 'primary', rx=30),
        text(w * 0.74, img_y - img_h * 0.42, 210, badge_label, 26, body_font, '#ffffff', 700, font_role='heading'),
        text(cx, h * 0.77, w * 0.78, subtitle, 42, head_font, text_fg, 700, role='text', font_role='heading'),
        text(cx, h * 0.84, w * 0.76, detail, 32, body_font, text_fg, 500, font_role='body'),
        text(cx, h * 0.915, w * 0.78, '{{company}}  ·  {{website}}', 28, body_font, primary, 700, role='primary', font_role='body'),
    ]
    return doc(name, w, h, bg, objs)


def layout_bento_product(
    name, bg, panel_bg, primary, accent, text_fg,
    eyebrow, title, bullets, price_tag, cta, head_font='Montserrat', body_font='Inter', dark_canvas=False,
):
    objs = [
        text(540, 95, 920, eyebrow, 28, body_font, primary, 800, role='primary', font_role='body', align='left', charSpacing=90),
        text(540, 165, 920, title, 72, head_font, text_fg, 800, role=None if dark_canvas else 'text', font_role='heading', align='left'),
        rect(305, 535, 450, 560, panel_bg, rx=32, stroke=primary, brandStroke='primary', strokeWidth=3),
        text(305, 535, 360, 'Produto\nem destaque', 36, body_font, '#94a3b8' if dark_canvas else '#64748b', 600, font_role='body'),
        rect(795, 345, 450, 170, panel_bg, rx=24),
        text(795, 345, 390, bullets[0], 34, body_font, text_fg, 700, font_role='body'),
        rect(795, 535, 450, 170, panel_bg, rx=24),
        text(795, 535, 390, bullets[1], 34, body_font, text_fg, 700, font_role='body'),
        rect(795, 725, 450, 170, accent, 'accent', rx=24),
        text(795, 725, 390, price_tag, 46, head_font, '#111827', 800, font_role='heading'),
        rect(305, 910, 450, 108, primary, 'primary', rx=54),
        text(305, 910, 400, cta, 38, head_font, '#ffffff', 800, font_role='heading'),
        text(795, 910, 450, '{{company}}\n{{phone}}', 28, body_font, text_fg, 600, font_role='body'),
    ]
    return doc(name, 1080, 1080, bg, objs, None if dark_canvas else 'background')


def layout_split_compare(
    name, bg, primary, accent, text_fg,
    eyebrow, left_title, left_items, right_title, right_items, cta,
    head_font='Oswald', body_font='Open Sans',
):
    objs = [
        rect(540, 130, 1080, 260, primary, 'primary'),
        text(540, 130, 940, eyebrow, 72, head_font, '#ffffff', 700, font_role='heading', charSpacing=40),
        rect(290, 560, 440, 510, '#fff1f2', rx=28, stroke='#ef4444', strokeWidth=3),
        text(290, 370, 380, left_title, 44, head_font, '#dc2626', 700, font_role='heading'),
        text(290, 575, 380, left_items, 36, body_font, '#334155', 600, font_role='body', align='left'),
        rect(790, 560, 440, 510, '#ecfdf5', rx=28, stroke=accent, brandStroke='accent', strokeWidth=4),
        text(790, 370, 380, right_title, 44, head_font, '#059669', 700, font_role='heading'),
        text(790, 575, 380, right_items, 36, body_font, '#0f172a', 600, font_role='body', align='left'),
        rect(540, 915, 760, 96, primary, 'primary', rx=48),
        text(540, 915, 700, cta, 40, head_font, '#ffffff', 700, font_role='heading'),
        text(540, 1015, 900, '{{company}}  ·  {{website}}', 30, body_font, text_fg, 600, role='text', font_role='body'),
    ]
    return doc(name, 1080, 1080, bg, objs)


def layout_menu_board(
    name, w, h, bg, header_bg, primary, secondary, text_fg,
    title, subtitle, rows, footer='{{address}}  ·  {{phone}}',
    head_font='Playfair Display', body_font='Raleway', dark_canvas=False,
):
    cx = w / 2
    objs = [
        rect(cx, h * 0.11, w, h * 0.22, header_bg, 'primary'),
        text(cx, h * 0.09, w * 0.88, title, 108 if w >= 1200 else 92, head_font, '#ffffff', 800, font_role='heading'),
        text(cx, h * 0.165, w * 0.88, subtitle, 40, body_font, secondary, 600, font_role='body'),
    ]
    start_y = h * 0.295
    step_y = (h * 0.56) / max(1, len(rows))
    for item_name, price in rows:
        objs.append(text(w * 0.37, start_y, w * 0.55, item_name, 46, body_font, text_fg, 600, role=None if dark_canvas else 'text', font_role='body', align='left'))
        objs.append(text(w * 0.81, start_y, w * 0.24, price, 46, body_font, primary, 800, role='primary', font_role='heading', align='right'))
        objs.append(rect(cx, start_y + step_y * 0.42, w * 0.82, 2, secondary, opacity=0.45))
        start_y += step_y
    objs.append(rect(cx, h * 0.90, w * 0.72, 82, header_bg, 'primary', rx=41))
    objs.append(text(cx, h * 0.90, w * 0.68, footer, 32, body_font, '#ffffff', 600, font_role='body'))
    return doc(name, w, h, bg, objs, None if dark_canvas else 'background')


def layout_story_spotlight(
    name, bg, primary, accent, text_fg,
    badge, headline, subline, cta, dark_canvas=True,
    head_font='Anton', body_font='Montserrat',
):
    objs = [
        circle(540, 880, 440, primary, 'primary', opacity=0.22),
        circle(540, 880, 360, accent, 'accent', opacity=0.14),
        rect(540, 180, 460, 68, accent, 'accent', rx=34),
        text(540, 180, 420, badge, 30, body_font, '#111827', 800, font_role='heading', charSpacing=70),
        text(540, 320, 920, headline, 114, head_font, text_fg, 400, font_role='heading'),
        text(540, 450, 860, subline, 44, body_font, text_fg, 500, font_role='body', opacity=0.88),
        rect(540, 930, 740, 740, '#ffffff' if not dark_canvas else '#1e293b', rx=44,
             stroke=accent, brandStroke='accent', strokeWidth=4),
        text(540, 930, 620, 'Toque em Imagem para\ninserir a foto aqui', 42, body_font, '#94a3b8', 500, font_role='body'),
        rect(540, 1520, 680, 130, primary, 'primary', rx=65),
        text(540, 1520, 620, cta, 52, body_font, '#ffffff', 800, font_role='heading'),
        text(540, 1730, 900, '{{company}}  ·  {{phone}}', 36, body_font, text_fg, 600, font_role='body'),
    ]
    return doc(name, 1080, 1920, bg, objs, None if dark_canvas else 'background')


def layout_story_interactive(
    name, bg, primary, accent, card_bg, text_fg,
    eyebrow, headline, box_a, box_b, footer, head_font='Montserrat', body_font='Nunito',
):
    objs = [
        rect(540, 160, 440, 64, accent, 'accent', rx=32),
        text(540, 160, 400, eyebrow, 28, body_font, '#111827', 800, font_role='heading', charSpacing=80),
        text(540, 360, 900, headline, 94, head_font, '#ffffff', 800, font_role='heading'),
        rect(540, 740, 860, 290, card_bg, rx=36, stroke=accent, brandStroke='accent', strokeWidth=4),
        text(540, 740, 760, box_a, 54, body_font, text_fg, 800, font_role='body'),
        rect(540, 1110, 860, 290, card_bg, rx=36, stroke=primary, brandStroke='primary', strokeWidth=4),
        text(540, 1110, 760, box_b, 54, body_font, text_fg, 800, font_role='body'),
        rect(540, 1510, 680, 110, accent, 'accent', rx=55),
        text(540, 1510, 620, footer, 40, head_font, '#111827', 800, font_role='heading'),
        text(540, 1730, 900, '{{company}}  ·  {{website}}', 34, body_font, '#e2e8f0', 600, font_role='body'),
    ]
    return doc(name, 1080, 1920, bg, objs, brand_background=None)


def layout_story_steps(
    name, bg, card_bg, primary, accent, text_fg,
    title, subtitle, steps, cta, head_font='Playfair Display', body_font='Inter',
):
    objs = [
        text(540, 220, 900, title, 98, head_font, text_fg, 800, role='text', font_role='heading'),
        text(540, 345, 840, subtitle, 42, body_font, primary, 600, role='primary', font_role='body'),
    ]
    y = 590
    for idx, (st_title, st_desc) in enumerate(steps, start=1):
        objs.append(rect(540, y, 880, 250, card_bg, rx=32))
        objs.append(circle(200, y, 64, primary if idx != 2 else accent, 'primary' if idx != 2 else 'accent'))
        objs.append(text(200, y, 100, f'0{idx}', 46, 'Anton', '#ffffff' if idx != 2 else '#111827', 400, font_role='heading'))
        objs.append(text(590, y - 34, 580, st_title, 42, head_font, text_fg, 700, font_role='heading', align='left'))
        objs.append(text(590, y + 36, 580, st_desc, 34, body_font, text_fg, 400, font_role='body', align='left'))
        y += 300
    objs.append(rect(540, 1540, 680, 120, primary, 'primary', rx=60))
    objs.append(text(540, 1540, 620, cta, 44, body_font, '#ffffff', 800, font_role='heading'))
    objs.append(text(540, 1740, 900, '{{company}}  ·  {{phone}}', 34, body_font, text_fg, 600, role='text', font_role='body'))
    return doc(name, 1080, 1920, bg, objs)


def layout_reels_cover(
    name, bg, primary, accent,
    top_pill, center_title, sub_note, head_font='Anton', body_font='Montserrat',
):
    # Zona segura central 4:5 (entre y=420 e y=1500) para aparecer inteira no feed e nos Reels
    objs = [
        circle(920, 260, 240, primary, 'primary', opacity=0.30),
        circle(160, 1660, 240, accent, 'accent', opacity=0.22),
        rect(540, 560, 440, 66, accent, 'accent', rx=33),
        text(540, 560, 400, top_pill, 32, body_font, '#111827', 800, font_role='heading', charSpacing=70),
        rect(540, 960, 880, 520, primary, 'primary', rx=40, opacity=0.92),
        text(540, 930, 780, center_title, 106, head_font, '#ffffff', 400, font_role='heading'),
        text(540, 1340, 820, sub_note, 44, body_font, '#e2e8f0', 600, font_role='body'),
        text(540, 1680, 860, '{{company}}', 40, body_font, accent, 700, role='accent', font_role='body'),
    ]
    return doc(name, 1080, 1920, bg, objs, brand_background=None)


def layout_carousel_slide(
    name, bg, primary, accent, text_fg,
    tag, headline, body_txt, cta_line, dark_canvas=False,
    head_font='Montserrat', body_font='Open Sans',
):
    objs = [
        rect(220, 145, 290, 56, primary, 'primary', rx=28),
        text(220, 145, 260, tag, 26, head_font, '#ffffff', 800, font_role='heading', charSpacing=60),
        text(540, 440, 900, headline, 88, head_font, text_fg, 800, role=None if dark_canvas else 'text', font_role='heading', align='left'),
        rect(170, 625, 160, 8, accent, 'accent', rx=4),
        text(540, 830, 900, body_txt, 44, body_font, text_fg, 500, font_role='body', align='left'),
        rect(540, 1140, 900, 120, primary, 'primary', rx=24, opacity=0.12),
        text(540, 1140, 820, cta_line, 38, head_font, primary, 700, role='primary', font_role='heading', align='left'),
        text(540, 1265, 900, '{{company}}  ·  {{website}}', 30, body_font, text_fg, 500, font_role='body', align='left'),
    ]
    return doc(name, 1080, 1350, bg, objs, None if dark_canvas else 'background')


def layout_social_testimonial(
    name, bg, card_bg, primary, accent, text_fg,
    quote_txt, author, rating='★★★★★', head_font='Playfair Display', body_font='Nunito',
):
    objs = [
        rect(540, 540, 900, 860, card_bg, rx=40, stroke=primary, brandStroke='primary', strokeWidth=3),
        text(540, 215, 760, rating, 62, body_font, accent, 700, role='accent', font_role='body'),
        text(540, 325, 300, '“', 180, head_font, primary, 900, role='primary', font_role='heading'),
        text(540, 560, 740, quote_txt, 54, head_font, text_fg, 700, role='text', font_role='heading'),
        rect(540, 760, 160, 5, primary, 'primary'),
        text(540, 830, 760, author, 38, body_font, primary, 700, role='primary', font_role='body'),
        text(540, 910, 760, '{{company}}', 32, body_font, text_fg, 600, role='text', font_role='body'),
    ]
    return doc(name, 1080, 1080, bg, objs)


def layout_checklist(
    name, bg, primary, accent, text_fg,
    title, items, footer='Salve para consultar depois · {{company}}',
    head_font='Montserrat', body_font='Open Sans',
):
    objs = [
        rect(540, 130, 1080, 260, primary, 'primary'),
        text(540, 130, 920, title, 72, head_font, '#ffffff', 800, font_role='heading'),
    ]
    y = 370
    for item in items[:4]:
        objs.append(rect(540, y, 880, 118, '#ffffff', rx=22, stroke=primary, brandStroke='primary', strokeWidth=2))
        objs.append(circle(175, y, 30, accent, 'accent'))
        objs.append(text(175, y, 48, '✓', 34, body_font, '#111827', 800))
        objs.append(text(590, y, 710, item, 36, body_font, text_fg, 600, role='text', font_role='body', align='left'))
        y += 145
    objs.append(text(540, 990, 900, footer, 32, body_font, primary, 700, role='primary', font_role='body'))
    return doc(name, 1080, 1080, bg, objs)


def layout_youtube_banner(
    name, w, h, bg, primary, accent, on_primary,
    pill, headline, subline, head_font='Anton', body_font='Montserrat',
):
    cx = w / 2
    cy = h / 2
    objs = [
        rect(w * 0.30, cy, w * 0.64, h, primary, 'primary', angle=-6),
        rect(w * 0.25, h * 0.22, w * 0.28, h * 0.08, accent, 'accent', rx=24),
        text(w * 0.25, h * 0.22, w * 0.26, pill, 28, body_font, '#111827', 800, font_role='heading'),
        text(w * 0.31, h * 0.48, w * 0.50, headline, 96 if h >= 700 else 58, head_font, on_primary, 400, font_role='heading', align='left'),
        text(w * 0.31, h * 0.72, w * 0.50, subline, 36 if h >= 700 else 26, body_font, '#e2e8f0', 600, font_role='body', align='left'),
        rect(w * 0.78, cy, w * 0.34, h * 0.72, '#ffffff', rx=28, opacity=0.10, stroke=accent, brandStroke='accent', strokeWidth=3),
        text(w * 0.78, cy, w * 0.28, '{{company}}\n{{slogan}}', 34 if h >= 700 else 26, body_font, '#ffffff', 700, font_role='body'),
    ]
    return doc(name, w, h, bg, objs, brand_background=None)


def layout_business_card(
    name, w, h, bg, primary, accent, text_fg,
    vertical=False, loyalty=False, vip=False, head_font='Montserrat', body_font='Open Sans', dark_canvas=False,
):
    if loyalty:
        objs = [
            rect(525, 300, 990, 540, bg, rx=28, stroke=primary, brandStroke='primary', strokeWidth=4),
            text(525, 110, 860, 'CARTÃO FIDELIDADE · {{company}}', 40, head_font, primary, 800, role='primary', font_role='heading'),
            text(525, 168, 860, 'Complete 10 selos e ganhe um presente especial', 26, body_font, text_fg, 500, role='text', font_role='body'),
        ]
        for row in range(2):
            for col in range(5):
                sx = 185 + col * 170
                sy = 295 + row * 145
                objs.append(circle(sx, sy, 52, '#ffffff' if not dark_canvas else '#1f2937', stroke=accent, brandStroke='accent', strokeWidth=4))
                if row == 1 and col == 4:
                    objs.append(text(sx, sy, 90, '★', 48, head_font, primary, 700, role='primary'))
        objs.append(text(525, 530, 860, '{{phone}}  ·  {{website}}', 24, body_font, text_fg, 600, font_role='body'))
        return doc(name, 1050, 600, bg, objs, None if dark_canvas else 'background')

    if vertical:
        objs = [
            rect(300, 175, 600, 350, primary, 'primary'),
            circle(300, 175, 92, accent, 'accent', opacity=0.92),
            text(300, 175, 160, 'LOGO', 34, head_font, '#111827', 800, font_role='heading'),
            text(300, 460, 500, '{{company}}', 50, head_font, text_fg, 800, role='text', font_role='heading'),
            text(300, 535, 500, '{{slogan}}', 28, body_font, primary, 500, role='primary', font_role='body'),
            rect(300, 610, 260, 4, accent, 'accent'),
            text(300, 720, 500, '{{phone}}', 30, body_font, text_fg, 600, font_role='body'),
            text(300, 790, 500, '{{email}}', 28, body_font, text_fg, 400, font_role='body'),
            text(300, 860, 500, '{{website}}', 28, body_font, text_fg, 400, font_role='body'),
            text(300, 955, 500, '{{address}}', 24, body_font, text_fg, 400, font_role='body'),
        ]
        return doc(name, 600, 1050, bg, objs)

    objs = [
        rect(525, 300, 990, 540, bg, rx=20, stroke=accent if vip else primary, brandStroke='accent' if vip else 'primary', strokeWidth=3),
        rect(525, 54, 990, 18, primary, 'primary'),
        text(525, 165, 840, 'CARTÃO CLIENTE VIP' if vip else '{{company}}', 54, head_font, text_fg, 800,
             role=None if dark_canvas else 'text', font_role='heading'),
        text(525, 240, 820, '15% de desconto permanente · {{company}}' if vip else '{{slogan}}', 28, body_font, accent if vip else primary, 600,
             role='accent' if vip else 'primary', font_role='body'),
        rect(525, 315, 260, 4, accent, 'accent'),
        text(525, 395, 840, '{{phone}}  ·  {{email}}', 28, body_font, text_fg, 500, font_role='body'),
        text(525, 455, 840, '{{website}}  ·  {{address}}', 26, body_font, text_fg, 400, font_role='body'),
    ]
    return doc(name, w, h, bg, objs, None if dark_canvas else 'background')


def layout_monogram_logo(
    name, bg, primary, accent, text_fg,
    initial, shape='circle', tag='{{slogan}}', head_font='Playfair Display', body_font='Montserrat', dark_canvas=False,
):
    objs = []
    if shape == 'hex':
        objs.append(polygon(500, 390, hex_points(215), primary, 'primary'))
        objs.append(polygon(500, 390, hex_points(185), '#ffffff', opacity=0.14))
    elif shape == 'diamond':
        objs.append(polygon(500, 390, diamond_points(230, 230), primary, 'primary'))
        objs.append(polygon(500, 390, diamond_points(195, 195), accent, stroke=accent, strokeWidth=3, opacity=0.20))
    else:
        objs.append(circle(500, 390, 215, primary, 'primary', stroke=accent, brandStroke='accent', strokeWidth=8))
        objs.append(circle(500, 390, 182, '#ffffff', opacity=0.12))
    objs.extend([
        text(500, 390, 340, initial, 200, head_font, '#ffffff', 900, font_role='heading'),
        text(500, 725, 860, '{{company}}', 86, head_font, text_fg, 800, role=None if dark_canvas else 'text', font_role='heading', charSpacing=50),
        text(500, 825, 860, tag, 38, body_font, primary if not dark_canvas else accent, 500, role='primary' if not dark_canvas else 'accent', font_role='body'),
    ])
    return doc(name, 1000, 1000, bg, objs, None if dark_canvas else 'background')


def layout_certificate(name, bg, primary, accent, text_fg):
    objs = [
        rect(960, 540, 1780, 940, '#ffffff', stroke=primary, brandStroke='primary', strokeWidth=10),
        rect(960, 540, 1730, 890, '#ffffff', stroke=accent, brandStroke='accent', strokeWidth=3),
        text(960, 210, 1400, 'CERTIFICADO DE CONCLUSÃO', 72, 'Playfair Display', primary, 800, role='primary', font_role='heading', charSpacing=70),
        text(960, 330, 1200, 'Conferido com honra ao participante', 38, 'Montserrat', text_fg, 500, font_role='body'),
        text(960, 470, 1400, 'Nome do Participante', 102, 'Dancing Script', text_fg, 700, role='text', font_role='heading'),
        rect(960, 550, 920, 3, accent, 'accent'),
        text(960, 645, 1360, 'Por concluir com êxito a formação promovida por {{company}}.', 40, 'Montserrat', text_fg, 500, font_role='body'),
        text(560, 835, 520, '____________________\nDiretoria · {{company}}', 30, 'Montserrat', text_fg, 600, font_role='body'),
        circle(960, 820, 74, accent, 'accent'),
        text(960, 820, 120, '★', 64, 'Anton', '#111827'),
        text(1360, 835, 520, '____________________\nData de emissão', 30, 'Montserrat', text_fg, 600, font_role='body'),
    ]
    return doc(name, 1920, 1080, bg, objs)


def layout_event_festive(
    name, w, h, bg, primary, accent, text_fg,
    eyebrow, headline, subline, details, cta,
    head_font='Playfair Display', body_font='Montserrat', dark_canvas=False,
):
    cx = w / 2
    objs = [
        circle(w * 0.14, h * 0.12, w * 0.18, primary, 'primary', opacity=0.18),
        circle(w * 0.86, h * 0.86, w * 0.22, accent, 'accent', opacity=0.20),
        rect(cx, h / 2, w - 88, h - 88, '#ffffff' if not dark_canvas else bg, rx=34,
             stroke=primary, brandStroke='primary', strokeWidth=4, opacity=0.92 if not dark_canvas else 1.0),
        rect(cx, h * 0.14, w * 0.48, 58, primary, 'primary', rx=29),
        text(cx, h * 0.14, w * 0.44, eyebrow, 28, body_font, '#ffffff', 800, font_role='heading', charSpacing=80),
        text(cx, h * 0.34, w * 0.80, headline, 104, head_font, text_fg, 800, role=None if dark_canvas else 'text', font_role='heading'),
        rect(cx, h * 0.47, 180, 5, accent, 'accent'),
        text(cx, h * 0.58, w * 0.78, subline, 44, body_font, text_fg, 500, font_role='body'),
        text(cx, h * 0.72, w * 0.78, details, 36, body_font, primary if not dark_canvas else accent, 700,
             role='primary' if not dark_canvas else 'accent', font_role='body'),
        rect(cx, h * 0.84, w * 0.58, 96, accent, 'accent', rx=48),
        text(cx, h * 0.84, w * 0.52, cta, 38, body_font, '#111827', 800, font_role='heading'),
        text(cx, h * 0.92, w * 0.80, '{{company}}  ·  {{address}}', 28, body_font, text_fg, 500, font_role='body'),
    ]
    return doc(name, w, h, bg, objs, None if dark_canvas else 'background')


def build_extra_templates():
    """Retorna lista de (id, nome, categoria, factory_fn) com 124 templates inéditos."""
    items = []

    def add(tid, name, cat, builder):
        items.append((tid, name, cat, builder))

    # ================= 1. VENDAS (14 novos + 2 originais = 16) =================
    add('black-friday-neon', 'Black Friday Impacto', 'Vendas', lambda: layout_diagonal_promo(
        'Black Friday Impacto', 1080, 1080, '#0b0d13', '#eab308', '#facc15', '#0b0d13',
        'SO HOJE', 'BLACK', 'FRIDAY · ATÉ 70%', 'Descontos progressivos em toda a loja', 'APROVEITAR AGORA'))
    add('cupom-desconto-quadrado', 'Cupom de Desconto', 'Vendas', lambda: layout_coupon_frame(
        'Cupom de Desconto', '#fff7ed', '#ffffff', '#ea580c', '#fde047', '#1c1917',
        'PRESENTE PARA VOCE', 'BEMVINDO15', '15% OFF', 'Valido na primeira compra acima de R$ 99', 'USAR CUPOM'))
    add('frete-gratis-brasil', 'Frete Grátis Brasil', 'Vendas', lambda: layout_impact_offer(
        'Frete Grátis Brasil', 1080, 1080, '#f0f9ff', '#0284c7', '#facc15', '#0f172a', '#ffffff',
        'ENVIO IMEDIATO', 'FRETE GRÁTIS', 'Para todo o Brasil acima de R$ 149', 'HOJE', 'GARANTIR ENVIO'))
    add('queima-estoque-retrato', 'Queima de Estoque', 'Vendas', lambda: layout_impact_offer(
        'Queima de Estoque', 1080, 1350, '#fff1f2', '#e11d48', '#fde047', '#1f2937', '#ffffff',
        'ULTIMAS PECAS', 'QUEIMA', 'Descontos reais ate zerar o estoque', '-50%', 'COMPRAR AGORA'))
    add('combo-leve-3-pague-2', 'Combo Leve 3 Pague 2', 'Vendas', lambda: layout_bento_product(
        'Combo Leve 3 Pague 2', '#f8fafc', '#ffffff', '#7c3aed', '#facc15', '#0f172a',
        'COMBO ECONOMICO', 'Leve 3, Pague 2', ['Escolha seus favoritos', 'Envio em até 24h'], 'R$ 89,90', 'MONTAR COMBO'))
    add('pix-desconto-imediato', '10% OFF no Pix', 'Vendas', lambda: layout_impact_offer(
        '10% OFF no Pix', 1080, 1080, '#ecfdf5', '#059669', '#bef264', '#064e3b', '#ffffff',
        'PAGAMENTO INSTANTANEO', '10% NO PIX', 'Aprovação imediata + prioridade no envio', 'PIX', 'PAGAR COM PIX'))
    add('oferta-relampago-24h', 'Oferta Relâmpago 24h', 'Vendas', lambda: layout_diagonal_promo(
        'Oferta Relâmpago 24h', 1080, 1350, '#0f172a', '#6366f1', '#22d3ee', '#ffffff',
        'CORRA · 24 HORAS', 'RELÂMPAGO', 'DE R$ 199 POR R$ 119', 'Estoque limitado para pedidos de hoje', 'GARANTIR OFERTA'))
    add('liquidacao-verao-coral', 'Liquidação de Verão', 'Vendas', lambda: layout_editorial_showcase(
        'Liquidação de Verão', 1080, 1080, '#fff7ed', '#ffffff', '#f97316', '#fdba74', '#292524',
        'TEMPORADA DE SOL', 'Liquida Verão', 'Ate 40% OFF na coleção leve', 'Válido enquanto durar o estoque', '-40% OFF',
        head_font='Playfair Display', body_font='Nunito'))
    add('ultimos-dias-terracota', 'Últimos Dias', 'Vendas', lambda: layout_editorial_showcase(
        'Últimos Dias', 1080, 1080, '#faf5f0', '#ffffff', '#b45309', '#d97706', '#1c1917',
        'OPORTUNIDADE FINAL', 'Últimos Dias', 'Condições especiais até domingo', 'Não deixe para depois', 'ACABANDO'))
    add('cashback-clube-vantagens', 'Cashback 15% de Volta', 'Vendas', lambda: layout_coupon_frame(
        'Cashback 15%', '#f5f3ff', '#ffffff', '#6d28d9', '#2dd4bf', '#1e1b4b',
        'CLUBE DE VANTAGENS', 'VOLTA15', '15% BACK', 'Ganhe crédito automático para a próxima compra', 'RESGATAR'))
    add('kit-presente-especial', 'Kit Presente Luxo', 'Vendas', lambda: layout_editorial_showcase(
        'Kit Presente Luxo', 1080, 1350, '#faf6f0', '#ffffff', '#78350f', '#d4a373', '#292524',
        'EMBALAGEM PREMIUM', 'Kit Presente', 'Pronto para surpreender quem você ama', 'Cartão personalizado grátis', 'EDICAO GIFT'))
    add('parcelamento-12x-sem-juros', '12x Sem Juros', 'Vendas', lambda: layout_bento_product(
        '12x Sem Juros', '#f1f5f9', '#ffffff', '#2563eb', '#fde047', '#0f172a',
        'FACILIDADE NO CARTAO', '12x Sem Juros', ['Parcela mínima R$ 29', 'Compra 100% protegida'], '12x R$ 24', 'FINALIZAR AGORA'))
    add('semana-consumidor-vip', 'Semana do Consumidor', 'Vendas', lambda: layout_impact_offer(
        'Semana do Consumidor', 1080, 1080, '#eff6ff', '#1d4ed8', '#fbbf24', '#0f172a', '#ffffff',
        'ESPECIAL DO CLIENTE', 'CONSUMIDOR', 'Brinde exclusivo + frete reduzido', 'VIP', 'VER BENEFICIOS'))
    add('saldao-fim-de-mes', 'Saldão Fim de Mês', 'Vendas', lambda: layout_diagonal_promo(
        'Saldão Fim de Mês', 1080, 1080, '#18181b', '#f97316', '#fde047', '#ffffff',
        'PRECO DE FABRICA', 'SALDÃO', 'ATE DIA 30 · 45% OFF', 'Seleção especial com entrega rápida', 'QUERO MEU DESCONTO'))
    add('feirao-descontos-express', 'Feirão Express', 'Vendas', lambda: layout_bento_product(
        'Feirão Express', '#0f172a', '#1e293b', '#ec4899', '#facc15', '#f8fafc',
        'SO ESTE FIM DE SEMANA', 'Feirão Express', ['Lotes promocionais', 'Despacho em 24 horas'], '-35% OFF', 'COMPRAR JÁ',
        dark_canvas=True))
    add('cupom-frete-zero', 'Cupom Frete Zero', 'Vendas', lambda: layout_coupon_frame(
        'Cupom Frete Zero', '#f0fdf4', '#ffffff', '#15803d', '#bef264', '#14532d',
        'CUPOM EXCLUSIVO', 'FRETEZERO', 'R$ 0 FRETE', 'Use no carrinho para anular a taxa de entrega', 'ATIVAR FRETE'))

    # ================= 2. PRODUTOS (16 novos) =================
    add('vitrine-minimal-skincare', 'Vitrine Skincare Minimal', 'Produtos', lambda: layout_editorial_showcase(
        'Vitrine Skincare Minimal', 1080, 1080, '#f4f6f0', '#ffffff', '#4a6b53', '#a3b18a', '#1b2620',
        'BELEZA LIMPA', 'Sérum Natural', 'Hidratação profunda e brilho saudável', 'Vegano · Dermatologicamente testado', 'NOVO'))
    add('luxo-noir-perfume', 'Perfume Luxo Noir', 'Produtos', lambda: layout_impact_offer(
        'Perfume Luxo Noir', 1080, 1350, '#09090b', '#d4af37', '#fef08a', '#f5f5f4', '#09090b',
        'EDICAO LIMITADA', 'NOIR GOLD', 'Notas amadeiradas e toque de âmbar', 'LUXO', 'GARANTIR FRASCO',
        head_font='Playfair Display', dark_canvas=True))
    add('tech-gadget-spec', 'Gadget Tech Spec', 'Produtos', lambda: layout_bento_product(
        'Gadget Tech Spec', '#0b1120', '#162033', '#06b6d4', '#22d3ee', '#f1f5f9',
        'ALTA TECNOLOGIA', 'Pro Wireless', ['Bateria de 48 horas', 'Bluetooth 5.3 + USB-C'], 'R$ 249', 'COMPRAR',
        dark_canvas=True))
    add('tenis-street-drop', 'Tênis Street Drop', 'Produtos', lambda: layout_diagonal_promo(
        'Tênis Street Drop', 1080, 1350, '#111827', '#f59e0b', '#fde047', '#111827',
        'DROP LIMITADO', 'STREET PRO', 'NUMERACAO 35 AO 44', 'Solado anatômico + cabedal respirável', 'RESERVAR PAR'))
    add('cafe-artesanal-graos', 'Café em Grãos Artesanal', 'Produtos', lambda: layout_editorial_showcase(
        'Café em Grãos', 1080, 1080, '#f7efe6', '#ffffff', '#6f4e37', '#c89f7b', '#2c1e16',
        'TORRA FRESCA', '100% Arábica', 'Notas de chocolate amargo e avelã', 'Moído na hora ou em grãos · 500g', 'ESPECIAL'))
    add('suplemento-fitness-pro', 'Suplemento Alta Performance', 'Produtos', lambda: layout_bento_product(
        'Suplemento Pro', '#111827', '#1f2937', '#84cc16', '#bef264', '#f8fafc',
        'NUTRICAO ESPORTIVA', 'Whey Isolate Pro', ['30g de proteína/dose', 'Zero adição de açúcar'], 'R$ 139', 'ADICIONAR',
        dark_canvas=True))
    add('joalheria-ouro-atelier', 'Joalheria Ouro 18k', 'Produtos', lambda: layout_editorial_showcase(
        'Joalheria Atelier', 1080, 1080, '#faf7f2', '#ffffff', '#b08968', '#d4af37', '#1c1917',
        'ALTA JOALHERIA', 'Coleção Eterna', 'Acabamento artesanal banhado a ouro 18k', 'Acompanha certificado de garantia', 'EXCLUSIVO'))
    add('decoracao-casa-minimal', 'Casa & Decoração Minimal', 'Produtos', lambda: layout_editorial_showcase(
        'Casa & Decoração', 1080, 1350, '#f5f0eb', '#ffffff', '#7f5539', '#b08968', '#2b211b',
        'DESIGN DE INTERIORES', 'Conforto & Arte', 'Peças autorais para transformar seu espaço', 'Envio seguro para todo o Brasil', 'ATELIE'))
    add('pet-shop-alegria', 'Pet Care & Brinquedos', 'Produtos', lambda: layout_impact_offer(
        'Pet Care Alegria', 1080, 1080, '#f0f9ff', '#0ea5e9', '#fbbf24', '#0f172a', '#ffffff',
        'MIMOS PARA PET', 'FELIZ TODO DIA', 'Petiscos naturais e brinquedos seguros', 'PET', 'PEDIR PARA O PET'))
    add('bento-3-beneficios', 'Bento Benefícios Produto', 'Produtos', lambda: layout_bento_product(
        'Bento Benefícios', '#f8fafc', '#ffffff', '#4f46e5', '#f59e0b', '#0f172a',
        'DESTAQUE DA SEMANA', 'Qualidade Real', ['Garantia de 30 dias', 'Entrega super rápida'], 'R$ 129', 'EU QUERO'))
    add('comparativo-antes-depois', 'Antes e Depois Produto', 'Produtos', lambda: layout_split_compare(
        'Antes e Depois', '#ffffff', '#0f172a', '#10b981', '#0f172a',
        'VEJA A DIFERENCA', 'ANTES', '• Pouca definição\n• Desgaste rápido\n• Sem proteção',
        'COM O PRODUTO', '• Acabamento perfeito\n• Alta durabilidade\n• Resultado imediato', 'GARANTIR O MEU'))
    add('ficha-tecnica-marketplace', 'Vitrine Marketplace 5★', 'Produtos', lambda: layout_editorial_showcase(
        'Vitrine Marketplace 5★', 1080, 1350, '#ffffff', '#f8fafc', '#2563eb', '#f59e0b', '#0f172a',
        '★★★★★ 4.9 (1.200+ AVALIACOES)', 'Escolha do Cliente', 'Original · Lacrado · Pronta entrega',
        'Parcele em até 10x sem juros', 'TOP 1'))
    add('embalagem-eco-natural', 'Produto Eco Sustentável', 'Produtos', lambda: layout_editorial_showcase(
        'Eco Sustentável', 1080, 1080, '#f0fdf4', '#ffffff', '#15803d', '#86efac', '#14532d',
        'CONSCIENTE & NATURAL', 'Linha Botânica', 'Fórmula limpa e frasco 100% reciclável', 'Cruelty-free certificado', 'ECO'))
    add('relogio-classic-steel', 'Relógio Classic Steel', 'Produtos', lambda: layout_bento_product(
        'Relógio Classic', '#0f172a', '#1e293b', '#94a3b8', '#fbbf24', '#f8fafc',
        'PRECISAO E ESTILO', 'Chrono Steel', ['Aço inox escovado', 'Resistente à água 50m'], 'R$ 399', 'COMPRAR',
        head_font='Playfair Display', dark_canvas=True))
    add('kit-rotina-capilar', 'Kit Rotina Diária', 'Produtos', lambda: layout_editorial_showcase(
        'Kit Rotina Diária', 1080, 1350, '#fdf2f8', '#ffffff', '#be185d', '#f9a8d4', '#500724',
        '3 PASSOS ESSENCIAIS', 'Ritual Completo', 'Limpeza suave, nutrição e proteção térmica', 'Indicado para uso diário', 'KIT 3X'))
    add('destaque-mais-vendido', 'Camisa / Moda Essencial', 'Produtos', lambda: layout_impact_offer(
        'Produto Mais Vendido', 1080, 1080, '#f8fafc', '#1e293b', '#facc15', '#0f172a', '#ffffff',
        '#1 MAIS VENDIDO', 'CAMPEAO', 'Algodão premium que não deforma', 'TOP', 'VER CORES'))

    # ================= 3. STORIES & REELS (16 novos em 1080x1920) =================
    add('story-produto-spotlight', 'Story Vitrine Produto', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Vitrine', '#0f172a', '#6366f1', '#22d3ee', '#f8fafc',
        'CHEGOU NOVIDADE', 'DESTAQUE', 'Acabamento premium e envio imediato', 'COMPRAR AGORA', dark_canvas=True))
    add('story-oferta-diaria', 'Story Oferta do Dia', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Oferta do Dia', '#fff1f2', '#e11d48', '#fde047', '#1f2937',
        'SO ATE MEIA-NOITE', 'OFERTA HOJE', 'Desconto exclusivo para quem acompanha', 'PECA NO LINK', dark_canvas=False))
    add('story-enquete-interacao', 'Story Enquete A ou B', 'Stories & Reels', lambda: layout_story_interactive(
        'Story Enquete', '#4c1d95', '#a855f7', '#facc15', '#ffffff', '#1e1b4b',
        'PARTICIPE AGORA', 'Qual você escolheria hoje?', 'A · Clássico minimalista', 'B · Edição colorida vibrante', 'VOTE NA ENQUETE'))
    add('story-caixinha-duvidas', 'Story Caixinha Perguntas', 'Stories & Reels', lambda: layout_story_interactive(
        'Story Perguntas', '#7c2d12', '#f97316', '#fde047', '#fff7ed', '#431407',
        'TIRA-DUVIDAS', 'Quer saber mais sobre o produto?', 'Envie sua pergunta sobre preços', 'Ou peça ajuda para escolher o tamanho', 'RESPONDENDO TUDO'))
    add('story-unboxing-reposicao', 'Story Reposição Chegou', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Reposição', '#064e3b', '#10b981', '#bef264', '#ecfdf5',
        'VOLTOU AO ESTOQUE', 'REPOSIÇÃO', 'O mais pedido finalmente disponível', 'GARANTIR O MEU', dark_canvas=True))
    add('story-3-dicas-rapidas', 'Story 3 Motivos Escolher', 'Stories & Reels', lambda: layout_story_steps(
        'Story 3 Motivos', '#faf5f0', '#ffffff', '#b45309', '#fde047', '#1c1917',
        '3 Motivos', 'Para escolher {{company}} hoje',
        [('Qualidade testada', 'Materiais selecionados em cada peça'),
         ('Entrega ágil', 'Despachamos seu pedido em até 24h'),
         ('Compra garantida', 'Troca facilitada sem burocracia')], 'VER CATALOGO'))
    add('story-cupom-exclusivo-24h', 'Story Cupom 24h', 'Stories & Reels', lambda: layout_story_interactive(
        'Story Cupom 24h', '#111827', '#14b8a6', '#facc15', '#1f2937', '#f8fafc',
        'SEGREDO DOS STORIES', 'Print e use hoje!', 'Código: STORIES15', '15% OFF em todo o site hoje', 'IR PARA O SITE'))
    add('story-depoimento-cliente', 'Story Prova Social', 'Stories & Reels', lambda: layout_story_steps(
        'Story Depoimento', '#f5f3ff', '#ffffff', '#6d28d9', '#facc15', '#1e1b4b',
        '★★★★★ 5.0', 'Avaliações reais de quem já usa',
        [('Maria Clara S.', '“Chegou muito rápido e super bem embalado!”'),
         ('Rafael Oliveira', '“A qualidade surpreende muito pelo preço.”'),
         ('Juliana Costa', '“Já é a terceira vez que compro, recomendo!”')], 'VER AVALIACOES'))
    add('story-bom-dia-atendimento', 'Story Bom Dia Loja', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Bom Dia', '#eff6ff', '#2563eb', '#fbbf24', '#0f172a',
        'ATENDIMENTO ABERTO', 'BOM DIA!', 'Estamos prontos para tirar suas dúvidas', 'CHAMAR NO WHATS', dark_canvas=False))
    add('story-capa-reels-passos', 'Capa Reels Como Usar', 'Stories & Reels', lambda: layout_reels_cover(
        'Capa Reels Passos', '#09090b', '#e11d48', '#facc15',
        'TUTORIAL RAPIDO', 'COMO USAR EM 3 PASSOS', 'Resultado profissional em casa'))
    add('story-capa-reels-segredo', 'Capa Reels O Segredo', 'Stories & Reels', lambda: layout_reels_cover(
        'Capa Reels Segredo', '#0f172a', '#7c3aed', '#22d3ee',
        'POUCA GENTE SABE', 'O SEGREDO DOS PROS', 'Salve este vídeo para testar hoje'))
    add('story-bastidores-atelie', 'Story Bastidores', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Bastidores', '#faf7f2', '#92400e', '#f59e0b', '#292524',
        'POR DENTRO DA PRODUCAO', 'BASTIDORES', 'Cada pedido preparado com cuidado', 'VER PROCESSO', dark_canvas=False))
    add('story-novidades-semana', 'Story Novidades Semana', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Novidades', '#1e1b4b', '#4f46e5', '#f472b6', '#ffffff',
        'ACABOU DE CHEGAR', 'NEW DROP', 'Conheça os lançamentos desta semana', 'CONFERIR AGORA', dark_canvas=True))
    add('story-contagem-ao-vivo', 'Story É Hoje às 20h', 'Stories & Reels', lambda: layout_reels_cover(
        'Story Contagem Hoje', '#111827', '#ea580c', '#fde047',
        'ATIVE O LEMBRETE', 'É HOJE ÀS 20H!', 'Ofertas válidas apenas durante a live'))
    add('story-catalogo-whatsapp', 'Story Catálogo WhatsApp', 'Stories & Reels', lambda: layout_story_steps(
        'Story Catálogo Whats', '#ecfdf5', '#ffffff', '#059669', '#bef264', '#064e3b',
        'Peça Fácil', 'Atendimento direto e humanizado',
        [('1. Escolha os itens', 'Receba o catálogo completo em PDF'),
         ('2. Tire suas dúvidas', 'Consultoria rápida por mensagem'),
         ('3. Receba em casa', 'Envio rápido com rastreamento')], 'PEDIR NO {{phone}}'))
    add('story-fechamento-envios', 'Story Últimos Pedidos', 'Stories & Reels', lambda: layout_story_spotlight(
        'Story Últimos Pedidos', '#0f172a', '#0284c7', '#facc15', '#f8fafc',
        'ENVIO DE AMANHA', 'ÚLTIMAS HORAS', 'Feche hoje e postamos na primeira leva', 'FECHAR PEDIDO', dark_canvas=True))

    # ================= 4. COMIDA (13 novos + 1 original = 14) =================
    add('burger-combo-quadrado', 'Combo Smash Burger', 'Comida', lambda: layout_impact_offer(
        'Combo Smash Burger', 1080, 1080, '#18181b', '#ea580c', '#facc15', '#f4f4f5', '#ffffff',
        'COMBO DA CASA', 'SMASH DUPLO', 'Pão brioche + blend 180g + batata rústica', 'R$ 34', 'PEDIR AGORA', dark_canvas=True))
    add('pizza-rodizio-retrato', 'Noite da Pizza Artesanal', 'Comida', lambda: layout_event_festive(
        'Noite da Pizza', 1080, 1350, '#fef2f2', '#b91c1c', '#fbbf24', '#1c1917',
        'FORNO A LENHA', 'Pizza Artesanal', 'Massa de fermentação natural 48h + molho fresco',
        'Sexta e Sábado · Das 18h às 23h', 'PEDIR DELIVERY', head_font='Playfair Display'))
    add('acai-verao-delivery', 'Açaí no Capricho', 'Comida', lambda: layout_impact_offer(
        'Açaí no Capricho', 1080, 1080, '#faf5ff', '#6b21a8', '#bef264', '#3b0764', '#ffffff',
        'PURO E CREMOSO', 'AÇAÍ 500ML', 'Escolha 4 acompanhamentos sem custo extra', 'R$ 22', 'MONTAR MEU ACAI'))
    add('confeitaria-bolos-artesanal', 'Confeitaria & Bolos', 'Comida', lambda: layout_editorial_showcase(
        'Confeitaria & Bolos', 1080, 1080, '#fff1f2', '#ffffff', '#be185d', '#f9a8d4', '#4a044e',
        'DOCERIA ARTESANAL', 'Bolos & Doces', 'Feitos sob encomenda para festas e cafés', 'Chantininho, brigadeiro belga e frutas', 'ENCOMENDE',
        head_font='Pacifico', body_font='Nunito'))
    add('delivery-rapido-moto', 'Delivery Grátis Pediu Chegou', 'Comida', lambda: layout_diagonal_promo(
        'Delivery Rápido', 1080, 1080, '#1c1917', '#f97316', '#fde047', '#ffffff',
        'ENTREGA PROPRIA', 'PEDIU, CHEGOU!', 'TAXA ZERO ACIMA DE R$ 50', 'Quentinho na sua porta em até 35 min', 'CHAMAR DELIVERY'))
    add('sushi-jantar-especial', 'Combinado Sushi do Chef', 'Comida', lambda: layout_menu_board(
        'Combinado do Chef', 1080, 1350, '#111827', '#dc2626', '#ef4444', '#f8fafc', '#f8fafc',
        'SUSHI FRESH', 'Combinados frescos preparados na hora',
        [('Combinado Salmão (20 pçs)', 'R$ 69,00'),
         ('Hot Roll Crocante (10 pçs)', 'R$ 32,00'),
         ('Sashimi Especial (15 fatias)', 'R$ 58,00'),
         ('Temaki Cream Cheese', 'R$ 28,00')],
        footer='Peça pelo {{phone}} · {{address}}', head_font='Oswald', body_font='Open Sans', dark_canvas=True))
    add('marmita-fit-semana', 'Marmitas Fit da Semana', 'Comida', lambda: layout_checklist(
        'Marmitas Fit', '#f0fdf4', '#16a34a', '#bef264', '#14532d',
        'MENU FIT DA SEMANA',
        ['Frango grelhado + purê de batata-doce',
         'Patinho moído + arroz integral e brócolis',
         'Tilápia assada com legumes no azeite',
         'Kit com 10 marmitas: R$ 159,90'],
        footer='Entregas toda segunda e quinta · {{phone}}'))
    add('padaria-fornada-quente', 'Padaria Fornada Quente', 'Comida', lambda: layout_event_festive(
        'Fornada Quente', 1080, 1080, '#fffbeb', '#92400e', '#f59e0b', '#451a03',
        'PAES ARTESANAIS', 'Fornada das 16h', 'Pão francês crocante, croissant e café coado',
        'Venha sentir o cheiro de pão quentinho', 'VER CARDAPIO', head_font='Playfair Display'))
    add('almoco-executivo-dia', 'Prato do Dia Executivo', 'Comida', lambda: layout_menu_board(
        'Almoço Executivo', 1080, 1350, '#fafaf9', '#1e293b', '#c2410c', '#94a3b8', '#1e293b',
        'Prato do Dia', 'Servido das 11h30 às 15h',
        [('Filé à Parmegiana + Fritas', 'R$ 36,00'),
         ('Contra-filé na chapa completo', 'R$ 39,00'),
         ('Strogonoff de frango + arroz', 'R$ 32,00'),
         ('Salada Caesar com grelhado', 'R$ 29,00')],
        footer='{{address}} · Delivery {{phone}}'))
    add('cervejaria-happy-hour', 'Happy Hour Chopp Dobro', 'Comida', lambda: layout_diagonal_promo(
        'Happy Hour', 1080, 1080, '#0f172a', '#d97706', '#fde047', '#ffffff',
        'QUINTA E SEXTA', 'HAPPY HOUR', 'CHOPP EM DOBRO · 18H-21H', 'Porções artesanais e música ao vivo', 'RESERVAR MESA'))
    add('destaque-apps-delivery', 'Estamos no Delivery', 'Comida', lambda: layout_bento_product(
        'Estamos no Delivery', '#fff1f2', '#ffffff', '#e11d48', '#fde047', '#1f2937',
        'PECA SEM SAIR DE CASA', 'Delivery Ativo', ['Embalagem térmica segura', 'Cupons ativos hoje'], '15% OFF', 'FAZER PEDIDO'))
    add('cafeteria-menu-compacto', 'Menu Cafeteria Compacto', 'Comida', lambda: layout_menu_board(
        'Menu Cafeteria', 1080, 1080, '#f5f0e8', '#4a3525', '#92400e', '#d6ccc2', '#3e2723',
        'Café & Companhia', 'Grãos especiais torrados na semana',
        [('Espresso Duplo', 'R$ 8,00'),
         ('Latte Cremoso', 'R$ 12,00'),
         ('Bolo de Cenoura c/ Calda', 'R$ 11,00')],
        footer='{{company}} · {{address}}'))
    add('sorveteria-gelato-artesanal', 'Gelato Artesanal', 'Comida', lambda: layout_editorial_showcase(
        'Gelato Artesanal', 1080, 1080, '#fff5f7', '#ffffff', '#db2777', '#86efac', '#500724',
        'FEITO TODOS OS DIAS', 'Gelato Natural', 'Sabores de fruta fresca e pistache italiano', 'Casquinha crocante feita na loja', 'VERAO',
        head_font='Lobster', body_font='Nunito'))

    # ================= 5. BELEZA & MODA (14 novos) =================
    add('salao-beleza-agenda', 'Agenda Aberta Salão', 'Beleza & Moda', lambda: layout_event_festive(
        'Agenda Salão', 1080, 1080, '#fdf2f8', '#9d174d', '#f9a8d4', '#500724',
        'HORARIOS DISPONIVEIS', 'Agenda Aberta', 'Corte, escova, coloração e design de sobrancelha',
        'Terça a Sábado · 09h às 19h', 'AGENDAR HORARIO', head_font='Playfair Display'))
    add('barbearia-vintage-corte', 'Barbearia Clássica', 'Beleza & Moda', lambda: layout_menu_board(
        'Barbearia Clássica', 1080, 1350, '#111827', '#78350f', '#f59e0b', '#9ca3af', '#f3f4f6',
        'BARBA & CABELO', 'Estilo, precisão e toalha quente',
        [('Corte Social / Degradê', 'R$ 45,00'),
         ('Barba Completa Navalha', 'R$ 35,00'),
         ('Combo Corte + Barba', 'R$ 70,00'),
         ('Plano Mensal Ilimitado', 'R$ 130,00')],
        footer='Agende pelo {{phone}} · {{address}}', head_font='Oswald', dark_canvas=True))
    add('estetica-facial-clinica', 'Estética Facial Clínica', 'Beleza & Moda', lambda: layout_bento_product(
        'Estética Facial', '#faf8f5', '#ffffff', '#0f766e', '#fde68a', '#134e4a',
        'CUIDADO COM A PELE', 'Limpeza Profunda', ['Peeling ultrassônico', 'Hidratação com vitamina C'], 'R$ 120', 'AGENDAR AVALIACAO',
        head_font='Playfair Display'))
    add('moda-colecao-outono', 'Coleção Moda Editorial', 'Beleza & Moda', lambda: layout_editorial_showcase(
        'Coleção Moda', 1080, 1350, '#f5f2ed', '#ffffff', '#3f3f46', '#a1a1aa', '#18181b',
        'CHEGOU A NOVA TEMPORADA', 'Coleção Essencial', 'Tecidos nobres com caimento impecável', 'Tamanhos do PP ao GG', 'NEW IN'))
    add('unhas-gel-manicure', 'Unhas em Gel & Nail Art', 'Beleza & Moda', lambda: layout_impact_offer(
        'Unhas em Gel', 1080, 1080, '#fdf4ff', '#a21caf', '#f5d0fe', '#4a044e', '#ffffff',
        'BELEZA NAS MAOS', 'UNHAS EM GEL', 'Alongamento resistente com acabamento natural', 'TOP', 'MARCAR HORARIO'))
    add('look-semana-boutique', 'Look da Semana Boutique', 'Beleza & Moda', lambda: layout_editorial_showcase(
        'Look da Semana', 1080, 1350, '#fafaf9', '#ffffff', '#be123c', '#fda4af', '#1c1917',
        'CURADORIA DE ESTILO', 'Look da Semana', 'Combinação versátil do trabalho ao jantar', 'Disponível em 3 cores', 'EXCLUSIVO'))
    add('maquiagem-noivas-estudio', 'Maquiagem Social & Noivas', 'Beleza & Moda', lambda: layout_editorial_showcase(
        'Maquiagem & Noivas', 1080, 1080, '#fffbf7', '#ffffff', '#854d0e', '#e7c9a9', '#292524',
        'ALTA DURACAO', 'Beauty Studio', 'Produção personalizada para eventos e noivas', 'Produtos à prova d’água', 'AGENDA',
        head_font='Dancing Script', body_font='Montserrat'))
    add('acessorios-semijoias', 'Semijoias Banhadas a Ouro', 'Beleza & Moda', lambda: layout_editorial_showcase(
        'Semijoias Ouro', 1080, 1080, '#f3f6f4', '#ffffff', '#3f6212', '#ca8a04', '#1a2e05',
        'BRILHO QUE DURA', 'Semijoias Finas', 'Banho antialérgico com 1 ano de garantia', 'Parcelamento em até 6x sem juros', '18K'))
    add('depilacao-laser-pacote', 'Pacote Laser Indolor', 'Beleza & Moda', lambda: layout_coupon_frame(
        'Pacote Laser', '#faf5ff', '#ffffff', '#7e22ce', '#facc15', '#3b0764',
        'CONDICAO ESPECIAL', 'PELELISA', '40% OFF', 'Na compra do combo com 10 sessões', 'AGENDAR TESTE'))
    add('bazar-brecho-garimpo', 'Bazar & Brechó Achados', 'Beleza & Moda', lambda: layout_diagonal_promo(
        'Garimpo & Estilo', 1080, 1080, '#27272a', '#d97706', '#fde047', '#ffffff',
        'PECA UNICA', 'GARIMPO', 'MODA CONSCIENTE', 'Peças curadas em estado impecável', 'VER DISPONIVEIS'))
    add('studio-pilates-yoga', 'Studio Pilates & Bem-Estar', 'Beleza & Moda', lambda: layout_story_steps(
        'Pilates & Yoga', '#f0fdf4', '#ffffff', '#047857', '#a7f3d0', '#064e3b',
        'Pilates', 'Movimento, postura e qualidade de vida',
        [('Turmas reduzidas', 'Acompanhamento próximo do instrutor'),
         ('Aparelhos modernos', 'Ambiente climatizado e confortável'),
         ('Aula experimental', 'Venha conhecer antes de se matricular')], 'AGENDAR AULA GRÁTIS'))
    add('calcados-colecao-conforto', 'Calçados Coleção Conforto', 'Beleza & Moda', lambda: layout_bento_product(
        'Coleção Calçados', '#f8fafc', '#ffffff', '#0f172a', '#f59e0b', '#0f172a',
        'CONFORTO EM CADA PASSO', 'Nova Linha 2026', ['Palmilha anatômica macia', 'Couro legítimo selecionado'], 'R$ 189', 'ESCOLHER NUMERO'))
    add('cronograma-capilar-spa', 'Cronograma Capilar Spa', 'Beleza & Moda', lambda: layout_checklist(
        'Cronograma Capilar', '#ecfeff', '#0e7490', '#5eead4', '#164e63',
        'CABELOS SAUDÁVEIS',
        ['Semana 1: Hidratação intensiva com aloe',
         'Semana 2: Nutrição com óleos vegetais',
         'Semana 3: Reconstrução de queratina',
         'Kit completo com 20% de desconto'],
        footer='Compre pelo site · {{website}}'))
    add('consultoria-imagem-pessoal', 'Consultoria de Imagem', 'Beleza & Moda', lambda: layout_editorial_showcase(
        'Consultoria Imagem', 1080, 1350, '#faf7f4', '#ffffff', '#18181b', '#d4a373', '#18181b',
        'ESTILO AUTENTICO', 'Sua Melhor Versão', 'Análise de coloração pessoal e guarda-roupa', 'Atendimento presencial e online', 'VIP'))

    # ================= 6. MARCA (12 novos + 2 originais = 14) =================
    add('cartao-visita-minimal', 'Cartão Minimalista', 'Marca', lambda: layout_business_card(
        'Cartão Minimalista', 1050, 600, '#fafaf9', '#18181b', '#a1a1aa', '#18181b'))
    add('cartao-visita-dark-luxo', 'Cartão Dark & Ouro', 'Marca', lambda: layout_business_card(
        'Cartão Dark Ouro', 1050, 600, '#0f172a', '#d4af37', '#facc15', '#f8fafc', dark_canvas=True))
    add('cartao-visita-vertical', 'Cartão Vertical Moderno', 'Marca', lambda: layout_business_card(
        'Cartão Vertical', 600, 1050, '#ffffff', '#2563eb', '#facc15', '#0f172a', vertical=True))
    add('cartao-fidelidade-10', 'Cartão Fidelidade 10 Selos', 'Marca', lambda: layout_business_card(
        'Cartão Fidelidade', 1050, 600, '#fffbeb', '#b45309', '#f59e0b', '#451a03', loyalty=True))
    add('cartao-cliente-vip', 'Passe Cliente VIP', 'Marca', lambda: layout_business_card(
        'Cliente VIP', 1050, 600, '#111827', '#6366f1', '#facc15', '#f8fafc', vip=True, dark_canvas=True))
    add('tag-obrigado-pedido', 'Tag Obrigado pelo Pedido', 'Marca', lambda: layout_event_festive(
        'Tag Obrigado', 1080, 1080, '#fff7ed', '#ea580c', '#fde047', '#292524',
        'FEITO COM CARINHO', 'Obrigado!', 'Seu pedido foi preparado com todo cuidado para chegar perfeito até você.',
        'Poste uma foto e marque {{company}}', 'GANHE 10%: VOLTE10', head_font='Pacifico'))
    add('logo-monograma-serif', 'Logo Monograma Luxo', 'Marca', lambda: layout_monogram_logo(
        'Logo Monograma', '#faf7f2', '#1e293b', '#d4af37', '#1e293b', 'M', shape='circle'))
    add('logo-tech-hexagon', 'Logo Hexágono Tech', 'Marca', lambda: layout_monogram_logo(
        'Logo Tech', '#0f172a', '#06b6d4', '#22d3ee', '#f8fafc', 'T', shape='hex', dark_canvas=True))
    add('logo-diamante-editorial', 'Logo Diamante Editorial', 'Marca', lambda: layout_monogram_logo(
        'Logo Diamante', '#ffffff', '#6d28d9', '#facc15', '#1e1b4b', 'S', shape='diamond'))
    add('logo-badge-verde', 'Logo Botânico Orgânico', 'Marca', lambda: layout_monogram_logo(
        'Logo Botânico', '#f0fdf4', '#15803d', '#86efac', '#14532d', 'B', shape='circle', head_font='Lobster'))
    add('capa-catalogo-a4', 'Capa de Catálogo A4', 'Marca', lambda: layout_editorial_showcase(
        'Capa Catálogo 2026', 1240, 1754, '#f8fafc', '#ffffff', '#0f172a', '#64748b', '#0f172a',
        'EDICAO OFICIAL 2026', 'Catálogo Geral', 'Produtos, especificações e condições comerciais',
        'Pedidos: {{phone}} · {{email}}', '2026'))
    add('certificado-conclusao', 'Certificado Elegante', 'Marca', lambda: layout_certificate(
        'Certificado', '#f1f5f9', '#1e3a8a', '#f59e0b', '#1e293b'))

    # ================= 7. REDES SOCIAIS (12 novos + 2 originais = 14) =================
    add('carrossel-capa-5-erros', 'Carrossel Capa 5 Erros', 'Redes sociais', lambda: layout_carousel_slide(
        'Capa 5 Erros', '#0f172a', '#3b82f6', '#facc15', '#ffffff',
        'CARROSSEL · CAPA', '5 erros que travam suas vendas hoje',
        'A maioria comete o item 3 sem perceber. Arraste para ver como corrigir.',
        'Deslize para o lado →', dark_canvas=True))
    add('carrossel-miolo-dica-01', 'Carrossel Slide Dica 01', 'Redes sociais', lambda: layout_carousel_slide(
        'Slide Dica 01', '#f8fafc', '#2563eb', '#f59e0b', '#0f172a',
        '01 / 05', 'A primeira foto decide o clique',
        'Use fundo limpo, luz lateral suave e mostre o produto ocupando cerca de 65% da tela.',
        'Salve este conteúdo para aplicar →'))
    add('carrossel-cta-final', 'Carrossel Último Slide CTA', 'Redes sociais', lambda: layout_carousel_slide(
        'Slide CTA Final', '#1e1b4b', '#8b5cf6', '#22d3ee', '#ffffff',
        'CURTIU AS DICAS?', 'Salve este post para consultar depois!',
        'Envie para quem também vende pela internet e siga {{company}} para mais guias práticos.',
        'Comente EU QUERO para receber o guia', dark_canvas=True))
    add('post-checklist-pratico', 'Post Checklist Prático', 'Redes sociais', lambda: layout_checklist(
        'Checklist Prático', '#f8fafc', '#4f46e5', '#22d3ee', '#0f172a',
        'CHECKLIST DE POST',
        ['Título forte logo na primeira linha',
         'Foto nítida com boa iluminação',
         'Benefício claro e preço visível',
         'Chamada direta para o WhatsApp']))
    add('post-mito-ou-verdade', 'Post Mito vs Verdade', 'Redes sociais', lambda: layout_split_compare(
        'Mito vs Verdade', '#ffffff', '#4338ca', '#10b981', '#0f172a',
        'MITO OU VERDADE?', 'MITO ❌', '• Precisa de câmera cara\n• Estúdio custa caro\n• Só vende com anúncio',
        'VERDADE ✅', '• Celular já resolve bem\n• Boa luz faz mágica\n• Clareza vende todo dia', 'COMPARTILHE SUA OPINIAO'))
    add('post-depoimento-cliente', 'Depoimento 5 Estrelas', 'Redes sociais', lambda: layout_social_testimonial(
        'Depoimento Cliente', '#f5f3ff', '#ffffff', '#6d28d9', '#f59e0b', '#1e1b4b',
        '“O atendimento foi rápido e o resultado final superou tudo o que imaginamos!”', 'Camila Mendes · Cliente verificada'))
    add('post-nota-minimal', 'Post Nota Minimalista', 'Redes sociais', lambda: layout_social_testimonial(
        'Nota Minimalista', '#f1f5f9', '#ffffff', '#0f172a', '#2563eb', '#0f172a',
        'Consistência vale mais que perfeição: publique sua melhor oferta hoje e ajuste no caminho.', '@{{company}}', rating='💡 DICA DO DIA',
        head_font='Montserrat', body_font='Inter'))
    add('capa-youtube-guia', 'Capa YouTube Guia 2026', 'Redes sociais', lambda: layout_youtube_banner(
        'Capa YouTube Guia', 1280, 720, '#09090b', '#dc2626', '#facc15', '#ffffff',
        'PASSO A PASSO', 'GUIA COMPLETO 2026', 'Do zero ao resultado profissional em 10 min'))
    add('capa-youtube-review', 'Capa YouTube Vale a Pena?', 'Redes sociais', lambda: layout_youtube_banner(
        'Capa YouTube Review', 1280, 720, '#0f172a', '#f97316', '#bef264', '#ffffff',
        'ANALISE SINCERA', 'VALE A PENA?', 'Testamos por 30 dias na prática'))
    add('banner-linkedin-capa', 'Capa LinkedIn Executiva', 'Redes sociais', lambda: layout_youtube_banner(
        'Capa LinkedIn', 1584, 396, '#0f172a', '#1e40af', '#38bdf8', '#ffffff',
        'PORTFOLIO & SERVICOS', 'SOLUÇÕES PARA SUA EMPRESA', 'Estratégia · Tecnologia · Resultados'))
    add('frase-noir-impacto', 'Frase Noir Impacto', 'Redes sociais', lambda: layout_reels_cover(
        'Frase Noir', '#09090b', '#27272a', '#facc15',
        'PENSAMENTO DO DIA', 'FEITO É MELHOR QUE PERFEITO', 'Comece hoje com o que você tem'))
    add('post-3-passos-vertical', 'Post 3 Passos Práticos', 'Redes sociais', lambda: layout_story_steps(
        'Post 3 Passos', '#fff7ed', '#ffffff', '#ea580c', '#fde047', '#1c1917',
        '3 Passos', 'Como destacar seu anúncio em minutos',
        [('Foto limpa', 'Remova distrações do fundo'),
         ('Título direto', 'Diga o benefício em até 5 palavras'),
         ('Selo de confiança', 'Adicione garantia ou envio rápido')], 'TESTE AGORA'))

    # ================= 8. SERVIÇOS (14 novos) =================
    add('imobiliaria-imovel-destaque', 'Imobiliária Lançamento', 'Serviços', lambda: layout_bento_product(
        'Imóvel Destaque', '#064e3b', '#065f46', '#10b981', '#fde047', '#ecfdf5',
        'OPORTUNIDADE EXCLUSIVA', 'Apartamento 120m²', ['3 Suítes · Varanda gourmet', '2 Vagas · Lazer completo'], 'R$ 680 mil', 'AGENDAR VISITA',
        dark_canvas=True))
    add('odonto-clinica-sorriso', 'Clínica Odontológica', 'Serviços', lambda: layout_editorial_showcase(
        'Odonto Sorriso', 1080, 1080, '#f0f9ff', '#ffffff', '#0284c7', '#7dd3fc', '#0c4a6e',
        'SAUDE & ESTETICA', 'Sorriso Saudável', 'Clareamento, implantes e check-up preventivo', 'Atendimento humanizado com hora marcada', 'AGENDE'))
    add('academia-matricula-zero', 'Academia Matrícula Grátis', 'Serviços', lambda: layout_diagonal_promo(
        'Academia Matrícula Zero', 1080, 1080, '#09090b', '#84cc16', '#bef264', '#09090b',
        'PLANOS 2026', 'MATRÍCULA ZERO', 'A PARTIR DE R$ 89/MES', 'Musculação, funcional e aulas coletivas inclusas', 'COMECAR HOJE'))
    add('oficina-revisao-auto', 'Oficina Revisão Completa', 'Serviços', lambda: layout_checklist(
        'Oficina Mecânica', '#f1f5f9', '#0f172a', '#f59e0b', '#0f172a',
        'REVISÃO COMPLETA',
        ['Troca de óleo e filtros originais',
         'Alinhamento 3D e balanceamento',
         'Revisão de freios e suspensão',
         'Orçamento transparente antes do serviço'],
        footer='Agende seu horário · {{phone}}'))
    add('curso-online-inscricoes', 'Curso Online Inscrições', 'Serviços', lambda: layout_impact_offer(
        'Curso Online', 1080, 1350, '#eef2ff', '#4f46e5', '#22d3ee', '#1e1b4b', '#ffffff',
        'TURMA ABERTA', 'DOMINE EM 30 DIAS', 'Aulas gravadas + suporte + certificado digital', '100% ON', 'GARANTIR VAGA'))
    add('escritorio-consultoria-pro', 'Consultoria & Advocacia', 'Serviços', lambda: layout_editorial_showcase(
        'Consultoria Especializada', 1080, 1080, '#f8fafc', '#ffffff', '#1e3a8a', '#94a3b8', '#0f172a',
        'ATENDIMENTO PERSONALIZADO', 'Assessoria Sólida', 'Segurança jurídica e planejamento estratégico', 'Consulta inicial presencial ou por vídeo', 'OAB / PRO'))
    add('fotografia-ensaio-agenda', 'Fotografia & Ensaios', 'Serviços', lambda: layout_editorial_showcase(
        'Ensaio Fotográfico', 1080, 1350, '#faf7f2', '#ffffff', '#292524', '#d6d3d1', '#1c1917',
        'ETERNIZE MOMENTOS', 'Ensaios & Retratos', 'Corporativo, família e fotos de produto', 'Entrega em alta resolução em 5 dias', 'RESERVAR'))
    add('assistencia-tecnica-celular', 'Assistência Técnica Express', 'Serviços', lambda: layout_impact_offer(
        'Assistência Técnica', 1080, 1080, '#0f172a', '#0284c7', '#22d3ee', '#f8fafc', '#ffffff',
        'REPARO NO MESMO DIA', 'TROCA DE TELA', 'Peças testadas e garantia de 90 dias no serviço', 'EXPRESS', 'FAZER ORCAMENTO', dark_canvas=True))
    add('pet-banho-tosa-combo', 'Pet Shop Banho & Tosa', 'Serviços', lambda: layout_coupon_frame(
        'Banho & Tosa', '#ecfeff', '#ffffff', '#0891b2', '#fbbf24', '#164e63',
        'PACOTE MENSAL PET', 'MENSAL4X', '20% OFF', '4 banhos + hidratação e tosa higiênica inclusa', 'AGENDAR BUSCA'))
    add('contabilidade-mei-simples', 'Contabilidade MEI & Empresas', 'Serviços', lambda: layout_checklist(
        'Contabilidade Digital', '#f0fdf4', '#15803d', '#bef264', '#14532d',
        'ABRA SUA EMPRESA',
        ['Abertura grátis de CNPJ e MEI',
         'Emissão de notas fiscais simplificada',
         'Impostos em dia sem dor de cabeça',
         'Atendimento direto por contador'],
        footer='Fale conosco · {{email}} · {{phone}}'))
    add('psicologia-atendimento', 'Psicologia Atendimento Online', 'Serviços', lambda: layout_editorial_showcase(
        'Psicologia Clínica', 1080, 1080, '#f4f7f5', '#ffffff', '#3d6b5e', '#a3c4b9', '#1b312b',
        'SAUDE EMOCIONAL', 'Terapia Online', 'Espaço seguro de escuta, acolhimento e cuidado', 'Sessões individuais com horário flexível', 'AGENDE'))
    add('marcenaria-planejados', 'Móveis Planejados 3D', 'Serviços', lambda: layout_bento_product(
        'Móveis Planejados', '#faf6f0', '#ffffff', '#78350f', '#f59e0b', '#292524',
        'SOB MEDIDA PARA VOCE', 'Projeto 3D Grátis', ['MDF 100% naval e ferragens slow', '5 anos de garantia na montagem'], 'ATÉ 18X', 'PEDIR PROJETO'))
    add('energia-solar-economia', 'Energia Solar Economia', 'Serviços', lambda: layout_impact_offer(
        'Energia Solar', 1080, 1080, '#eff6ff', '#1e40af', '#facc15', '#0f172a', '#ffffff',
        'SUSTENTABILIDADE REAL', '-95% NA LUZ', 'Projeto completo aprovado para casa ou comércio', 'SOLAR', 'SIMULAR ECONOMIA'))
    add('agencia-marketing-trafego', 'Agência Tráfego & Social', 'Serviços', lambda: layout_diagonal_promo(
        'Agência Resultados', 1080, 1080, '#09090b', '#7c3aed', '#22d3ee', '#ffffff',
        'CRESCIMENTO DIGITAL', 'MAIS CLIENTES', 'GESTAO DE REDES & ANUNCIOS', 'Conteúdo estratégico + anúncios que convertem', 'SOLICITAR PROPOSTA'))

    # ================= 9. EVENTOS (13 novos + 1 original = 14) =================
    add('workshop-presencial-cert', 'Workshop Prático', 'Eventos', lambda: layout_event_festive(
        'Workshop Prático', 1080, 1350, '#eff6ff', '#1d4ed8', '#facc15', '#0f172a',
        'VAGAS LIMITADAS', 'Workshop Ao Vivo', 'Aprenda na prática com material didático e coffee break',
        'Sábado · 09h às 17h · Certificado incluso', 'INSCREVER-SE AGORA'))
    add('live-instagram-convite', 'Convite Live Hoje 20h', 'Eventos', lambda: layout_event_festive(
        'Live Hoje 20h', 1080, 1080, '#18181b', '#e11d48', '#facc15', '#ffffff',
        'AO VIVO HOJE · 20H', 'Super Live', 'Bastidores, demonstração ao vivo e cupom secreto no chat',
        'Não vai ficar salva · Participe ao vivo', 'ATIVAR LEMBRETE', dark_canvas=True))
    add('horario-atendimento-loja', 'Horário de Atendimento', 'Eventos', lambda: layout_checklist(
        'Horário de Atendimento', '#f8fafc', '#1e293b', '#38bdf8', '#0f172a',
        'HORÁRIO DA LOJA',
        ['Segunda a Sexta: 09h00 às 18h00',
         'Sábados: 09h00 às 13h00',
         'Loja online aberta 24 horas',
         'Suporte WhatsApp: {{phone}}']))
    add('comunicado-feriado-aviso', 'Comunicado de Feriado', 'Eventos', lambda: layout_event_festive(
        'Aviso de Feriado', 1080, 1080, '#fffbeb', '#b45309', '#f59e0b', '#292524',
        'COMUNICADO IMPORTANTE', 'Feriado', 'Estaremos em pausa neste feriado para recarregar as energias.',
        'Retornamos o atendimento normal no próximo dia útil', 'COMPRAS NO SITE 24H'))
    add('natal-boas-festas', 'Boas Festas & Natal', 'Eventos', lambda: layout_event_festive(
        'Boas Festas Natal', 1080, 1080, '#064e3b', '#dc2626', '#fbbf24', '#ecfdf5',
        'COM CARINHO', 'Feliz Natal!', 'Que a magia desta época ilumine seu lar com paz e alegria.',
        'Agradecemos pela confiança em todo o ano', 'BOAS FESTAS', head_font='Playfair Display', dark_canvas=True))
    add('ano-novo-gratidao', 'Feliz Ano Novo', 'Eventos', lambda: layout_event_festive(
        'Feliz Ano Novo', 1080, 1350, '#0f172a', '#3b82f6', '#facc15', '#f8fafc',
        'NOVO CICLO', 'Feliz Ano Novo!', 'Que 2027 venha repleto de saúde, conquistas e novos projetos.',
        'Seguimos juntos no próximo ano', 'OBRIGADO POR TUDO', head_font='Playfair Display', dark_canvas=True))
    add('dia-das-maes-presente', 'Especial Dia das Mães', 'Eventos', lambda: layout_editorial_showcase(
        'Dia das Mães', 1080, 1080, '#fff1f2', '#ffffff', '#9d174d', '#f9a8d4', '#4a044e',
        'PARA QUEM MERECE TUDO', 'Dia das Mães', 'Kits presenteáveis com embrulho especial grátis',
        'Garanta o pedido com antecedência', 'COM AMOR'))
    add('dia-dos-namorados-amor', 'Dia dos Namorados', 'Eventos', lambda: layout_event_festive(
        'Dia dos Namorados', 1080, 1080, '#4c0519', '#e11d48', '#fda4af', '#fff1f2',
        '12 DE JUNHO', 'Surpreenda Quem Ama', 'Presentes especiais com entrega agendada para a data',
        'Cartão dedicado grátis em todos os kits', 'ESCOLHER PRESENTE', head_font='Dancing Script', dark_canvas=True))
    add('dia-dos-pais-estilo', 'Especial Dia dos Pais', 'Eventos', lambda: layout_impact_offer(
        'Dia dos Pais', 1080, 1080, '#f1f5f9', '#1e3a8a', '#f59e0b', '#0f172a', '#ffffff',
        'ESPECIAL PARA ELE', 'DIA DOS PAIS', 'Presentes úteis e duráveis para todos os estilos', 'GIFT', 'VER SUGESTOES'))
    add('pascoa-encomendas-ovos', 'Páscoa Artesanal', 'Eventos', lambda: layout_editorial_showcase(
        'Páscoa Artesanal', 1080, 1080, '#fdf8f3', '#ffffff', '#78350f', '#fbbf24', '#451a03',
        'ENCOMENDAS ABERTAS', 'Páscoa Doce', 'Ovos de colher e trufas com chocolate nobre',
        'Reserve até quinta-feira para garantir o seu', 'LIMITADO'))
    add('arraia-festa-junina', 'Arraiá Ofertas Juninas', 'Eventos', lambda: layout_event_festive(
        'Arraiá Junino', 1080, 1350, '#fff7ed', '#dc2626', '#facc15', '#292524',
        'FESTANCA DE OFERTAS', 'Arraiá da Loja!', 'Brincadeiras, brindes e descontos especiais o mês todo',
        'Venha aproveitar com toda a família', 'OLHA O DESCONTO!'))
    add('inauguracao-nova-loja', 'Grande Inauguração', 'Eventos', lambda: layout_event_festive(
        'Grande Inauguração', 1080, 1080, '#111827', '#eab308', '#facc15', '#f8fafc',
        'CONVITE ESPECIAL', 'Inauguração!', 'Venha conhecer nosso novo espaço com coquetel e brindes',
        'Sábado às 10h · Primeiros 50 ganham presente', 'CONFIRMAR PRESENCA', dark_canvas=True))
    add('aniversario-loja-festa', 'Aniversário da Loja', 'Eventos', lambda: layout_impact_offer(
        'Aniversário da Loja', 1080, 1080, '#f5f3ff', '#7c3aed', '#facc15', '#1e1b4b', '#ffffff',
        'FESTA COM CLIENTES', 'ANIVERSÁRIO', 'Quem faz aniversário somos nós, o presente é seu', 'BRINDE', 'RESGATAR BRINDE'))

    return items
