"""
NFSe Freire — Serviço de Inteligência Fiscal (Python / FastAPI)

Modelos de IA para:
  A. Previsão de Receita (Regressão Linear + Sazonalidade)
  B. Score de Propensão ao Atraso — SPA (Scoring comportamental)
  C. Detecção de Anomalias / Fuga de Receita (Isolation Forest)
  D. Impacto da Reforma Tributária (IBS/CBS agregado)
  E. KPIs de Inteligência Fiscal (Hiato Tributário, Substituição, etc.)
"""

import os, sys, math, json
from urllib.parse import urlparse

# Força UTF-8 em todo o processo Python (Windows / Windows Terminal)
os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, List

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score
from dotenv import load_dotenv

# Procura .env na raiz do projeto (dois níveis acima de src/ia/)
_env_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
for _enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
    try:
        load_dotenv(dotenv_path=_env_path, encoding=_enc, override=False)
        break
    except Exception:
        pass

# ── Configuração ──────────────────────────────────────────────────────────────
IA_PORT = int(os.getenv("IA_PORT", "8001"))

# Extrai host/porta/user/senha/db do DATABASE_URL (se existir)
def _parse_db_url(url: str) -> dict:
    try:
        p = urlparse(url)
        return {"host": p.hostname or "localhost", "port": p.port or 5432,
                "database": p.path.lstrip("/") or "nfse",
                "user": p.username or "postgres", "password": p.password or "postgres"}
    except Exception:
        return {}

_db = _parse_db_url(os.getenv("DATABASE_URL", ""))

DB_CONFIG = {
    "host":     os.getenv("PGHOST",     _db.get("host",     "localhost")),
    "port":     int(os.getenv("PGPORT", _db.get("port",     5432))),
    "database": os.getenv("PGDATABASE", _db.get("database", "nfse")),
    "user":     os.getenv("PGUSER",     _db.get("user",     "postgres")),
    "password": os.getenv("PGPASSWORD", _db.get("password", "postgres")),
}

# Configurações dos gatilhos de alerta (persistidas em memória; versão futura: banco)
ia_config: Dict = {
    "gatilho_hiato_pct":       10.0,   # % queda na projeção → alerta
    "gatilho_score_atraso":    80.0,   # SPA acima disto → alto risco
    "gatilho_substituicao_pct": 15.0,  # % de substituições → alerta
    "horizonte_previsao":       3,     # meses para forecast
    "anomaly_contamination":    0.1,   # 10 % dos dados são anomalias esperadas
    "alertas_ativos":           True,
}

# ── Banco de dados ────────────────────────────────────────────────────────────
def _conn():
    conn = psycopg2.connect(**DB_CONFIG, connect_timeout=5)
    conn.set_client_encoding("UTF8")
    return conn

def _query(sql: str, params=None) -> List[Dict]:
    conn = _conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params or [])
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

# ── Utilitários de tempo ──────────────────────────────────────────────────────
def _mes_idx(mes: str) -> int:
    """'2024-03' → inteiro sequencial"""
    try:
        y, m = mes.split("-")
        return int(y) * 12 + int(m)
    except Exception:
        return 0

def _idx_mes(n: int) -> str:
    y, rem = divmod(n - 1, 12)
    return f"{y:04d}-{rem + 1:02d}"

# ═══════════════════════════════════════════════════════════════════════════════
# A. PREVISÃO DE RECEITA
# ═══════════════════════════════════════════════════════════════════════════════
def _previsao_receita(horizonte: int = 3) -> dict:
    rows = _query("""
        SELECT
            LEFT(competencia, 7)   AS mes,
            COALESCE(SUM(v_iss), 0) AS total_iss,
            COUNT(*)                AS total_notas
        FROM notas
        WHERE status = 'Ativa'
          AND competencia IS NOT NULL AND competencia <> ''
        GROUP BY LEFT(competencia, 7)
        ORDER BY mes ASC
    """)

    if len(rows) < 3:
        return _previsao_demo(horizonte)

    meses  = [r["mes"]         for r in rows]
    valores = [float(r["total_iss"] or 0) for r in rows]
    notas  = [int(r["total_notas"]  or 0) for r in rows]

    X_idx = np.array([_mes_idx(m) for m in meses])
    meses_num = np.array([int(m.split("-")[1]) for m in meses])

    # Regressão com sazonalidade (sin/cos do mês)
    X = np.column_stack([
        X_idx,
        np.sin(2 * math.pi * meses_num / 12),
        np.cos(2 * math.pi * meses_num / 12),
    ])
    y = np.array(valores)
    model = LinearRegression().fit(X, y)
    r2 = float(r2_score(y, model.predict(X))) if len(y) > 2 else 0.0

    # Histórico: últimos 12 meses
    hist_n = min(12, len(meses))
    hist_meses  = meses[-hist_n:]
    hist_vals   = valores[-hist_n:]
    hist_notas  = notas[-hist_n:]

    # Previsão: próximos N meses
    last = _mes_idx(meses[-1])
    pred_meses = [_idx_mes(last + i + 1) for i in range(horizonte)]
    pred_num   = np.array([last + i + 1           for i in range(horizonte)])
    pred_mnums = np.array([int(m.split("-")[1])   for m in pred_meses])
    X_pred = np.column_stack([
        pred_num,
        np.sin(2 * math.pi * pred_mnums / 12),
        np.cos(2 * math.pi * pred_mnums / 12),
    ])
    pred_vals = [max(0.0, float(v)) for v in model.predict(X_pred)]

    total_prev  = sum(pred_vals)
    last3_real  = sum(valores[-3:]) if len(valores) >= 3 else sum(valores)
    variacao    = ((total_prev - last3_real) / last3_real * 100) if last3_real else 0.0

    return {
        "historico": {"meses": hist_meses, "valores": hist_vals, "notas": hist_notas},
        "previsao":  {"meses": pred_meses, "valores": [round(v, 2) for v in pred_vals]},
        "resumo": {
            "total_previsto_periodo": round(total_prev, 2),
            "variacao_pct":           round(variacao, 1),
            "r2_score":               round(r2, 3),
            "modelo":                 "Regressão Linear + Sazonalidade (sin/cos)",
        },
        "fonte": "real",
    }

def _previsao_demo(horizonte: int) -> dict:
    hoje = datetime.now()
    meses, valores, notas = [], [], []
    for i in range(12, 0, -1):
        d   = hoje - timedelta(days=30 * i)
        mes = f"{d.year:04d}-{d.month:02d}"
        base = 50_000 + 20_000 * math.sin(2 * math.pi * d.month / 12)
        valores.append(round(base + np.random.normal(0, 2_500), 2))
        notas.append(max(1, int(base / 800)))
        meses.append(mes)

    pred_meses, pred_vals = [], []
    for i in range(horizonte):
        d   = hoje + timedelta(days=30 * (i + 1))
        mes = f"{d.year:04d}-{d.month:02d}"
        base = 50_000 + 20_000 * math.sin(2 * math.pi * d.month / 12)
        pred_vals.append(round(base * 1.04, 2))
        pred_meses.append(mes)

    return {
        "historico": {"meses": meses, "valores": valores, "notas": notas},
        "previsao":  {"meses": pred_meses, "valores": pred_vals},
        "resumo": {
            "total_previsto_periodo": round(sum(pred_vals), 2),
            "variacao_pct": 4.0,
            "r2_score": 0.0,
            "modelo": "Demo (dados insuficientes — alimente com NFS-e reais)",
        },
        "fonte": "demo",
    }

# ═══════════════════════════════════════════════════════════════════════════════
# B. SCORE DE PROPENSÃO AO ATRASO (SPA)
# ═══════════════════════════════════════════════════════════════════════════════
def _inadimplencia() -> dict:
    rows = _query("""
        SELECT
            cnpj, competencia, status,
            COALESCE(total_iss_proprio, 0) + COALESCE(total_iss_terceiros, 0) AS total_iss,
            guia->>'dataVencimento' AS vencimento,
            data_pagamento
        FROM apuracoes
        ORDER BY competencia DESC
    """)

    if not rows:
        return _inadimplencia_demo()

    hoje_str = datetime.now().strftime("%Y-%m-%d")
    por_cnpj: Dict[str, list] = {}
    for r in rows:
        por_cnpj.setdefault(r["cnpj"], []).append(r)

    scores = []
    for cnpj, guias in por_cnpj.items():
        total = len(guias)
        pagas = sum(1 for g in guias if g["status"] == "Paga")
        vencidas_abertas = sum(
            1 for g in guias
            if g["status"] != "Paga" and g.get("vencimento") and str(g["vencimento"]) < hoje_str
        )

        # Dias médios de atraso nos pagamentos realizados
        atrasos = []
        for g in guias:
            try:
                if g.get("data_pagamento") and g.get("vencimento"):
                    venc  = datetime.fromisoformat(str(g["vencimento"]))
                    pago  = g["data_pagamento"]
                    pago_d = pago if hasattr(pago, "date") else datetime.fromisoformat(str(pago))
                    delta = (pago_d - venc).days
                    if delta > 0:
                        atrasos.append(delta)
            except Exception:
                pass

        taxa_inad = (total - pagas) / total if total > 0 else 0.0
        dias_med  = float(np.mean(atrasos)) if atrasos else 0.0

        # SPA: 0–100 (maior = mais risco)
        score = int(min(100,
            taxa_inad * 50
            + min(dias_med / 2, 30)
            + vencidas_abertas * 10
        ))

        total_iss_aberto = sum(
            float(g.get("total_iss") or 0)
            for g in guias if g["status"] != "Paga"
        )

        scores.append({
            "cnpj":                   cnpj,
            "score":                  score,
            "nivel_risco":            "Alto" if score >= 70 else ("Médio" if score >= 40 else "Baixo"),
            "total_guias":            total,
            "guias_pagas":            pagas,
            "guias_abertas_vencidas": vencidas_abertas,
            "taxa_inadimplencia_pct": round(taxa_inad * 100, 1),
            "dias_medio_atraso":      round(dias_med, 0),
            "total_iss_em_aberto":    round(total_iss_aberto, 2),
            "alerta":                 score >= ia_config["gatilho_score_atraso"],
        })

    scores.sort(key=lambda x: x["score"], reverse=True)

    dist = {
        "alto":  sum(1 for s in scores if s["nivel_risco"] == "Alto"),
        "medio": sum(1 for s in scores if s["nivel_risco"] == "Médio"),
        "baixo": sum(1 for s in scores if s["nivel_risco"] == "Baixo"),
    }
    return {
        "scores":               scores[:50],
        "distribuicao":         dist,
        "total_contribuintes":  len(scores),
        "media_score":          round(float(np.mean([s["score"] for s in scores])), 1) if scores else 0.0,
        "fonte":                "real",
    }

def _inadimplencia_demo() -> dict:
    import random; random.seed(42)
    scores = []
    for i in range(18):
        score = random.randint(0, 100)
        cnpj  = f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99):02d}"
        scores.append({
            "cnpj":                   cnpj,
            "score":                  score,
            "nivel_risco":            "Alto" if score >= 70 else ("Médio" if score >= 40 else "Baixo"),
            "total_guias":            random.randint(2, 12),
            "guias_pagas":            random.randint(0, 6),
            "guias_abertas_vencidas": random.randint(0, 3),
            "taxa_inadimplencia_pct": round(random.uniform(0, 100), 1),
            "dias_medio_atraso":      random.randint(0, 45),
            "total_iss_em_aberto":    round(random.uniform(0, 15_000), 2),
            "alerta":                 score >= ia_config["gatilho_score_atraso"],
        })
    scores.sort(key=lambda x: x["score"], reverse=True)
    dist = {
        "alto":  sum(1 for s in scores if s["nivel_risco"] == "Alto"),
        "medio": sum(1 for s in scores if s["nivel_risco"] == "Médio"),
        "baixo": sum(1 for s in scores if s["nivel_risco"] == "Baixo"),
    }
    return {
        "scores": scores,
        "distribuicao": dist,
        "total_contribuintes": len(scores),
        "media_score": round(float(np.mean([s["score"] for s in scores])), 1),
        "fonte": "demo",
    }

# ═══════════════════════════════════════════════════════════════════════════════
# C. DETECÇÃO DE ANOMALIAS / FUGA DE RECEITA (Isolation Forest)
# ═══════════════════════════════════════════════════════════════════════════════
def _anomalias() -> dict:
    rows = _query("""
        SELECT
            prestador_cnpj                    AS cnpj,
            MAX(prestador_nome)               AS nome,
            LEFT(competencia, 7)              AS mes,
            COALESCE(SUM(v_serv), 0)          AS total_serv,
            COALESCE(AVG(v_serv), 0)          AS media_serv,
            COALESCE(SUM(v_iss), 0)           AS total_iss,
            COUNT(*)                          AS qtd
        FROM notas
        WHERE status = 'Ativa' AND prestador_cnpj IS NOT NULL
        GROUP BY prestador_cnpj, LEFT(competencia, 7)
        ORDER BY mes DESC
    """)

    if len(rows) < 10:
        return _anomalias_demo()

    # Agrega por CNPJ
    agg: Dict[str, dict] = {}
    for r in rows:
        c = r["cnpj"]
        if c not in agg:
            agg[c] = {"nome": r["nome"] or c, "serv": [], "iss": [], "qtd": []}
        agg[c]["serv"].append(float(r["total_serv"] or 0))
        agg[c]["iss"].append(float(r["total_iss"]  or 0))
        agg[c]["qtd"].append(int(r["qtd"]          or 0))

    cnpjs, feats = [], []
    for c, d in agg.items():
        if not d["serv"]: continue
        cnpjs.append(c)
        feats.append([
            float(np.mean(d["serv"])),
            float(np.std(d["serv"])) if len(d["serv"]) > 1 else 0.0,
            float(np.mean(d["qtd"])),
            float(np.mean(d["iss"])),
        ])

    if len(feats) < 5:
        return _anomalias_demo()

    X = StandardScaler().fit_transform(np.array(feats))
    cont = max(0.05, min(0.3, ia_config["anomaly_contamination"]))
    iso  = IsolationForest(contamination=cont, random_state=42, n_estimators=100)
    labels = iso.fit_predict(X)        # -1 = anomalia
    raw_scores = iso.score_samples(X)  # menor = mais anômalo

    min_s, max_s = raw_scores.min(), raw_scores.max()
    norm = (1 - (raw_scores - min_s) / (max_s - min_s + 1e-9)) * 100

    resultado = []
    for i, c in enumerate(cnpjs):
        d = agg[c]
        resultado.append({
            "cnpj":           c,
            "nome":           d["nome"],
            "is_anomalia":    bool(labels[i] == -1),
            "score_anomalia": round(float(norm[i]), 1),
            "media_mensal":   round(float(np.mean(d["serv"])), 2),
            "desvio":         round(float(np.std(d["serv"])) if len(d["serv"]) > 1 else 0.0, 2),
            "total_notas":    sum(d["qtd"]),
            "total_iss":      round(sum(d["iss"]), 2),
        })

    resultado.sort(key=lambda x: x["score_anomalia"], reverse=True)
    anomalias = [r for r in resultado if r["is_anomalia"]]

    return {
        "anomalias": anomalias[:20],
        "todos":     resultado[:60],
        "resumo": {
            "total_analisados": len(resultado),
            "total_anomalias":  len(anomalias),
            "pct_anomalias":    round(len(anomalias) / len(resultado) * 100, 1) if resultado else 0.0,
        },
        "fonte": "real",
    }

def _anomalias_demo() -> dict:
    import random; random.seed(7)
    resultado = []
    for i in range(22):
        score = random.randint(5, 98)
        resultado.append({
            "cnpj":           f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99):02d}",
            "nome":           f"Empresa Demo {i+1} Serviços Ltda",
            "is_anomalia":    score >= 70,
            "score_anomalia": score,
            "media_mensal":   round(random.uniform(500, 80_000), 2),
            "desvio":         round(random.uniform(50, 20_000), 2),
            "total_notas":    random.randint(1, 60),
            "total_iss":      round(random.uniform(100, 8_000), 2),
        })
    resultado.sort(key=lambda x: x["score_anomalia"], reverse=True)
    anomalias = [r for r in resultado if r["is_anomalia"]]
    return {
        "anomalias": anomalias,
        "todos":     resultado,
        "resumo":    {"total_analisados": len(resultado), "total_anomalias": len(anomalias), "pct_anomalias": round(len(anomalias)/22*100,1)},
        "fonte":     "demo",
    }

# ═══════════════════════════════════════════════════════════════════════════════
# D. IMPACTO DA REFORMA TRIBUTÁRIA (IBS/CBS)
# ═══════════════════════════════════════════════════════════════════════════════
def _reforma() -> dict:
    rows = _query("""
        SELECT
            LEFT(competencia, 7)                               AS mes,
            COALESCE(SUM(v_iss),   0)                          AS iss_mun,
            COALESCE(SUM((tributos->>'vIBSMun')::numeric), 0)  AS ibs_mun,
            COALESCE(SUM((tributos->>'vCBS')::numeric),    0)  AS cbs,
            COALESCE(SUM(v_serv),  0)                          AS total_serv,
            COUNT(*)                                            AS qtd
        FROM notas
        WHERE status = 'Ativa' AND competencia IS NOT NULL
        GROUP BY LEFT(competencia, 7)
        ORDER BY mes DESC
        LIMIT 12
    """)

    if not rows:
        return _reforma_demo()

    rows = list(reversed(rows))
    meses = [r["mes"]              for r in rows]
    iss   = [float(r["iss_mun"]  or 0) for r in rows]
    ibs   = [float(r["ibs_mun"]  or 0) for r in rows]
    cbs   = [float(r["cbs"]      or 0) for r in rows]
    serv  = [float(r["total_serv"]or 0) for r in rows]
    notas = [int(r["qtd"]         or 0) for r in rows]

    tot_iss = sum(iss); tot_ibs = sum(ibs); tot_cbs = sum(cbs)
    tot_trib = tot_iss + tot_ibs + tot_cbs

    return {
        "historico": {"meses": meses, "iss_municipal": iss, "ibs_municipal": ibs, "cbs": cbs, "total_servicos": serv, "notas": notas},
        "resumo": {
            "total_iss":         round(tot_iss, 2),
            "total_ibs":         round(tot_ibs, 2),
            "total_cbs":         round(tot_cbs, 2),
            "proporcao_iss_pct": round(tot_iss / tot_trib * 100, 1) if tot_trib else 0.0,
            "proporcao_new_pct": round((tot_ibs + tot_cbs) / tot_trib * 100, 1) if tot_trib else 0.0,
        },
        "fonte": "real",
    }

def _reforma_demo() -> dict:
    import random; random.seed(3)
    hoje = datetime.now()
    meses, iss, ibs, cbs, serv, notas = [], [], [], [], [], []
    for i in range(12, 0, -1):
        d    = hoje - timedelta(days=30 * i)
        mes  = f"{d.year:04d}-{d.month:02d}"
        base = 40_000 + 15_000 * math.sin(2 * math.pi * d.month / 12)
        factor_reform = 1 + (12 - i) * 0.02   # crescimento gradual IBS/CBS
        meses.append(mes); notas.append(random.randint(40, 180))
        iss.append(round(base + random.uniform(-2_000, 2_000), 2))
        ibs.append(round(base * 0.04 * factor_reform, 2))
        cbs.append(round(base * 0.025 * factor_reform, 2))
        serv.append(round(base / 0.05, 2))

    tot_iss = sum(iss); tot_ibs = sum(ibs); tot_cbs = sum(cbs)
    tot_trib = tot_iss + tot_ibs + tot_cbs
    return {
        "historico": {"meses": meses, "iss_municipal": iss, "ibs_municipal": ibs, "cbs": cbs, "total_servicos": serv, "notas": notas},
        "resumo": {
            "total_iss":         round(tot_iss, 2),
            "total_ibs":         round(tot_ibs, 2),
            "total_cbs":         round(tot_cbs, 2),
            "proporcao_iss_pct": round(tot_iss / tot_trib * 100, 1),
            "proporcao_new_pct": round((tot_ibs + tot_cbs) / tot_trib * 100, 1),
        },
        "fonte": "demo",
    }

# ═══════════════════════════════════════════════════════════════════════════════
# E. KPIs DE INTELIGÊNCIA FISCAL
# ═══════════════════════════════════════════════════════════════════════════════
def _kpis() -> dict:
    # ISS último mês completo
    r_iss = _query("""
        SELECT COALESCE(SUM(v_iss),0) AS iss_real, COALESCE(AVG(v_serv),0) AS ticket,
               COUNT(*) AS notas, COUNT(DISTINCT prestador_cnpj) AS emissores
        FROM notas
        WHERE status='Ativa'
          AND LEFT(competencia,7) = TO_CHAR(date_trunc('month', NOW()-INTERVAL '1 month'),'YYYY-MM')
    """)

    # Total de emissores ativos
    r_emit = _query("SELECT COUNT(DISTINCT prestador_cnpj) AS total FROM notas WHERE status='Ativa'")

    # Novos emissores (últimos 3 meses vs antes)
    r_novos = _query("""
        SELECT COUNT(DISTINCT prestador_cnpj) AS novos
        FROM notas
        WHERE LEFT(competencia,7) >= TO_CHAR(NOW()-INTERVAL '3 months','YYYY-MM')
          AND prestador_cnpj NOT IN (
              SELECT DISTINCT prestador_cnpj FROM notas
              WHERE LEFT(competencia,7) < TO_CHAR(NOW()-INTERVAL '3 months','YYYY-MM')
          )
    """)

    # Taxa de substituição (c_stat com substituição)
    r_sub = _query("""
        SELECT COUNT(DISTINCT prestador_cnpj) AS cnpjs_sub
        FROM notas
        WHERE c_stat IN ('101103','106','107')
          AND LEFT(competencia,7) >= TO_CHAR(NOW()-INTERVAL '3 months','YYYY-MM')
    """)

    # Previsão próximo mês (1 mês)
    prev = _previsao_receita(1)
    iss_prev   = prev["previsao"]["valores"][0] if prev["previsao"]["valores"] else 0.0
    iss_real   = float(r_iss[0]["iss_real"]  or 0) if r_iss else 0.0
    ticket     = float(r_iss[0]["ticket"]    or 0) if r_iss else 0.0
    notas_tot  = int(r_iss[0]["notas"]       or 0) if r_iss else 0
    emit_tot   = int(r_emit[0]["total"]      or 0) if r_emit else 0
    novos      = int(r_novos[0]["novos"]     or 0) if r_novos else 0
    cnpjs_sub  = int(r_sub[0]["cnpjs_sub"]   or 0) if r_sub else 0

    hiato     = iss_prev - iss_real
    hiato_pct = (hiato / iss_prev * 100) if iss_prev else 0.0
    sub_pct   = (cnpjs_sub / emit_tot * 100) if emit_tot else 0.0

    return {
        "saude_fiscal": {
            "iss_real_ultimo_mes":     round(iss_real, 2),
            "iss_previsto_proximo_mes": round(iss_prev, 2),
            "hiato_tributario":        round(hiato, 2),
            "hiato_pct":               round(hiato_pct, 1),
            "alerta_hiato":            abs(hiato_pct) > ia_config["gatilho_hiato_pct"],
        },
        "conformidade": {
            "total_notas_ultimo_mes":  notas_tot,
            "total_emissores":         emit_tot,
            "novos_emissores_3m":      novos,
            "taxa_substituicao_pct":   round(sub_pct, 1),
            "alerta_substituicao":     sub_pct > ia_config["gatilho_substituicao_pct"],
        },
        "dinamica": {
            "ticket_medio": round(ticket, 2),
        },
    }

# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI
# ═══════════════════════════════════════════════════════════════════════════════
app = FastAPI(title="NFSe Freire — IA Fiscal", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/ia/status")
def status():
    try:
        conn = _conn(); conn.close(); db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "db": db_ok, "ts": datetime.now().isoformat(), "version": "1.0.0"}

@app.get("/api/ia/previsao-receita")
def previsao_receita(horizonte: int = 3):
    try:
        return _previsao_receita(min(horizonte, 6))
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/ia/inadimplencia")
def inadimplencia():
    try:
        return _inadimplencia()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/ia/anomalias")
def anomalias():
    try:
        return _anomalias()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/ia/reforma")
def reforma():
    try:
        return _reforma()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/ia/kpis")
def kpis():
    try:
        return _kpis()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/ia/config")
def get_config():
    return ia_config

@app.put("/api/ia/config")
def update_config(data: dict):
    for k, v in data.items():
        if k in ia_config:
            ia_config[k] = v
    return {"sucesso": True, "config": ia_config}

# ═══════════════════════════════════════════════════════════════════════════════
# F. CONFORMIDADE PGDAS-D vs. ADN
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/ia/pgdas-conformidade")
def pgdas_conformidade():
    try:
        rows = _query("""
            SELECT
                COUNT(*)                                         AS total,
                COUNT(*) FILTER (WHERE status = 'ok')            AS ok,
                COUNT(*) FILTER (WHERE status = 'divergente')    AS divergentes,
                COUNT(*) FILTER (WHERE status = 'malha')         AS malha,
                COUNT(*) FILTER (WHERE retido_malha = TRUE)      AS retidos_malha,
                COUNT(*) FILTER (WHERE impedido_iss  = TRUE)     AS impedidos_iss,
                COUNT(*) FILTER (WHERE operacao = 'R')           AS retificacoes,
                COALESCE(AVG(NULLIF(rbt12_oficial,0)), 0)        AS rbt12_medio_oficial,
                COALESCE(SUM(rb_adn), 0)                         AS rb_adn_total,
                COALESCE(SUM(v_receita_pa), 0)                   AS rb_pgdas_total,
                COALESCE(SUM(v_iss_declarado), 0)                AS iss_declarado_total
            FROM pgdas_declaracoes
            WHERE competencia >= TO_CHAR(NOW() - INTERVAL '3 months', 'YYYY-MM')
        """)
        if not rows:
            return _pgdas_conformidade_demo()
        r = rows[0]
        total = int(r.get("total") or 0)
        if total == 0:
            return _pgdas_conformidade_demo()

        ok         = int(r.get("ok")          or 0)
        diverg     = int(r.get("divergentes") or 0)
        malha      = int(r.get("malha")       or 0)
        ret_malha  = int(r.get("retidos_malha") or 0)
        imp_iss    = int(r.get("impedidos_iss") or 0)
        retific    = int(r.get("retificacoes") or 0)
        conf_pct   = round(ok / total * 100, 1) if total else 0.0
        div_pct    = round(diverg / total * 100, 1) if total else 0.0
        rb_adn     = float(r.get("rb_adn_total") or 0)
        rb_pgdas   = float(r.get("rb_pgdas_total") or 0)
        iss_decl   = float(r.get("iss_declarado_total") or 0)
        rbt12_med  = float(r.get("rbt12_medio_oficial") or 0)
        gap_rb     = rb_adn - rb_pgdas

        # Sublimite próximo
        sub_rows = _query("""
            SELECT COUNT(*) AS cnt
            FROM pgdas_declaracoes
            WHERE rbt12_oficial > 3240000 AND rbt12_oficial <= 3600000
        """)
        sublimite_risco = int((sub_rows[0].get("cnt") or 0) if sub_rows else 0)

        return {
            "fonte": "real",
            "total":             total,
            "ok":                ok,
            "divergentes":       diverg,
            "malha":             malha,
            "retidos_malha":     ret_malha,
            "impedidos_iss":     imp_iss,
            "retificacoes":      retific,
            "sublimite_risco":   sublimite_risco,
            "conformidade_pct":  conf_pct,
            "divergencia_pct":   div_pct,
            "rb_adn_total":      round(rb_adn, 2),
            "rb_pgdas_total":    round(rb_pgdas, 2),
            "gap_receita":       round(gap_rb, 2),
            "iss_declarado_total": round(iss_decl, 2),
            "rbt12_medio_oficial": round(rbt12_med, 2),
        }
    except Exception as e:
        return _pgdas_conformidade_demo()

def _pgdas_conformidade_demo():
    import random; random.seed(7)
    total = random.randint(30, 80)
    ok    = int(total * 0.65)
    diverg = int(total * 0.18)
    malha  = total - ok - diverg
    rb_adn   = round(random.uniform(400_000, 900_000), 2)
    rb_pgdas = round(rb_adn * random.uniform(0.80, 0.98), 2)
    return {
        "fonte": "demo",
        "total": total, "ok": ok, "divergentes": diverg, "malha": malha,
        "retidos_malha": malha, "impedidos_iss": random.randint(0, 5),
        "retificacoes": random.randint(1, 8), "sublimite_risco": random.randint(0, 4),
        "conformidade_pct": round(ok / total * 100, 1),
        "divergencia_pct":  round(diverg / total * 100, 1),
        "rb_adn_total": rb_adn, "rb_pgdas_total": rb_pgdas,
        "gap_receita": round(rb_adn - rb_pgdas, 2),
        "iss_declarado_total": round(rb_pgdas * 0.03, 2),
        "rbt12_medio_oficial": round(random.uniform(150_000, 500_000), 2),
    }

# ═══════════════════════════════════════════════════════════════════════════════
# G. MALHA PGDAS-D — Subdeclaração de Receita
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/ia/pgdas-malha")
def pgdas_malha():
    try:
        rows = _query("""
            SELECT
                p.cnpj,
                p.competencia,
                p.rb_adn,
                p.v_receita_pa,
                p.v_iss_declarado,
                p.retido_malha,
                p.impedido_iss,
                p.operacao,
                p.rbt12_oficial,
                COALESCE(p.rb_adn, 0) - COALESCE(p.v_receita_pa, 0) AS gap_receita,
                CASE
                  WHEN COALESCE(p.v_receita_pa, 0) > 0
                  THEN ROUND(
                    ((COALESCE(p.rb_adn, 0) - COALESCE(p.v_receita_pa, 0))
                     / p.v_receita_pa * 100)::numeric, 1)
                  ELSE NULL
                END AS gap_pct
            FROM pgdas_declaracoes p
            WHERE p.v_receita_pa IS NOT NULL
              AND (
                p.retido_malha = TRUE
                OR p.impedido_iss = TRUE
                OR (p.rb_adn > 0
                    AND p.v_receita_pa > 0
                    AND p.rb_adn > p.v_receita_pa * 1.10)
              )
            ORDER BY gap_receita DESC NULLS LAST
            LIMIT 50
        """)
        if len(rows) < 2:
            return _pgdas_malha_demo()

        alertas = []
        for r in rows:
            motivos = []
            if r.get("retido_malha"):     motivos.append("Retido em Malha")
            if r.get("impedido_iss"):     motivos.append("Impedido ISS")
            if r.get("operacao") == "R":  motivos.append("Retificação")
            gap_pct = float(r.get("gap_pct") or 0)
            if gap_pct > 20: motivos.append(f"Subdecl. {gap_pct:.1f}%")
            alertas.append({
                "cnpj":          r["cnpj"],
                "competencia":   r["competencia"],
                "rb_adn":        float(r.get("rb_adn") or 0),
                "rb_pgdas":      float(r.get("v_receita_pa") or 0),
                "iss_declarado": float(r.get("v_iss_declarado") or 0),
                "rbt12":         float(r.get("rbt12_oficial") or 0),
                "gap_receita":   float(r.get("gap_receita") or 0),
                "gap_pct":       gap_pct,
                "retido_malha":  bool(r.get("retido_malha")),
                "impedido_iss":  bool(r.get("impedido_iss")),
                "operacao":      r.get("operacao") or "A",
                "motivos":       motivos,
                "nivel": "alto" if gap_pct > 30 or r.get("retido_malha") else
                         ("medio" if gap_pct > 10 or r.get("impedido_iss") else "baixo"),
            })

        return {
            "fonte":    "real",
            "alertas":  alertas,
            "total":    len(alertas),
            "retidos":  sum(1 for a in alertas if a["retido_malha"]),
            "impedidos":sum(1 for a in alertas if a["impedido_iss"]),
            "gap_total":round(sum(a["gap_receita"] for a in alertas), 2),
        }
    except Exception as e:
        return _pgdas_malha_demo()

def _pgdas_malha_demo():
    import random; random.seed(11)
    alertas = []
    for i in range(12):
        rb_adn  = round(random.uniform(10_000, 180_000), 2)
        rb_pgd  = round(rb_adn * random.uniform(0.50, 0.90), 2)
        gap     = round(rb_adn - rb_pgd, 2)
        gap_pct = round((gap / rb_pgd) * 100, 1) if rb_pgd else 0
        malha   = random.random() < 0.2
        imp     = random.random() < 0.15
        motivos = []
        if malha:      motivos.append("Retido em Malha")
        if imp:        motivos.append("Impedido ISS")
        if gap_pct > 20: motivos.append(f"Subdecl. {gap_pct:.1f}%")
        cnpj = f"{random.randint(10,99):02d}{random.randint(100,999):03d}{random.randint(100,999):03d}0001{random.randint(10,99):02d}"
        alertas.append({
            "cnpj": cnpj, "competencia": "2026-02",
            "rb_adn": rb_adn, "rb_pgdas": rb_pgd, "iss_declarado": round(rb_pgd*0.03,2),
            "rbt12": round(random.uniform(100_000, 800_000), 2),
            "gap_receita": gap, "gap_pct": gap_pct,
            "retido_malha": malha, "impedido_iss": imp, "operacao": "A",
            "motivos": motivos,
            "nivel": "alto" if gap_pct > 30 or malha else ("medio" if gap_pct > 10 or imp else "baixo"),
        })
    alertas.sort(key=lambda x: x["gap_receita"], reverse=True)
    return {
        "fonte": "demo", "alertas": alertas, "total": len(alertas),
        "retidos": sum(1 for a in alertas if a["retido_malha"]),
        "impedidos": sum(1 for a in alertas if a["impedido_iss"]),
        "gap_total": round(sum(a["gap_receita"] for a in alertas), 2),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=IA_PORT, log_level="info")
