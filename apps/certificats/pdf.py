"""
Génération du QR code et du PDF du certificat.

Le PDF est composé en **vectoriel** avec ReportLab (texte net et sélectionnable,
accents corrects via l'encodage WinAnsi des polices standard). Le QR est produit
avec la librairie `qrcode` (image PIL) puis intégré au document.
"""
from __future__ import annotations

import math
from io import BytesIO

import qrcode
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

# ── Palette institutionnelle (cohérente avec le front) ──
BLEU = HexColor("#12386e")
BLEU_CLAIR = HexColor("#1e5aa8")
BLEU_PALE = HexColor("#eaf1fb")
BLEU_TEXTE = HexColor("#b9cbe6")
OR = HexColor("#b8891f")
OR_CLAIR = HexColor("#d8b45e")
ENCRE = HexColor("#0f1b2d")
GRIS = HexColor("#5a6b82")
FAINT = HexColor("#8494a9")
BORD = HexColor("#e3e9f3")
BLANC = HexColor("#ffffff")

W, H = A4  # 595.27 × 841.89 pt


# ─────────────────────────────── QR ───────────────────────────────

def generer_qr_image(payload: str, taille: int = 300) -> Image.Image:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    return (
        qr.make_image(fill_color="#12386e", back_color="white")
        .convert("RGB")
        .resize((taille, taille), Image.NEAREST)
    )


# ─────────────────────────── primitives dessin ───────────────────────────

def _y(top: float) -> float:
    """Convertit une ordonnée « depuis le haut » en coordonnée ReportLab (bas-gauche)."""
    return H - top


def _texte(c, x, top, txt, police="Helvetica", taille=10, couleur=ENCRE, tracking=0.0):
    if tracking:
        to = c.beginText(x, _y(top))
        to.setFont(police, taille)
        to.setFillColor(couleur)
        to.setCharSpace(tracking)
        to.textOut(txt)
        c.drawText(to)
    else:
        c.setFont(police, taille)
        c.setFillColor(couleur)
        c.drawString(x, _y(top), txt)


def _texte_centre(c, cx, top, txt, police="Helvetica", taille=10, couleur=ENCRE, tracking=0.0):
    if tracking:
        largeur = stringWidth(txt, police, taille) + tracking * max(len(txt) - 1, 0)
        _texte(c, cx - largeur / 2, top, txt, police, taille, couleur, tracking)
    else:
        c.setFont(police, taille)
        c.setFillColor(couleur)
        c.drawCentredString(cx, _y(top), txt)


def _etoile(c, cx, cy, r, couleur, pointes=5, ratio=0.42):
    """Étoile pleine (l'étoile noire du drapeau bissau-guinéen)."""
    p = c.beginPath()
    for i in range(pointes * 2):
        ang = math.pi / 2 + i * math.pi / pointes
        rad = r if i % 2 == 0 else r * ratio
        x, y = cx + rad * math.cos(ang), cy + rad * math.sin(ang)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close()
    c.setFillColor(couleur)
    c.drawPath(p, fill=1, stroke=0)


def _champ(c, x, top, label, valeur, taille_valeur=12, mono=False):
    """Un champ label + valeur (colonne d'informations)."""
    _texte(c, x, top, label.upper(), "Helvetica", 7.5, FAINT, tracking=1.1)
    police = "Courier" if mono else "Helvetica-Bold"
    _texte(c, x, top + 15, str(valeur), police, taille_valeur, ENCRE)


def _plaque(c, x, top, numero, largeur=214, hauteur=50):
    """Plaque minéralogique GW stylisée."""
    y = _y(top + hauteur)
    # Corps blanc bordé
    c.setFillColor(BLANC)
    c.setStrokeColor(ENCRE)
    c.setLineWidth(1.6)
    c.roundRect(x, y, largeur, hauteur, 6, fill=1, stroke=1)
    # Bande pays bleue
    bande = 40
    c.setFillColor(BLEU)
    c.roundRect(x + 2.5, y + 2.5, bande, hauteur - 5, 4, fill=1, stroke=0)
    _etoile(c, x + 2.5 + bande / 2, y + hauteur - 15, 6.5, OR_CLAIR)
    _texte_centre(c, x + 2.5 + bande / 2, top + hauteur - 12, "GW", "Helvetica-Bold", 15, BLANC)
    # Numéro
    cx = x + bande + (largeur - bande) / 2 + 2
    _texte_centre(c, cx, top + hauteur / 2 + 9, numero or "—", "Helvetica-Bold", 25, ENCRE, tracking=2)


def _sceau(c, cx, cy, r=52):
    """Sceau doré « authentifié » (léger effet tampon incliné)."""
    c.saveState()
    c.translate(cx, cy)
    c.rotate(-9)
    c.setStrokeColor(OR)
    c.setLineWidth(2.2)
    c.circle(0, 0, r, stroke=1, fill=0)
    c.setLineWidth(0.8)
    c.circle(0, 0, r - 6, stroke=1, fill=0)
    c.setFillColor(OR)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(0, r - 20, "S N I C V")
    _etoile(c, 0, 2, 15, OR)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(OR)
    c.drawCentredString(0, -r + 13, "CERTIFIÉ")
    c.restoreState()


# ─────────────────────────── document ───────────────────────────

def rendre_certificat_pdf(certificat) -> bytes:
    """Compose le certificat A4 (portrait, vectoriel) et le renvoie en PDF."""
    snap = certificat.donnees_snapshot or {}
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Certificat SNICV — {snap.get('immatriculation', '')}")

    M = 28  # marge

    # Cadre décoratif double (bleu + or)
    c.setStrokeColor(BLEU)
    c.setLineWidth(1.4)
    c.rect(M - 8, M - 8, W - 2 * (M - 8), H - 2 * (M - 8))
    c.setStrokeColor(OR)
    c.setLineWidth(0.6)
    c.rect(M - 3, M - 3, W - 2 * (M - 3), H - 2 * (M - 3))

    # Filigrane : grande étoile très pâle, centrée (couleur claire = pas d'alpha requis)
    _etoile(c, W / 2, H / 2 - 70, 168, HexColor("#eef2fa"))

    # ── En-tête ──
    header_h = 104
    top = M
    c.setFillColor(BLEU)
    c.roundRect(M, _y(top + header_h), W - 2 * M, header_h, 7, fill=1, stroke=0)

    # Emblème (anneaux + étoile)
    ex, ey = M + 54, _y(top + header_h / 2)
    c.setStrokeColor(OR_CLAIR)
    c.setLineWidth(2)
    c.circle(ex, ey, 31, stroke=1, fill=0)
    c.setLineWidth(1)
    c.circle(ex, ey, 24, stroke=1, fill=0)
    _etoile(c, ex, ey, 15, OR_CLAIR)

    tx = M + 100
    _texte(c, tx, top + 30, "RÉPUBLIQUE DE GUINÉE-BISSAU", "Helvetica-Bold", 10, OR_CLAIR, tracking=1.6)
    _texte(c, tx, top + 60, "Certificat d'immatriculation", "Helvetica-Bold", 22, BLANC)
    _texte(c, tx, top + 82,
           "Système National d'Immatriculation et de Contrôle des Véhicules · SNICV",
           "Helvetica", 9, BLEU_TEXTE)

    # Filet doré sous l'en-tête
    c.setFillColor(OR)
    c.rect(M, _y(top + header_h + 6), W - 2 * M, 3, fill=1, stroke=0)

    # ── Région haute : plaque + titulaire (gauche) · QR (droite) ──
    region_top = top + header_h + 34
    col_g = M + 6
    _plaque(c, col_g, region_top, snap.get("immatriculation") or "—")

    # Titulaire mis en avant
    bloc_top = region_top + 74
    _texte(c, col_g, bloc_top, "TITULAIRE DU CERTIFICAT", "Helvetica", 7.5, FAINT, tracking=1.1)
    _texte(c, col_g, bloc_top + 20, snap.get("proprietaire") or "—", "Helvetica-Bold", 16, ENCRE)

    # Carte QR à droite
    qr_card_w, qr_card_h = 176, 200
    qr_x = W - M - qr_card_w - 4
    qr_y = _y(region_top + qr_card_h)
    c.setFillColor(BLEU_PALE)
    c.setStrokeColor(BORD)
    c.setLineWidth(1)
    c.roundRect(qr_x, qr_y, qr_card_w, qr_card_h, 10, fill=1, stroke=1)
    qr_img = generer_qr_image(certificat.qr_payload, taille=300)
    qr_size = 132
    c.drawImage(
        ImageReader(qr_img),
        qr_x + (qr_card_w - qr_size) / 2,
        _y(region_top + 16 + qr_size),
        qr_size, qr_size,
    )
    cx_qr = qr_x + qr_card_w / 2
    _texte_centre(c, cx_qr, region_top + qr_size + 40, "Scannez pour vérifier",
                  "Helvetica-Bold", 10, BLEU)
    _texte_centre(c, cx_qr, region_top + qr_card_h - 12,
                  f"N° {str(certificat.id)[:18]}…", "Courier", 7, FAINT)

    # ── Séparateur de section ──
    sec_top = region_top + qr_card_h + 20
    c.setFillColor(OR)
    c.rect(col_g, _y(sec_top), 34, 2.4, fill=1, stroke=0)
    _texte(c, col_g, sec_top + 16, "CARACTÉRISTIQUES DU VÉHICULE", "Helvetica-Bold", 9, BLEU, tracking=1.2)

    # ── Grille d'informations (2 colonnes) ──
    grille_top = sec_top + 40
    col2 = W / 2 + 6
    pas = 52

    energie = snap.get("energie") or "—"
    annee = snap.get("annee") or "—"
    gauche = [
        ("Marque / Modèle", f"{snap.get('marque', '')} {snap.get('modele', '')}".strip() or "—"),
        ("Type de véhicule", snap.get("type") or "—"),
        ("Assurance — échéance", snap.get("assurance_echeance") or "—"),
        ("N° de dossier", snap.get("numero_dossier") or "—"),
    ]
    droite = [
        ("Année · Énergie", f"{annee} · {energie}"),
        ("Couleur / Série", snap.get("serie") or "—"),
        ("Contrôle technique — échéance", snap.get("ct_echeance") or "—"),
        ("Identifiant véhicule (UUID)", snap.get("uuid_vehicule") or "—"),
    ]
    for i, (label, valeur) in enumerate(gauche):
        mono = label.startswith("N° de dossier")
        _champ(c, col_g, grille_top + i * pas, label, valeur, mono=mono)
    for i, (label, valeur) in enumerate(droite):
        mono = label.startswith("Identifiant")
        taille = 8.5 if mono else 12
        _texte(c, col2, grille_top + i * pas, label.upper(), "Helvetica", 7.5, FAINT, tracking=1.1)
        _texte(c, col2, grille_top + i * pas + 15, str(valeur),
               "Courier" if mono else "Helvetica-Bold", taille, ENCRE)

    # ── Sceau doré (bas-droite, entre la grille et le bandeau) ──
    _sceau(c, W - M - 88, 162, r=42)

    # ── Bandeau de sécurité (bas) ──
    band_h = 92
    band_top = H - M - band_h
    c.setFillColor(HexColor("#f6f8fc"))
    c.setStrokeColor(BORD)
    c.setLineWidth(1)
    c.roundRect(M, _y(band_top + band_h), W - 2 * M, band_h, 8, fill=1, stroke=1)
    c.setFillColor(OR)
    c.rect(M, _y(band_top + band_h), 5, band_h, fill=1, stroke=0)

    de = str(snap.get("date_emission", ""))[:10] or "—"
    exp = getattr(certificat, "date_expiration", None)
    exp_txt = exp.date().isoformat() if exp else "—"
    statut = getattr(certificat, "get_statut_display", lambda: "")() or ""

    _texte(c, M + 20, band_top + 22, "AUTHENTIFICATION", "Helvetica-Bold", 8.5, BLEU, tracking=1.2)
    _texte(c, M + 20, band_top + 40, f"Émis le {de}   ·   Valable jusqu'au {exp_txt}   ·   Statut : {statut}",
           "Helvetica", 9, GRIS)
    _texte(c, M + 20, band_top + 58, "Empreinte SHA-256", "Helvetica", 7.5, FAINT, tracking=1)
    _texte(c, M + 20, band_top + 72, getattr(certificat, "hash_sha256", "") or "—", "Courier", 8, ENCRE)
    _texte(c, M + 20, band_top + 87,
           "Document signé numériquement par le SNICV (RSA-2048). Toute altération invalide la signature.",
           "Helvetica-Oblique", 7.5, GRIS)

    c.showPage()
    c.save()
    return buf.getvalue()
