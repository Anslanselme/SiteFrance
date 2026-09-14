# -*- coding: utf-8 -*-
"""
Genere un fichier CSV au format "flux de produits" attendu par le
Commerce Manager de Facebook, a partir de catalog.json (source de verite
deja utilisee par le site et par Stripe).

Usage :
    python generate_facebook_feed.py

Produit : facebook-catalog.csv, a la racine du projet.
"""

import csv
import json
import os

BASE_URL = "https://site-france-orpin.vercel.app"

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "catalog.json"), encoding="utf-8") as f:
    catalog = json.load(f)

DESCRIPTIONS = {
    "fr": "Drapeau français en polyester, œillets métalliques, plusieurs tailles disponibles.",
    "stickers": "Pack de 50 autocollants waterproof à thème voyage France, motifs variés.",
    "pins": "Pin's émaillé drapeau français, plusieurs quantités disponibles.",
}
DEFAULT_REGION_DESC = "Drapeau régional en polyester, œillets métalliques, huit tailles disponibles."
DEFAULT_POSTER_DESC = "Reproduction d'époque grand format, huit formats disponibles. Cadre non inclus."

rows = []
for key, product in catalog.items():
    if key.startswith("poster-"):
        description = DEFAULT_POSTER_DESC
    elif key in DESCRIPTIONS:
        description = DESCRIPTIONS[key]
    else:
        description = DEFAULT_REGION_DESC

    for size in product["sizes"]:
        title = f'{product["name"]} — {size["label"]}' if size["label"] else product["name"]
        rows.append({
            "id": size["ref"],
            "title": title,
            "description": description,
            "availability": "in stock",
            "condition": "new",
            "price": f'{size["price"]:.2f} EUR',
            "link": f"{BASE_URL}/#boutique",
            "image_link": f"{BASE_URL}/img/{product['image']}",
            "brand": "FortDébat",
            "item_group_id": key,
            "size": size["label"] or "unique",
        })

out_path = os.path.join(HERE, "facebook-catalog.csv")
with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "id", "title", "description", "availability", "condition",
        "price", "link", "image_link", "brand", "item_group_id", "size",
    ])
    writer.writeheader()
    writer.writerows(rows)

print(f"{len(rows)} lignes écrites dans {out_path}")
