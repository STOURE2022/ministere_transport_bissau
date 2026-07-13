"""Export PDF du « dossier de vie » du véhicule (frise chronologique)."""
from __future__ import annotations

from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

BLEU = HexColor("#0d2748")
OR = HexColor("#b8891f")
ENCRE = HexColor("#16202e")
GRIS = HexColor("#5a6b82")
FAINT = HexColor("#8b95a3")
BLANC = HexColor("#ffffff")
BORD = HexColor("#dde3ea")

W, H = A4
M = 40


def _wrap(txt, police, taille, largeur):
    """Découpe un texte en lignes tenant dans `largeur` points."""
    mots, lignes, courante = str(txt).split(), [], ""
    for mot in mots:
        essai = f"{courante} {mot}".strip()
        if stringWidth(essai, police, taille) <= largeur:
            courante = essai
        else:
            if courante:
                lignes.append(courante)
            courante = mot
    if courante:
        lignes.append(courante)
    return lignes or [""]


def rendre_historique_pdf(data: dict) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    veh = data["vehicule"]
    c.setTitle(f"Dossier de vie — {veh.get('immatriculation') or veh['vin']}")

    def entete():
        c.setFillColor(BLEU)
        c.rect(0, H - 96, W, 96, fill=1, stroke=0)
        c.setFillColor(OR)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(M, H - 34, "RÉPUBLIQUE DE GUINÉE-BISSAU · SNICV")
        c.setFillColor(BLANC)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(M, H - 56, "Dossier de vie du véhicule")
        c.setFillColor(HexColor("#c3d2e8"))
        c.setFont("Helvetica", 9.5)
        sous = f"{veh['marque']} {veh['modele']} · {veh['annee']} · {veh['energie']}"
        c.drawString(M, H - 72, sous)
        c.setFont("Courier-Bold", 12)
        c.setFillColor(BLANC)
        c.drawRightString(W - M, H - 56, veh.get("immatriculation") or veh["vin"])
        c.setFont("Helvetica", 8.5)
        c.setFillColor(HexColor("#c3d2e8"))
        c.drawRightString(W - M, H - 72, f"Titulaire : {veh['titulaire']}")

    def pied(num):
        c.setStrokeColor(BORD)
        c.setLineWidth(0.6)
        c.line(M, 34, W - M, 34)
        c.setFillColor(FAINT)
        c.setFont("Helvetica", 7.5)
        c.drawString(M, 24, "Document généré par le SNICV — dossier de vie consultable.")
        c.drawRightString(W - M, 24, f"Page {num}")

    page = [1]
    entete()
    pied(page[0])
    y = H - 122

    def saut_si_besoin(besoin):
        nonlocal y
        if y - besoin < 50:
            c.showPage()
            page[0] += 1
            entete()
            pied(page[0])
            y = H - 122

    # Résumé
    r = data["resume"]
    c.setFillColor(OR)
    c.rect(M, y - 2, 26, 2.4, fill=1, stroke=0)
    c.setFillColor(BLEU)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M, y + 8, "RÉSUMÉ")
    y -= 12
    resume_txt = (
        f"Statut : {r['statut_libelle']}   ·   Événements : {r['evenements']}   ·   "
        f"Contrôles : {r['controles']} ({r['controles_authentiques']} authentiques)   ·   "
        f"Signalements : {r['signalements_leves']} levé(s), {r['signalements_actifs']} actif(s)   ·   "
        f"Ancienneté : {r['anciennete_mois']} mois"
    )
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 9)
    for ligne in _wrap(resume_txt, "Helvetica", 9, W - 2 * M):
        y -= 13
        c.drawString(M, y, ligne)
    y -= 18

    # Frise groupée par année
    annee_courante = None
    for ev in data["evenements"]:
        d = ev["date"]
        annee = d.year
        if annee != annee_courante:
            saut_si_besoin(40)
            annee_courante = annee
            c.setFillColor(BLEU)
            c.setFont("Helvetica-Bold", 13)
            y -= 6
            c.drawString(M, y, str(annee))
            y -= 6
            c.setStrokeColor(BORD)
            c.setLineWidth(0.8)
            c.line(M, y, W - M, y)
            y -= 6

        desc_lignes = _wrap(ev["description"], "Helvetica", 8.5, W - 2 * M - 104) if ev["description"] else []
        besoin = 20 + len(desc_lignes) * 11 + (11 if ev["acteur"] else 0)
        saut_si_besoin(besoin)

        # puce
        c.setFillColor(OR)
        c.circle(M + 4, y - 3, 3, fill=1, stroke=0)
        # date
        c.setFillColor(FAINT)
        c.setFont("Courier", 8)
        c.drawString(M + 14, y - 5, d.strftime("%d/%m/%Y %H:%M"))
        # titre (+ tag)
        c.setFillColor(ENCRE)
        c.setFont("Helvetica-Bold", 10)
        titre = ev["titre"]
        c.drawString(M + 104, y - 5, titre)
        if ev["tag"]:
            tw = stringWidth(titre, "Helvetica-Bold", 10)
            c.setFillColor(GRIS)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(M + 104 + tw + 8, y - 5, f"[{ev['tag']}]")
        y -= 14
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 8.5)
        for ligne in desc_lignes:
            c.drawString(M + 104, y, ligne)
            y -= 11
        if ev["acteur"]:
            c.setFillColor(FAINT)
            c.setFont("Helvetica-Oblique", 8)
            c.drawString(M + 104, y, f"par {ev['acteur']}")
            y -= 11
        y -= 6

    c.showPage()
    c.save()
    return buf.getvalue()
