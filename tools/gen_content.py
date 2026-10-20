"""Gera o conteúdo do editor em app/src/main/assets/content/ (ARQUITETURA §8 e §15.2).

Tudo aqui é feito por nós: templates (documentos `pp-editor` com JSON do Fabric 7), adesivos SVG e
fundos. As fontes OFL ficam em content/fonts/<Família>/ (baixadas do google/fonts, com o OFL.txt);
este script só as lista. Rodar: python tools/gen_content.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'app' / 'src' / 'main' / 'assets' / 'content'

# família, pasta, faixa de peso (eixo wght do fvar, conferido em 2026-10-14) e categoria
FONTS = [
    ('Montserrat', 'Montserrat', '100 900', 'Sem serifa'),
    ('Inter', 'Inter', '100 900', 'Sem serifa'),
    ('Open Sans', 'OpenSans', '300 800', 'Sem serifa'),
    ('Nunito', 'Nunito', '200 1000', 'Sem serifa'),
    ('Raleway', 'Raleway', '100 900', 'Sem serifa'),
    ('Oswald', 'Oswald', '200 700', 'Condensada'),
    ('Bebas Neue', 'BebasNeue', '400', 'Condensada'),
    ('Anton', 'Anton', '400', 'Condensada'),
    ('Playfair Display', 'PlayfairDisplay', '400 900', 'Serifa'),
    ('Lobster', 'Lobster', '400', 'Decorativa'),
    ('Pacifico', 'Pacifico', '400', 'Manuscrita'),
    ('Dancing Script', 'DancingScript', '400 700', 'Manuscrita'),
]


# ---------------- helpers de objetos Fabric (origem padrão do Fabric 7 = centro) ----------------

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
    o = {'type': 'Textbox', 'left': cx, 'top': cy, 'width': w, 'text': s, 'fontSize': size, 'fontFamily': font,
         'fontWeight': weight, 'fill': fill, 'textAlign': align, 'lineHeight': 1.15}
    if role:
        o['brandColor'] = role
    if font_role:
        o['brandFont'] = font_role
    o.update(kw)
    return o


def star_points(n, outer, inner):
    import math
    pts = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = math.pi * i / n - math.pi / 2
        pts.append({'x': round(r * math.cos(a), 2), 'y': round(r * math.sin(a), 2)})
    return pts


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


# ---------------- templates ----------------

def t_sale():
    return doc('Promoção', 1080, 1080, '#fff4e6', [
        circle(540, 470, 330, '#ff7a00', 'primary'),
        polygon(860, 220, star_points(14, 150, 120), '#ffd23f', 'accent'),
        text(860, 222, 220, '-30%', 74, 'Anton', '#222222', role='text', font_role='heading'),
        text(540, 380, 600, 'OFERTA', 150, 'Bebas Neue', '#ffffff', font_role='heading'),
        text(540, 520, 560, 'da semana', 64, 'Pacifico', '#ffffff'),
        text(540, 870, 900, '{{company}}', 64, 'Montserrat', '#222222', 800, role='text', font_role='heading'),
        text(540, 960, 900, '{{phone}}  ·  {{website}}', 34, 'Montserrat', '#444444', 500, font_role='body'),
    ])


def t_launch_story():
    return doc('Lançamento', 1080, 1920, '#101820', [
        rect(540, 300, 1080, 600, '#1f6feb', 'primary'),
        text(540, 200, 900, 'NOVIDADE', 150, 'Anton', '#ffffff', font_role='heading', charSpacing=80),
        text(540, 340, 860, 'Chegou o que você esperava', 56, 'Montserrat', '#ffffff', 600, font_role='body'),
        rect(540, 1010, 820, 820, '#ffffff', None, 40, stroke='#ffffff', strokeWidth=0, opacity=0.12),
        text(540, 1010, 700, 'Toque em Imagem para pôr a foto do produto aqui', 44, 'Montserrat', '#c9d1d9', 500),
        rect(540, 1600, 640, 140, '#ffd23f', 'accent', 70),
        text(540, 1600, 600, 'Compre agora', 60, 'Montserrat', '#101820', 800, font_role='heading'),
        text(540, 1780, 900, '{{company}} · {{website}}', 38, 'Montserrat', '#c9d1d9', 500, font_role='body'),
    ])


def t_menu():
    items = [('Café expresso', 'R$ 6,00'), ('Cappuccino', 'R$ 9,50'), ('Pão de queijo', 'R$ 5,00'),
             ('Bolo do dia', 'R$ 8,00'), ('Suco natural', 'R$ 10,00'), ('Sanduíche natural', 'R$ 14,00')]
    objs = [
        rect(620, 180, 1240, 360, '#3e2723', 'primary'),
        text(620, 150, 1100, 'Cardápio', 150, 'Playfair Display', '#ffffff', 800, font_role='heading'),
        text(620, 270, 1100, '{{company}}', 52, 'Raleway', '#ffe0b2', 500, font_role='body'),
    ]
    y = 520
    for name, price in items:
        objs.append(text(450, y, 640, name, 56, 'Raleway', '#3e2723', 600, role='text', font_role='body', align='left'))
        objs.append(text(1000, y, 300, price, 56, 'Raleway', '#bf360c', 700, role='secondary', font_role='body', align='right'))
        objs.append(rect(620, y + 70, 1000, 3, '#d7ccc8'))
        y += 170
    objs.append(text(620, 1640, 1100, '{{address}}  ·  {{phone}}', 40, 'Raleway', '#5d4037', 500, font_role='body'))
    return doc('Cardápio', 1240, 1754, '#fff8f0', objs)


def t_event():
    return doc('Evento', 1080, 1350, '#1a1a2e', [
        circle(900, 180, 260, '#e94560', 'primary', opacity=0.9),
        circle(160, 1220, 200, '#0f3460', 'secondary'),
        text(300, 260, 420, '25', 260, 'Anton', '#ffffff', font_role='heading', align='left'),
        text(300, 430, 420, 'NOVEMBRO · 19h', 48, 'Oswald', '#e94560', 600, role='primary', font_role='body', align='left'),
        text(540, 700, 920, 'Noite de lançamento', 110, 'Playfair Display', '#ffffff', 800, font_role='heading'),
        text(540, 900, 860, 'Música ao vivo, degustação e sorteios', 46, 'Open Sans', '#d0d0e0', 500, font_role='body'),
        text(540, 1130, 860, '{{address}}', 40, 'Open Sans', '#ffffff', 600, font_role='body'),
        text(540, 1200, 860, '{{company}}', 40, 'Open Sans', '#e94560', 700, role='primary', font_role='body'),
    ])


def t_logo():
    return doc('Logo', 1000, 1000, '#ffffff', [
        circle(500, 400, 230, '#2e7d32', 'primary'),
        circle(500, 400, 195, '#ffffff', None, opacity=0.15),
        text(500, 400, 400, 'A', 260, 'Playfair Display', '#ffffff', 900, font_role='heading'),
        text(500, 740, 900, '{{company}}', 96, 'Montserrat', '#1b1b1b', 800, role='text', font_role='heading', charSpacing=40),
        text(500, 840, 900, '{{slogan}}', 44, 'Montserrat', '#555555', 400, font_role='body'),
    ])


def t_card():
    return doc('Cartão de visita', 1050, 600, '#ffffff', [
        rect(150, 300, 300, 600, '#263238', 'primary'),
        circle(150, 300, 90, '#ffffff', None, opacity=0.18),
        text(150, 300, 200, 'logo', 40, 'Montserrat', '#ffffff', 700),
        text(690, 170, 640, '{{company}}', 58, 'Montserrat', '#263238', 800, role='text', font_role='heading', align='left'),
        text(690, 240, 640, '{{slogan}}', 30, 'Montserrat', '#607d8b', 500, font_role='body', align='left'),
        rect(690, 300, 640, 3, '#ff7043', 'accent'),
        text(690, 370, 640, '{{phone}}', 32, 'Open Sans', '#263238', 600, font_role='body', align='left'),
        text(690, 425, 640, '{{email}}', 32, 'Open Sans', '#263238', 400, font_role='body', align='left'),
        text(690, 480, 640, '{{website}}', 32, 'Open Sans', '#263238', 400, font_role='body', align='left'),
    ])


def t_quote():
    return doc('Frase', 1080, 1350, '#f3e5f5', [
        text(540, 300, 400, '“', 400, 'Playfair Display', '#8e24aa', 900, role='primary', font_role='heading'),
        text(540, 640, 860, 'Qualidade é fazer certo quando ninguém está olhando.', 76, 'Playfair Display', '#311b92',
             700, role='text', font_role='heading'),
        rect(540, 900, 160, 6, '#8e24aa', 'primary'),
        text(540, 980, 860, '{{company}}', 44, 'Nunito', '#4a148c', 700, font_role='body'),
    ])


def t_hiring():
    return doc('Aviso', 1920, 1080, '#ffffff', [
        rect(480, 540, 960, 1080, '#ffca28', 'accent'),
        text(480, 420, 800, 'Estamos', 120, 'Montserrat', '#212121', 500, font_role='heading'),
        text(480, 560, 800, 'CONTRATANDO', 140, 'Anton', '#212121', font_role='heading'),
        text(1400, 400, 860, 'Vagas abertas', 80, 'Montserrat', '#212121', 800, role='text', font_role='heading', align='left'),
        text(1400, 560, 860, '• Atendimento\n• Caixa\n• Estoque', 56, 'Montserrat', '#424242', 500, font_role='body', align='left'),
        text(1400, 820, 860, 'Envie seu currículo: {{email}}', 44, 'Montserrat', '#212121', 600, font_role='body', align='left'),
        text(1400, 900, 860, '{{company}}', 44, 'Montserrat', '#757575', 600, font_role='body', align='left'),
    ])


TEMPLATES = [
    ('promo-quadrado', 'Promoção', 'Vendas', t_sale),
    ('lancamento-story', 'Lançamento (story)', 'Vendas', t_launch_story),
    ('cardapio-a4', 'Cardápio', 'Comida', t_menu),
    ('evento-retrato', 'Evento', 'Eventos', t_event),
    ('logo-circulo', 'Logo', 'Marca', t_logo),
    ('cartao-visita', 'Cartão de visita', 'Marca', t_card),
    ('frase-retrato', 'Frase', 'Redes sociais', t_quote),
    ('aviso-banner', 'Aviso (banner)', 'Redes sociais', t_hiring),
]

# ---------------- adesivos (SVG feitos à mão) ----------------

def svg(body, w=200, h=200):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>\n'


def burst(fill, label, color='#ffffff', size=34):
    pts = ' '.join(f"{p['x'] + 100:.1f},{p['y'] + 100:.1f}" for p in star_points(16, 96, 80))
    return svg(f'<polygon points="{pts}" fill="{fill}"/>'
               f'<text x="100" y="{100 + size * 0.35:.0f}" font-family="sans-serif" font-weight="800" font-size="{size}" '
               f'fill="{color}" text-anchor="middle">{label}</text>')


STICKERS = [
    ('selo-oferta', 'Oferta', 'Selos', burst('#e53935', 'OFERTA')),
    ('selo-novo', 'Novo', 'Selos', burst('#1e88e5', 'NOVO', size=44)),
    ('selo-50', '-50%', 'Selos', burst('#fdd835', '-50%', '#212121', 48)),
    ('selo-gratis', 'Frete grátis', 'Selos', svg(
        '<rect x="6" y="56" width="188" height="88" rx="44" fill="#43a047"/>'
        '<text x="100" y="94" font-family="sans-serif" font-weight="800" font-size="26" fill="#fff" text-anchor="middle">FRETE</text>'
        '<text x="100" y="126" font-family="sans-serif" font-weight="800" font-size="26" fill="#fff" text-anchor="middle">GRÁTIS</text>')),
    ('fita', 'Faixa', 'Selos', svg(
        '<path d="M10 60 H190 L170 100 L190 140 H10 L30 100 Z" fill="#8e24aa"/>', 200, 200)),
    ('estrela', 'Estrela', 'Formas', svg(
        '<polygon points="' + ' '.join(f"{p['x'] + 100:.1f},{p['y'] + 104:.1f}" for p in star_points(5, 92, 40)) + '" fill="#ffb300"/>')),
    ('coracao', 'Coração', 'Formas', svg(
        '<path d="M100 178 C40 130 8 98 8 62 C8 32 32 12 60 12 C78 12 92 22 100 36 C108 22 122 12 140 12 '
        'C168 12 192 32 192 62 C192 98 160 130 100 178 Z" fill="#e91e63"/>')),
    ('balao', 'Balão de fala', 'Formas', svg(
        '<path d="M20 20 H180 Q190 20 190 30 V130 Q190 140 180 140 H80 L40 180 L50 140 H20 Q10 140 10 130 V30 Q10 20 20 20 Z" '
        'fill="#ffffff" stroke="#212121" stroke-width="6"/>')),
    ('brilho', 'Brilho', 'Formas', svg(
        '<path d="M100 10 C108 70 130 92 190 100 C130 108 108 130 100 190 C92 130 70 108 10 100 C70 92 92 70 100 10 Z" fill="#ffd54f"/>')),
    ('seta-curva', 'Seta', 'Ícones', svg(
        '<path d="M30 160 C40 80 100 50 150 60" fill="none" stroke="#212121" stroke-width="12" stroke-linecap="round"/>'
        '<path d="M130 30 L170 62 L128 88" fill="none" stroke="#212121" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>')),
    ('check', 'Confere', 'Ícones', svg(
        '<circle cx="100" cy="100" r="90" fill="#43a047"/>'
        '<path d="M55 102 L88 135 L148 70" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>')),
    ('pino', 'Localização', 'Ícones', svg(
        '<path d="M100 190 C60 130 36 100 36 72 C36 36 64 10 100 10 C136 10 164 36 164 72 C164 100 140 130 100 190 Z" fill="#e53935"/>'
        '<circle cx="100" cy="72" r="26" fill="#fff"/>')),
    ('telefone', 'Telefone', 'Ícones', svg(
        '<circle cx="100" cy="100" r="90" fill="#1e88e5"/>'
        '<path d="M70 50 L88 50 L96 78 L84 88 C92 106 104 118 122 126 L132 114 L160 122 L160 140 '
        'C160 150 152 156 142 156 C94 152 54 112 50 64 C50 56 58 50 70 50 Z" fill="#fff"/>')),
    ('carrinho', 'Carrinho', 'Ícones', svg(
        '<path d="M20 40 H48 L70 130 H160 L180 66 H58" fill="none" stroke="#212121" stroke-width="12" '
        'stroke-linejoin="round" stroke-linecap="round"/><circle cx="80" cy="162" r="14" fill="#212121"/>'
        '<circle cx="150" cy="162" r="14" fill="#212121"/>')),
    ('coroa', 'Coroa', 'Ícones', svg(
        '<path d="M20 150 L30 60 L70 100 L100 40 L130 100 L170 60 L180 150 Z" fill="#ffb300"/>'
        '<rect x="20" y="152" width="160" height="22" rx="6" fill="#ff8f00"/>')),
]

BACKGROUNDS = [
    ('branco', 'Branco', 'solid', ['#ffffff']),
    ('creme', 'Creme', 'solid', ['#fff8e1']),
    ('grafite', 'Grafite', 'solid', ['#263238']),
    ('preto', 'Preto', 'solid', ['#111111']),
    ('por-do-sol', 'Pôr do sol', 'linear', ['#ff9a8b', '#ff6a88', '#ff99ac']),
    ('oceano', 'Oceano', 'linear', ['#2193b0', '#6dd5ed']),
    ('menta', 'Menta', 'linear', ['#d4fc79', '#96e6a1']),
    ('uva', 'Uva', 'linear', ['#7f00ff', '#e100ff']),
    ('noite', 'Noite', 'linear', ['#0f2027', '#203a43', '#2c5364']),
    ('pessego', 'Pêssego', 'linear', ['#ffecd2', '#fcb69f']),
    ('holofote', 'Holofote', 'radial', ['#ffffff', '#cfd8dc']),
    ('palco', 'Palco', 'radial', ['#37474f', '#000000']),
]


def main():
    tdir = CONTENT / 'templates'
    sdir = CONTENT / 'stickers'
    tdir.mkdir(parents=True, exist_ok=True)
    sdir.mkdir(parents=True, exist_ok=True)
    index = {'version': 1, 'fonts': [], 'templates': [], 'stickers': [], 'backgrounds': []}
    for family, folder, weight, cat in FONTS:
        f = CONTENT / 'fonts' / folder / f'{folder}.ttf'
        assert f.exists() and (f.parent / 'OFL.txt').exists(), f
        index['fonts'].append({'family': family, 'file': f'fonts/{folder}/{folder}.ttf', 'weight': weight, 'category': cat})
    used = {fam for fam, *_ in FONTS}
    for tid, name, cat, fn in TEMPLATES:
        d = fn()
        for o in d['fabric']['objects']:
            assert o.get('fontFamily', 'Montserrat') in used, (tid, o.get('fontFamily'))
        (tdir / f'{tid}.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding='utf-8')
        index['templates'].append({'id': tid, 'name': name, 'category': cat, 'file': f'templates/{tid}.json'})
    for sid, name, cat, body in STICKERS:
        (sdir / f'{sid}.svg').write_text(body, encoding='utf-8')
        index['stickers'].append({'id': sid, 'name': name, 'category': cat, 'file': f'stickers/{sid}.svg'})
    for bid, name, kind, colors in BACKGROUNDS:
        index['backgrounds'].append({'id': bid, 'name': name, 'kind': kind, 'colors': colors, 'angle': 90})
    (CONTENT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"{len(index['fonts'])} fontes, {len(index['templates'])} templates, {len(index['stickers'])} adesivos, "
          f"{len(index['backgrounds'])} fundos")


if __name__ == '__main__':
    main()
