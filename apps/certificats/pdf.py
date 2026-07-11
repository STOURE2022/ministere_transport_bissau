"""Génération du QR code et du PDF du certificat (Pillow, sans dépendance externe)."""
from __future__ import annotations

from io import BytesIO

import qrcode
from PIL import Image, ImageDraw, ImageFont

# Palette institutionnelle (cohérente avec la maquette).
BLEU = (18, 56, 110)
OR = (184, 137, 31)
ENCRE = (15, 27, 45)
GRIS = (90, 107, 130)
FAINT = (132, 148, 169)


def _font(taille: int):
    """Police scalable intégrée à Pillow (portable, sans fichier externe)."""
    try:
        return ImageFont.load_default(size=taille)
    except TypeError:  # Pillow ancien : police bitmap non dimensionnable
        return ImageFont.load_default()


def generer_qr_image(payload: str, taille: int = 300) -> Image.Image:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((taille, taille))


def rendre_certificat_pdf(certificat) -> bytes:
    """Compose le certificat A4 (portrait, 150 dpi) et le renvoie en PDF."""
    W, H = 1240, 1754
    snap = certificat.donnees_snapshot
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    # En-tête institutionnel
    d.rectangle([0, 0, W, 210], fill=BLEU)
    d.text((70, 55), "RÉPUBLIQUE DE GUINÉE-BISSAU", font=_font(30), fill=(185, 203, 230))
    d.text((70, 100), "Certificat d'immatriculation", font=_font(46), fill="white")
    d.text((72, 158), "Système National — SNICV", font=_font(24), fill=(185, 203, 230))
    d.rectangle([0, 210, W, 220], fill=OR)  # filet doré

    # Plaque
    plaque = snap.get("immatriculation", "—")
    d.rectangle([70, 280, 620, 380], outline=ENCRE, width=4)
    d.text((100, 300), f"GW  {plaque}", font=_font(52), fill=ENCRE)

    # Champs
    lignes = [
        ("Propriétaire", snap.get("proprietaire", "—")),
        ("Marque / Modèle", f"{snap.get('marque', '')} {snap.get('modele', '')}".strip()),
        ("Année · Énergie", f"{snap.get('annee', '')} · {snap.get('energie', '')}"),
        ("Type de véhicule", snap.get("type", "—")),
        ("Assurance (échéance)", snap.get("assurance_echeance") or "—"),
        ("Contrôle technique", snap.get("ct_echeance") or "—"),
        ("N° de dossier", snap.get("numero_dossier", "—")),
        ("UUID véhicule", snap.get("uuid_vehicule", "—")),
    ]
    y = 440
    for label, valeur in lignes:
        d.text((70, y), label.upper(), font=_font(20), fill=FAINT)
        d.text((70, y + 28), str(valeur), font=_font(30), fill=ENCRE)
        y += 92

    # QR + mentions de sécurité
    qr = generer_qr_image(certificat.qr_payload, taille=320)
    img.paste(qr, (W - 400, 470))
    d.text((W - 400, 800), "Scannez pour vérifier", font=_font(22), fill=GRIS)

    d.rectangle([70, 1560, W - 70, 1564], fill=(227, 233, 243))
    d.text((70, 1600),
           f"Émis le {snap.get('date_emission', '')[:10]} · Empreinte SHA-256 :",
           font=_font(20), fill=GRIS)
    d.text((70, 1632), certificat.hash_sha256, font=_font(18), fill=ENCRE)
    d.text((70, 1680),
           "Signé numériquement par le SNICV (RSA-2048). Toute altération invalide la signature.",
           font=_font(20), fill=GRIS)

    buffer = BytesIO()
    img.save(buffer, "PDF", resolution=150.0)
    return buffer.getvalue()
