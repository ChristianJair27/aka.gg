# scripts/process-logo.py
# Procesa el logo fuente en los assets de marca:
#   - atak-logo-mark.png  : daga recortada con fondo transparente (navbar, cards)
#   - favicon-32/64/512   : icono cuadrado centrado
#   - og-image.png        : 1200x630 oscura con daga + wordmark Friz Quadrata
# Fuente: public/ATAK-LOGO-SINFONDO.png (transparencia nativa, preferida) o
# public/atak-logoHD.png (fondo blanco → se remueve por flood-fill de bordes).
# Uso: python scripts/process-logo.py   (correr desde aka.gg/)
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from collections import deque
import os

PUB = os.path.join(os.path.dirname(__file__), '..', 'public')
SRC_CANDIDATES = ['ATAK-LOGO-SINFONDO.png', 'atak-logoHD.png']
SRC = next(os.path.join(PUB, n) for n in SRC_CANDIDATES if os.path.exists(os.path.join(PUB, n)))
RED = (225, 36, 46)

img = Image.open(SRC).convert('RGBA')
W, H = img.size

# ¿Ya viene con fondo transparente? (>5% de píxeles con alfa 0) → no tocar.
already_transparent = img.getchannel('A').histogram()[0] > (W * H) * 0.05
print('src:', os.path.basename(SRC), '| transparente nativo:', already_transparent)

if not already_transparent:
    # Quitar fondo: BFS desde los bordes sobre píxeles casi-blancos. Solo se
    # vuelve transparente el blanco CONECTADO al borde: los plateados y blancos
    # internos de la daga (no conectados) se conservan.
    px = img.load()

    def is_bg(r, g, b):
        return min(r, g, b) > 198 and (max(r, g, b) - min(r, g, b)) < 26

    seen = bytearray(W * H)
    q = deque()
    for x in range(W):
        q.append((x, 0)); q.append((x, H - 1))
    for y in range(H):
        q.append((0, y)); q.append((W - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= W or y >= H:
            continue
        i = y * W + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Suavizar el borde del alfa (anti-alias del recorte)
    img.putalpha(img.getchannel('A').filter(ImageFilter.GaussianBlur(1.2)))

# ── Recorte al contenido + marca base ────────────────────────────────────────
mark = img.crop(img.getbbox())
mw, mh = mark.size
if max(mw, mh) > 1024:
    s = 1024 / max(mw, mh)
    mark = mark.resize((round(mw * s), round(mh * s)), Image.LANCZOS)
mark.save(os.path.join(PUB, 'atak-logo-mark.png'))
print('mark:', mark.size)

# ── Favicons (cuadrados, daga centrada con margen 8%) ────────────────────────
for size in (512, 64, 32):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = round(size * 0.92)
    s = min(inner / mark.width, inner / mark.height)
    rs = mark.resize((max(1, round(mark.width * s)), max(1, round(mark.height * s))), Image.LANCZOS)
    canvas.alpha_composite(rs, ((size - rs.width) // 2, (size - rs.height) // 2))
    canvas.save(os.path.join(PUB, f'favicon-{size}.png'))
print('favicons ok')

# ── OG image 1200x630 (marca sobre fondo oscuro con glow rojo) ───────────────
og = Image.new('RGB', (1200, 630), (10, 10, 12))
glow = Image.new('RGB', (1200, 630), (10, 10, 12))
gd = ImageDraw.Draw(glow)
gd.ellipse((640, -180, 1420, 520), fill=(64, 14, 17))
glow = glow.filter(ImageFilter.GaussianBlur(120))
og = Image.blend(og, glow, 0.85)

dg = mark.copy()
s = 500 / dg.height
dg = dg.resize((round(dg.width * s), 500), Image.LANCZOS)
og_rgba = og.convert('RGBA')
og_rgba.alpha_composite(dg, (1200 - dg.width - 40, 70))

draw = ImageDraw.Draw(og_rgba)
F = os.path.join(PUB, 'fonts')
try:
    f_big = ImageFont.truetype(os.path.join(F, 'friz-quadrata-bold.otf'), 118)
    f_sub = ImageFont.truetype(os.path.join(F, 'friz-quadrata-regular.ttf'), 34)
except OSError:
    f_big = ImageFont.load_default()
    f_sub = ImageFont.load_default()

x0, y0 = 70, 210
draw.text((x0, y0), 'ATAK', font=f_big, fill=(255, 255, 255))
w_atak = draw.textlength('ATAK', font=f_big)
draw.text((x0 + w_atak + 8, y0), '.GG', font=f_big, fill=RED)
draw.rectangle((x0 + 4, y0 + 150, x0 + 168, y0 + 156), fill=RED)
draw.text((x0 + 4, y0 + 178), 'Stats y torneos de League of Legends', font=f_sub, fill=(200, 200, 205))
draw.text((x0 + 4, y0 + 228), 'Sin anuncios · 100% en tu navegador', font=f_sub, fill=(140, 140, 148))

og_rgba.convert('RGB').save(os.path.join(PUB, 'og-image.png'), quality=92)
print('og-image ok')
