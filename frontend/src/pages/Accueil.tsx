import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang, LangSwitcher } from "@/lib/i18n";

interface PublicStats {
  vehicules: number;
  immatriculations: number;
  certificats_actifs: number;
  controles_total: number;
  regions: number;
}

/**
 * Page d'accueil publique du SNICV (avant connexion).
 * Styles isolés sous `.accueil-root` pour ne pas fuiter sur le reste de l'app.
 * Chiffres-clés tirés en direct de l'API publique `/stats/public/`.
 */
export default function Accueil() {
  const { t, n } = useLang();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    api.get<PublicStats>("/stats/public/").then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  const chiffre = (v: number | undefined) => (stats && v != null ? n(v) : "…");

  return (
    <div className="accueil-root">
      <style>{CSS}</style>

      {/* ══ Header ══ */}
      <header className="top">
        <div className="wrap nav">
          <Link to="/" className="brand">
            <span className="emblem">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.7 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z" fill="#d8b45e" />
              </svg>
            </span>
            <span>
              <span className="wm">SNICV</span>
              <span className="sub">{t("Ministère des Transports · Guinée-Bissau")}</span>
            </span>
          </Link>
          <nav className="links">
            <a href="#processus">{t("Le dispositif")}</a>
            <a href="#espaces">{t("Espaces")}</a>
            <a href="#securite">{t("Sécurité")}</a>
            <a href="#couverture">{t("Couverture")}</a>
          </nav>
          <div className="right">
            <LangSwitcher className="text-white" />
            <Link className="btn btn-ghost" to="/login">{t("Accéder à mon espace")}</Link>
          </div>
        </div>
      </header>

      {/* ══ Hero ══ */}
      <div className="hero">
        <svg className="stars" preserveAspectRatio="none" aria-hidden>
          <defs>
            <pattern id="acc-stars" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M60 44l3 6.6 7.2.7-5.4 4.9 1.6 7.1L60 60.5 53.6 63.3l1.6-7.1-5.4-4.9 7.2-.7z" fill="rgba(255,255,255,.05)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#acc-stars)" />
        </svg>
        <div className="wrap hero-grid">
          <div>
            <div className="rv" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="eyebrow">{t("République de Guinée-Bissau")}</span>
              <span className="tricolor"><i className="r" /><i className="y" /><i className="g" /></span>
            </div>
            <h1 className="rv d1" style={{ marginTop: 18 }}>
              {t("Le registre national des véhicules,")}<br />
              <span className="accent">{t("infalsifiable et vérifiable en 2 secondes.")}</span>
            </h1>
            <p className="lede rv d2">
              {t("Immatriculation, certificat numérique signé et contrôle routier temps réel — une plateforme souveraine du Ministère des Transports.")}
            </p>
            <div className="hero-cta rv d2">
              <Link className="btn btn-gold" to="/verify-offline">{t("✦ Vérifier un certificat")}</Link>
              <Link className="btn btn-ghost" to="/login">{t("Espace agent / administration")}</Link>
            </div>
            <div className="hero-meta rv d3">
              <div className="m"><div className="n">RSA&nbsp;<b>2048</b></div><div className="l">{t("signature cryptographique")}</div></div>
              <div className="m"><div className="n">&lt;&nbsp;2&nbsp;s</div><div className="l">{t("vérification terrain")}</div></div>
              <div className="m"><div className="n">100&nbsp;%</div><div className="l">{t("hors-ligne possible")}</div></div>
            </div>
          </div>

          {/* Démo de vérification */}
          <div className="demo rv d2">
            <div className="dh">
              <span className="dot" />
              <span className="t">Vérification d'un certificat</span>
              <span className="live">● EN DIRECT</span>
            </div>
            <div className="db">
              <div className="plate">
                <span className="gw"><span className="st">★</span><b>GW</b></span>
                <span className="num">GB 2048 BS</span>
              </div>
              <div className="result">
                <div className="rh">
                  <span className="ic">✓</span>
                  <div>
                    <div className="rt">{t("Certificat authentique")}</div>
                    <div className="rs">{t("Signature RSA valide · statut actif")}</div>
                  </div>
                </div>
                <div className="rb">
                  <div className="f"><div className="k">{t("Titulaire")}</div><div className="v">Fatumata Djaló</div></div>
                  <div className="f"><div className="k">{t("Véhicule")}</div><div className="v">Toyota Hilux</div></div>
                  <div className="f"><div className="k">{t("Année · Énergie")}</div><div className="v">2023 · Diesel</div></div>
                  <div className="f"><div className="k">{t("Valable jusqu'au")}</div><div className="v">14/06/2030</div></div>
                </div>
                <div className="foot">{t("Vérifié le 11 juillet 2026 à 14:32 · Contrôle routier — Bissau")}</div>
              </div>
              <div className="sec"><span className="lock">🔒</span> {t("Empreinte SHA-256 recalculée localement — aucune donnée modifiable.")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ KPI (chiffres réels du registre) ══ */}
      <div className="kpis">
        <div className="wrap">
          <div className="kpi-grid">
            <div className="kpi"><div className="n">{chiffre(stats?.immatriculations)}</div><div className="l">{t("Véhicules immatriculés")}</div><div className="d">{chiffre(stats?.vehicules)} {t("au total")}</div></div>
            <div className="kpi"><div className="n">{chiffre(stats?.certificats_actifs)}</div><div className="l">{t("Certificats QR actifs")}</div><div className="d">{t("signés RSA-2048")}</div></div>
            <div className="kpi"><div className="n">{chiffre(stats?.controles_total)}</div><div className="l">{t("Contrôles vérifiés")}</div><div className="d">{t("forces de l'ordre")}</div></div>
            <div className="kpi"><div className="n">{chiffre(stats?.regions)}</div><div className="l">{t("Régions couvertes")}</div><div className="d">{t("tout le territoire")}</div></div>
          </div>
        </div>
      </div>

      {/* ══ Processus ══ */}
      <section id="processus">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">{t("Du dépôt au certificat")}</span>
            <h2>{t("Un parcours dématérialisé, du dossier au QR signé")}</h2>
            <p>{t("Chaque véhicule suit un circuit tracé et sécurisé : le citoyen dépose, l'agent valide, l'État certifie.")}</p>
          </div>
          <div className="steps">
            <div className="step"><span className="no">01</span><h3>{t("Dépôt du dossier")}</h3><p>{t("Le titulaire crée son compte et téléverse assurance, contrôle technique et facture.")}</p></div>
            <div className="step"><span className="no">02</span><h3>{t("Vérification & validation")}</h3><p>{t("Contrôle automatique anti-fraude puis validation par un agent habilité.")}</p></div>
            <div className="step"><span className="no">03</span><h3>{t("Immatriculation")}</h3><p>{t("Attribution d'une plaque nationale format")} <b>GW</b> {t("et enregistrement au registre.")}</p></div>
            <div className="step"><span className="no">04</span><h3>{t("Certificat QR signé")}</h3><p>{t("Génération d'un certificat numérique signé, vérifiable en ligne comme hors-ligne.")}</p></div>
          </div>
        </div>
      </section>

      {/* ══ Espaces ══ */}
      <section id="espaces" style={{ background: "var(--paper-deep)" }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">{t("Une plateforme, quatre métiers")}</span>
            <h2>{t("Chaque acteur, son espace dédié")}</h2>
          </div>
          <div className="spaces">
            <Link className="space" to="/login"><div className="ico" style={{ background: "var(--navy-2)" }}>👤</div>
              <div><h3>{t("Usager")}</h3><p>{t("Déposer un dossier, suivre son traitement, télécharger son certificat officiel.")}</p><span className="go">{t("Créer mon dossier →")}</span></div></Link>
            <Link className="space" to="/login"><div className="ico" style={{ background: "var(--green)" }}>🗂️</div>
              <div><h3>{t("Agent instructeur")}</h3><p>{t("Instruire les dossiers, immatriculer, émettre et révoquer les certificats.")}</p><span className="go">{t("File de validation →")}</span></div></Link>
            <Link className="space" to="/login"><div className="ico" style={{ background: "#a1201f" }}>🛡️</div>
              <div><h3>{t("Forces de l'ordre")}</h3><p>{t("Vérifier par QR ou par plaque, consulter les alertes véhicules volés.")}</p><span className="go">{t("Console de contrôle →")}</span></div></Link>
            <Link className="space" to="/login"><div className="ico" style={{ background: "var(--gold)", color: "#2a1e02" }}>📊</div>
              <div><h3>{t("Administration")}</h3><p>{t("Piloter le parc national, suivre les indicateurs et la fraude en temps réel.")}</p><span className="go">{t("Tableau de bord →")}</span></div></Link>
          </div>
        </div>
      </section>

      {/* ══ Sécurité ══ */}
      <section id="securite" className="security">
        <div className="wrap sec-grid">
          <div>
            <span className="eyebrow">{t("Confiance par la cryptographie")}</span>
            <h2 style={{ fontSize: "clamp(1.7rem,3vw,2.3rem)", marginTop: 12 }}>{t("Un certificat que l'on ne peut ni imiter, ni altérer")}</h2>
            <div className="sec-list">
              <div className="sec-item"><span className="b">🔑</span><div><h3>{t("Signature RSA-2048")}</h3><p>{t("Chaque certificat est signé par la clé souveraine de l'État. Toute retouche invalide la signature.")}</p></div></div>
              <div className="sec-item"><span className="b">#️⃣</span><div><h3>{t("Empreinte SHA-256")}</h3><p>{t("Les données sont scellées par une empreinte recalculée à chaque contrôle.")}</p></div></div>
              <div className="sec-item"><span className="b">📶</span><div><h3>{t("Vérification hors-ligne")}</h3><p>{t("Sur le terrain sans réseau, l'agent valide la signature localement, en toute autonomie.")}</p></div></div>
              <div className="sec-item"><span className="b">🚨</span><div><h3>{t("Alerte véhicules signalés")}</h3><p>{t("Un véhicule volé ou recherché déclenche une alerte immédiate au contrôle.")}</p></div></div>
            </div>
          </div>
          <div className="shield">
            <div className="big">🛡️</div>
            <div className="cap">{t("Scellé numérique de l'État")}</div>
          </div>
        </div>
      </section>

      {/* ══ Couverture ══ */}
      <section id="couverture">
        <div className="wrap cov-grid">
          <div>
            <span className="eyebrow">{t("Présence nationale")}</span>
            <h2 style={{ fontSize: "clamp(1.7rem,3vw,2.3rem)", marginTop: 12 }}>{t("Un dispositif déployé sur tout le territoire")}</h2>
            <p style={{ color: "var(--slate)", marginTop: 14, fontSize: 15 }}>{t("Des centres d'immatriculation et de contrôle connectés au registre national, de la capitale aux régions.")}</p>
            <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
              <Link className="btn btn-navy" to="/login">{t("Trouver un centre")}</Link>
              <Link className="btn btn-outline" to="/login">{t("Contacter le ministère")}</Link>
            </div>
          </div>
          <div className="regions">
            <div className="region"><span className="pin" />Bissau <small>SIÈGE</small></div>
            <div className="region"><span className="pin" />Bafatá</div>
            <div className="region"><span className="pin" />Gabú</div>
            <div className="region"><span className="pin" />Canchungo</div>
            <div className="region"><span className="pin" />Cacheu</div>
            <div className="region"><span className="pin" />Buba</div>
            <div className="region"><span className="pin" />Bolama</div>
            <div className="region"><span className="pin" />Farim</div>
          </div>
        </div>
      </section>

      {/* ══ CTA final ══ */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="final">
            <span className="star">★</span>
            <span className="eyebrow" style={{ color: "var(--gold-soft)" }}>{t("Ministère des Transports")}</span>
            <h2 style={{ marginTop: 14 }}>{t("Un registre moderne, au service")}<br />{t("de la sécurité routière nationale")}</h2>
            <p>{t("Émettre, vérifier et sécuriser les certificats des véhicules de Guinée-Bissau — sur une plateforme conçue pour l'échelle nationale.")}</p>
            <div className="cta">
              <Link className="btn btn-gold" to="/verify-offline">{t("✦ Vérifier un certificat")}</Link>
              <Link className="btn btn-ghost" to="/login">{t("Accéder à mon espace")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Footer ══ */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="col">
              <h4>SNICV</h4>
              <p>{t("Système National d'Immatriculation et de Contrôle des Véhicules — Ministère des Transports de la République de Guinée-Bissau.")}</p>
            </div>
            <div className="col"><h4>{t("Plateforme")}</h4><ul><li><Link to="/verify-offline">{t("Vérifier un certificat")}</Link></li><li><Link to="/verify-offline">{t("Mode hors-ligne")}</Link></li><li><Link to="/login">{t("Espace usager")}</Link></li><li><Link to="/login">{t("Espace agent")}</Link></li></ul></div>
            <div className="col"><h4>{t("Le dispositif")}</h4><ul><li>{t("Immatriculation")}</li><li>{t("Certificat QR")}</li><li>{t("Contrôle routier")}</li><li>{t("Signalements")}</li></ul></div>
            <div className="col"><h4>{t("Institution")}</h4><ul><li>{t("Ministère des Transports")}</li><li>{t("Centres régionaux")}</li><li>{t("Mentions légales")}</li><li>{t("Contact")}</li></ul></div>
          </div>
          <div className="foot-bar">
            <span>{t("© 2026 République de Guinée-Bissau — Ministère des Transports")}</span>
            <span className="tricolor"><i className="r" /><i className="y" /><i className="g" /></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.accueil-root{
  --navy-deep:#081a34; --navy:#0d2748; --navy-2:#12386e;
  --gold:#d8b45e; --gold-soft:#EBCB6A;
  --paper:#f6f3ec; --paper-deep:#efeadd; --card:#ffffff;
  --ink:#0f1b2d; --slate:#5a6b82; --faint:#8ea6c9;
  --line:#e6ddca; --green:#1e8e5a;
  --gw-red:#ce1126; --gw-yellow:#fcd116; --gw-green:#009739;
  --serif:Georgia,"Times New Roman",serif;
  background:var(--paper);color:var(--ink);line-height:1.6;overflow-x:hidden;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
.accueil-root *{box-sizing:border-box}
.accueil-root img,.accueil-root svg{max-width:100%}
.accueil-root h1,.accueil-root h2,.accueil-root h3{font-family:var(--serif);font-weight:700;letter-spacing:-.01em;text-wrap:balance;margin:0}
.accueil-root p{margin:0}
.accueil-root a{color:inherit;text-decoration:none}
.accueil-root .wrap{width:100%;max-width:1140px;margin:0 auto;padding:0 24px}
.accueil-root .eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.accueil-root .tricolor{display:inline-flex;height:3px;width:64px;border-radius:2px;overflow:hidden}
.accueil-root .tricolor i{flex:1}
.accueil-root .tricolor .r{background:var(--gw-red)} .accueil-root .tricolor .y{background:var(--gw-yellow)} .accueil-root .tricolor .g{background:var(--gw-green)}

.accueil-root header.top{position:sticky;top:0;z-index:50;background:rgba(9,25,49,.82);backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
.accueil-root .nav{display:flex;align-items:center;gap:18px;height:70px}
.accueil-root .brand{display:flex;align-items:center;gap:12px;color:#fff}
.accueil-root .emblem{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(216,180,94,.5);background:rgba(255,255,255,.06)}
.accueil-root .brand .wm{display:block;font-family:var(--serif);font-weight:700;font-size:18px;line-height:1;letter-spacing:.02em}
.accueil-root .brand .sub{display:block;font-size:11px;color:var(--faint);margin-top:3px}
.accueil-root .nav .links{display:flex;gap:26px;margin-left:28px}
.accueil-root .nav .links a{color:#c9d6ea;font-size:14px;font-weight:500}
.accueil-root .nav .links a:hover{color:#fff}
.accueil-root .nav .right{margin-left:auto;display:flex;align-items:center;gap:14px}
.accueil-root .lang{color:#9fb2cd;font-size:12px;font-weight:600;letter-spacing:.06em}
.accueil-root .lang b{color:#fff}
.accueil-root .btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:.18s}
.accueil-root .btn-gold{background:var(--gold);color:#2a1e02}
.accueil-root .btn-gold:hover{background:var(--gold-soft)}
.accueil-root .btn-ghost{background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.18)}
.accueil-root .btn-ghost:hover{background:rgba(255,255,255,.12)}
.accueil-root .btn-navy{background:var(--navy);color:#fff}
.accueil-root .btn-navy:hover{background:var(--navy-2)}
.accueil-root .btn-outline{background:#fff;color:var(--navy);border-color:var(--line)}
.accueil-root .btn-outline:hover{border-color:var(--gold)}

.accueil-root .hero{position:relative;background:radial-gradient(1100px 500px at 78% -10%,rgba(216,180,94,.16),transparent 60%),radial-gradient(900px 600px at 8% 110%,rgba(18,56,110,.55),transparent 60%),linear-gradient(180deg,var(--navy-deep),var(--navy));color:#fff;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.06)}
.accueil-root .hero .stars{position:absolute;inset:0;width:100%;height:100%;opacity:.5;pointer-events:none}
.accueil-root .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:78px 0 90px;position:relative}
.accueil-root .hero h1{font-size:clamp(2.4rem,5vw,3.7rem);line-height:1.06}
.accueil-root .hero h1 .accent{color:var(--gold-soft)}
.accueil-root .hero .lede{color:#c4d2e8;font-size:17px;margin-top:22px;max-width:33ch}
.accueil-root .hero-cta{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}
.accueil-root .hero-meta{display:flex;gap:28px;margin-top:38px;flex-wrap:wrap}
.accueil-root .hero-meta .m .n{font-family:var(--serif);font-size:26px;font-weight:700;color:#fff}
.accueil-root .hero-meta .m .l{font-size:12px;color:var(--faint);letter-spacing:.02em}
.accueil-root .hero-meta .m .n b{color:var(--gold-soft);font-weight:700}

.accueil-root .demo{background:linear-gradient(180deg,#fdfcf9,var(--paper));color:var(--ink);border-radius:20px;border:1px solid rgba(216,180,94,.35);box-shadow:0 30px 70px rgba(4,12,28,.5);overflow:hidden}
.accueil-root .demo .dh{display:flex;align-items:center;gap:10px;background:var(--navy);color:#fff;padding:14px 18px}
.accueil-root .demo .dh .dot{width:9px;height:9px;border-radius:50%;background:var(--gold)}
.accueil-root .demo .dh .t{font-size:12.5px;font-weight:600;letter-spacing:.03em}
.accueil-root .demo .dh .live{margin-left:auto;font-size:10.5px;font-weight:700;letter-spacing:.14em;color:var(--gold-soft)}
.accueil-root .demo .db{padding:20px}
.accueil-root .plate{display:flex;height:58px;border:2.5px solid #0f1b2d;border-radius:8px;overflow:hidden;max-width:260px}
.accueil-root .plate .gw{width:50px;display:grid;place-content:center;background:var(--navy);color:#fff;gap:2px;text-align:center}
.accueil-root .plate .gw .st{font-size:9px;color:var(--gold-soft);line-height:1}
.accueil-root .plate .gw b{font-size:16px;line-height:1}
.accueil-root .plate .num{flex:1;display:grid;place-items:center;font-size:24px;font-weight:800;letter-spacing:.1em;color:#0f1b2d;font-variant-numeric:tabular-nums}
.accueil-root .result{margin-top:16px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}
.accueil-root .result .rh{display:flex;align-items:center;gap:12px;background:var(--green);color:#fff;padding:13px 16px}
.accueil-root .result .rh .ic{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:19px}
.accueil-root .result .rh .rt{font-family:var(--serif);font-weight:700;font-size:16px}
.accueil-root .result .rh .rs{font-size:12px;opacity:.9}
.accueil-root .result .rb{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;padding:16px}
.accueil-root .result .rb .f .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.accueil-root .result .rb .f .v{font-weight:600;font-size:14px}
.accueil-root .result .foot{border-top:1px solid var(--line);background:#faf7ef;padding:9px 16px;font-size:11px;color:var(--slate);text-align:center}
.accueil-root .demo .sec{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:11.5px;color:var(--slate)}
.accueil-root .demo .sec .lock{color:var(--green)}

.accueil-root section{padding:76px 0}
.accueil-root .sec-head{max-width:640px;margin-bottom:44px}
.accueil-root .sec-head h2{font-size:clamp(1.7rem,3vw,2.3rem);margin-top:12px}
.accueil-root .sec-head p{color:var(--slate);margin-top:12px;font-size:15.5px}

.accueil-root .kpis{background:var(--navy);color:#fff}
.accueil-root .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr)}
.accueil-root .kpi{padding:40px 26px;border-right:1px solid rgba(255,255,255,.08)}
.accueil-root .kpi:last-child{border-right:none}
.accueil-root .kpi .n{font-family:var(--serif);font-size:40px;font-weight:700;line-height:1}
.accueil-root .kpi .n b{color:var(--gold-soft)}
.accueil-root .kpi .l{color:var(--faint);font-size:13px;margin-top:10px}
.accueil-root .kpi .d{color:#a9bcd8;font-size:12px;margin-top:4px}

.accueil-root .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.accueil-root .step{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;position:relative;transition:.2s}
.accueil-root .step:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(13,39,72,.12)}
.accueil-root .step .no{display:grid;place-items:center;font-family:var(--serif);font-size:14px;font-weight:700;color:var(--gold);width:34px;height:34px;border-radius:9px;border:1px solid var(--line)}
.accueil-root .step h3{font-size:16px;margin-top:16px}
.accueil-root .step p{color:var(--slate);font-size:13.5px;margin-top:7px}

.accueil-root .spaces{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.accueil-root .space{display:flex;gap:18px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;transition:.2s}
.accueil-root .space:hover{border-color:var(--gold);box-shadow:0 14px 36px rgba(13,39,72,.1)}
.accueil-root .space .ico{width:52px;height:52px;flex:none;border-radius:13px;display:grid;place-items:center;font-size:24px;color:#fff}
.accueil-root .space h3{font-size:17px}
.accueil-root .space p{color:var(--slate);font-size:13.5px;margin-top:5px}
.accueil-root .space .go{color:var(--navy-2);font-size:13px;font-weight:700;margin-top:10px;display:inline-block}

.accueil-root .security{background:radial-gradient(700px 400px at 90% 0%,rgba(216,180,94,.1),transparent 60%),linear-gradient(180deg,var(--navy),var(--navy-deep));color:#fff}
.accueil-root .sec-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}
.accueil-root .sec-list{display:grid;gap:14px;margin-top:20px}
.accueil-root .sec-item{display:flex;gap:14px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.accueil-root .sec-item .b{width:40px;height:40px;flex:none;border-radius:11px;background:rgba(216,180,94,.16);color:var(--gold-soft);display:grid;place-items:center;font-size:19px}
.accueil-root .sec-item h3{font-size:15px}
.accueil-root .sec-item p{color:#b7c7de;font-size:13px;margin-top:3px}
.accueil-root .shield{aspect-ratio:1;max-width:340px;margin:0 auto;display:grid;place-items:center;border-radius:24px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 12px,transparent 12px 24px),rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);position:relative}
.accueil-root .shield .big{font-size:96px}
.accueil-root .shield .cap{position:absolute;bottom:20px;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-soft);font-weight:700}

.accueil-root .cov-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:48px;align-items:center}
.accueil-root .regions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.accueil-root .region{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:12px 14px;font-size:14px;font-weight:600}
.accueil-root .region .pin{width:8px;height:8px;border-radius:50%;background:var(--green);position:relative}
.accueil-root .region .pin::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1px solid rgba(30,142,90,.4);animation:acc-pulse 2.4s infinite}
@keyframes acc-pulse{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.7);opacity:0}}
.accueil-root .region small{margin-left:auto;color:var(--faint);font-weight:600;font-size:11px}

.accueil-root .final{background:linear-gradient(120deg,var(--navy),var(--navy-2));color:#fff;border-radius:24px;padding:56px;text-align:center;position:relative;overflow:hidden}
.accueil-root .final h2{font-size:clamp(1.8rem,3.4vw,2.6rem)}
.accueil-root .final p{color:#c4d2e8;margin:16px auto 0;max-width:52ch}
.accueil-root .final .cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:30px}
.accueil-root .final .star{position:absolute;font-size:220px;color:rgba(216,180,94,.06);right:-30px;bottom:-70px;font-family:var(--serif);line-height:1}

.accueil-root footer{background:var(--navy-deep);color:#a9bcd8;padding:52px 0 34px;border-top:1px solid rgba(255,255,255,.07)}
.accueil-root .foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:32px}
.accueil-root footer h4{color:#fff;font-family:var(--serif);font-size:15px;margin-bottom:14px}
.accueil-root footer ul{list-style:none;padding:0;margin:0;display:grid;gap:9px;font-size:13.5px}
.accueil-root footer ul li a:hover{color:#fff}
.accueil-root footer .col p{font-size:13px;color:#8ea6c9;margin-top:8px;max-width:34ch}
.accueil-root .foot-bar{border-top:1px solid rgba(255,255,255,.08);margin-top:38px;padding-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:12.5px;color:#7f96b6}
.accueil-root .foot-bar .tricolor{margin-left:auto}

.accueil-root .rv{opacity:0;transform:translateY(18px);animation:acc-rise .7s cubic-bezier(.2,.7,.2,1) forwards}
.accueil-root .rv.d1{animation-delay:.08s}.accueil-root .rv.d2{animation-delay:.16s}.accueil-root .rv.d3{animation-delay:.24s}
@keyframes acc-rise{to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.accueil-root .rv{animation:none;opacity:1;transform:none}.accueil-root .region .pin::after{animation:none}}

@media(max-width:900px){
  .accueil-root .hero-grid,.accueil-root .sec-grid,.accueil-root .cov-grid{grid-template-columns:1fr;gap:40px}
  .accueil-root .hero-grid{padding:56px 0 64px}
  .accueil-root .kpi-grid{grid-template-columns:1fr 1fr}
  .accueil-root .kpi:nth-child(2){border-right:none}
  .accueil-root .steps{grid-template-columns:1fr 1fr}
  .accueil-root .spaces{grid-template-columns:1fr}
  .accueil-root .foot-grid{grid-template-columns:1fr 1fr}
  .accueil-root .nav .links{display:none}
  .accueil-root .nav{gap:10px}
  .accueil-root section{padding:60px 0}
}
@media(max-width:560px){
  .accueil-root .wrap{padding:0 16px}
  .accueil-root .kpi-grid,.accueil-root .steps,.accueil-root .spaces,.accueil-root .regions,.accueil-root .foot-grid{grid-template-columns:1fr}
  .accueil-root .kpi{border-right:none;border-bottom:1px solid rgba(255,255,255,.08)}
  .accueil-root .final{padding:36px 22px}
  .accueil-root .brand .sub{display:none}
  .accueil-root .nav .right .btn{display:none}
  .accueil-root .hero h1{font-size:clamp(1.9rem,8vw,2.6rem)}
  .accueil-root .hero .lede{font-size:15.5px}
  .accueil-root .hero-meta{gap:18px}
  .accueil-root .hero-cta .btn{flex:1;justify-content:center}
  .accueil-root .shield{max-width:240px}
  .accueil-root .shield .big{font-size:72px}
  .accueil-root section{padding:52px 0}
}
`;
