"""Quittance officielle d'amende (PDF vectoriel ReportLab, avec QR de vérification)."""
from __future__ import annotations

import math
from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from apps.certificats.pdf import generer_qr_image

BLEU = HexColor("#0d2748")
OR = HexColor("#b8891f")
OR_CLAIR = HexColor("#d8b45e")
VERT = HexColor("#1e8e5a")
ENCRE = HexColor("#16202e")
GRIS = HexColor("#5a6b82")
FAINT = HexColor("#8b95a3")
BLANC = HexColor("#ffffff")
BORD = HexColor("#dde3ea")

W, H = A4
M = 42


def _y(top):
    return H - top


def _etoile(c, cx, cy, r, couleur, pointes=5, ratio=0.42):
    p = c.beginPath()
    for i in range(pointes * 2):
        ang = math.pi / 2 + i * math.pi / pointes
        rad = r if i % 2 == 0 else r * ratio
        x, y = cx + rad * math.cos(ang), cy + rad * math.sin(ang)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close()
    c.setFillColor(couleur)
    c.drawPath(p, fill=1, stroke=0)


def _fmt(montant, devise):
    return f"{montant:,}".replace(",", " ") + f" {devise}"


def rendre_quittance_pdf(infraction) -> bytes:
    v = infraction.vehicule
    immat = getattr(v, "immatriculation", None)
    titulaire = (
        f"{v.proprietaire.prenom} {v.proprietaire.nom}".strip()
        if v.proprietaire else "—"
    )
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Quittance {infraction.quittance_reference}")

    # Cadre
    c.setStrokeColor(BLEU); c.setLineWidth(1.2)
    c.rect(M - 10, M - 10, W - 2 * (M - 10), H - 2 * (M - 10))
    c.setStrokeColor(OR); c.setLineWidth(0.5)
    c.rect(M - 5, M - 5, W - 2 * (M - 5), H - 2 * (M - 5))

    # En-tête
    hh = 92
    c.setFillColor(BLEU)
    c.roundRect(M, _y(M + hh), W - 2 * M, hh, 7, fill=1, stroke=0)
    ex, ey = M + 46, _y(M + hh / 2)
    c.setStrokeColor(OR_CLAIR); c.setLineWidth(1.6)
    c.circle(ex, ey, 24, stroke=1, fill=0)
    _etoile(c, ex, ey, 12, OR_CLAIR)
    c.setFillColor(OR_CLAIR); c.setFont("Helvetica-Bold", 8.5)
    c.drawString(M + 84, _y(M + 30), "RÉPUBLIQUE DE GUINÉE-BISSAU · SNICV")
    c.setFillColor(BLANC); c.setFont("Helvetica-Bold", 19)
    c.drawString(M + 84, _y(M + 52), "Quittance d'amende")
    c.setFillColor(HexColor("#b9cbe6")); c.setFont("Helvetica", 9)
    c.drawString(M + 84, _y(M + 70), "Règlement d'un procès-verbal")
    # Sceau PAYÉE
    c.setFillColor(VERT)
    c.roundRect(W - M - 100, _y(M + 58), 82, 26, 13, fill=1, stroke=0)
    c.setFillColor(BLANC); c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(W - M - 59, _y(M + 41), "PAYÉE")

    y = M + hh + 34

    # Montant
    c.setFillColor(FAINT); c.setFont("Helvetica", 8)
    c.drawString(M, _y(y), "MONTANT RÉGLÉ")
    c.setFillColor(BLEU); c.setFont("Helvetica-Bold", 30)
    c.drawString(M, _y(y + 30), _fmt(infraction.montant, infraction.devise))

    # QR (droite) — ancré sous l'en-tête pour ne pas chevaucher le sceau
    payload = (
        f"SNICV|QUITTANCE|{infraction.quittance_reference}|{infraction.reference}"
        f"|{infraction.montant} {infraction.devise}|{infraction.reference_transaction}"
    )
    qr = generer_qr_image(payload, taille=250)
    qs = 108
    c.drawImage(ImageReader(qr), W - M - qs, _y(y + qs), qs, qs)
    c.setFillColor(GRIS); c.setFont("Helvetica", 7.5)
    c.drawCentredString(W - M - qs / 2, _y(y + qs + 12), "Vérifier la quittance")

    # Détail
    y += qs + 30
    c.setFillColor(OR); c.rect(M, _y(y), 26, 2.2, fill=1, stroke=0)
    c.setFillColor(BLEU); c.setFont("Helvetica-Bold", 9.5)
    c.drawString(M, _y(y + 15), "DÉTAIL")
    y += 26

    infos = [
        ("Objet", f"Amende — {infraction.libelle}"),
        ("Quittance N°", infraction.quittance_reference),
        ("Procès-verbal N°", infraction.reference),
        ("Véhicule", immat.numero if immat else v.vin),
        ("Titulaire", titulaire),
        ("Lieu du contrôle", infraction.lieu or "—"),
        ("Opérateur", infraction.operateur),
        ("Numéro", infraction.numero_telephone),
        ("Réf. transaction", infraction.reference_transaction or "—"),
        ("Constatée le", infraction.date_infraction.strftime("%d/%m/%Y %H:%M")),
        ("Réglée le", infraction.paye_le.strftime("%d/%m/%Y %H:%M") if infraction.paye_le else "—"),
    ]
    for label, valeur in infos:
        c.setFillColor(FAINT); c.setFont("Helvetica", 8.5)
        c.drawString(M + 4, _y(y), label.upper())
        c.setFillColor(ENCRE); c.setFont("Helvetica-Bold", 10)
        c.drawRightString(W - M - 4, _y(y), str(valeur))
        y += 20

    # Total
    c.setStrokeColor(BORD); c.setLineWidth(0.8)
    c.line(M, _y(y - 4), W - M, _y(y - 4))
    c.setFillColor(BLEU); c.setFont("Helvetica-Bold", 11)
    c.drawString(M + 4, _y(y + 12), "Total réglé")
    c.drawRightString(W - M - 4, _y(y + 12), _fmt(infraction.montant, infraction.devise))

    # Bandeau bas
    by = H - M - 58
    c.setFillColor(HexColor("#f6f8fc"))
    c.setStrokeColor(BORD); c.setLineWidth(1)
    c.roundRect(M, _y(by + 58), W - 2 * M, 58, 8, fill=1, stroke=1)
    c.setFillColor(VERT); c.rect(M, _y(by + 58), 5, 58, fill=1, stroke=0)
    c.setFillColor(BLEU); c.setFont("Helvetica-Bold", 9)
    c.drawString(M + 18, _y(by + 22), "AMENDE SOLDÉE")
    c.setFillColor(GRIS); c.setFont("Helvetica", 8.5)
    c.drawString(M + 18, _y(by + 38), "Le procès-verbal est clôturé et archivé au dossier de vie du véhicule.")
    c.setFillColor(FAINT); c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(M + 18, _y(by + 52), "Document généré par le SNICV — Trésor public de Guinée-Bissau.")

    c.showPage()
    c.save()
    return buf.getvalue()
