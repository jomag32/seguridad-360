# Genera los íconos de la PWA (escudo Tecnología ARME, azul #0b3d6b, «360»). Uso: python3 scripts/iconos.py
from PIL import Image, ImageDraw, ImageFont
import os
AZUL, BLANCO, NARANJA = (11, 61, 107), (255, 255, 255), (245, 130, 32)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "iconos")
def fuente(t):
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(f): return ImageFont.truetype(f, t)
    return ImageFont.load_default()
def icono(n, maskable=False, redondo=True):
    S = 1024; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if maskable or not redondo: d.rectangle([0, 0, S, S], fill=AZUL)
    else: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=200, fill=AZUL)
    k = 0.62 if maskable else 0.8; w = S * k; x0 = (S - w) / 2; y0 = (S - w * 1.1) / 2 + 20; h = w * 1.1
    esc = [(x0, y0 + h * .12), (S / 2, y0), (x0 + w, y0 + h * .12), (x0 + w, y0 + h * .5), (S / 2, y0 + h), (x0, y0 + h * .5)]
    d.polygon(esc, fill=BLANCO)
    i = [(S/2 + (px - S/2) * .86, y0 + h*.47 + (py - y0 - h*.47) * .86) for px, py in esc]
    d.polygon(i, fill=NARANJA)
    f = fuente(int(w * .3)); t = "360"; b = d.textbbox((0, 0), t, font=f)
    d.text((S / 2 - (b[2] - b[0]) / 2 - b[0], y0 + h * .44 - (b[3] - b[1]) / 2 - b[1]), t, font=f, fill=BLANCO)
    return im.resize((n, n), Image.LANCZOS)
icono(192).save(f"{OUT}/icono-192.png"); icono(512).save(f"{OUT}/icono-512.png")
icono(192, True).save(f"{OUT}/icono-maskable-192.png"); icono(512, True).save(f"{OUT}/icono-maskable-512.png")
icono(180, redondo=False).convert("RGB").save(f"{OUT}/apple-touch-icon.png"); icono(32).save(f"{OUT}/favicon-32.png")
