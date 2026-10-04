"""
scraper_v9_final.py
===================
Estratégia definitiva — endpoint descoberto no HTML:
  brokk.qconcursos.com/product/1/subjects?use_separator=true&discipline_id=X

O dropdown de "Assunto" usa data-ajax-url + data-ajax-custom-params para
carregar os subjects de cada disciplina dinamicamente via Ajax.
Quando nenhuma disciplina está selecionada, retorna todos os subjects globais.
Quando discipline_id é passado, retorna apenas os subjects daquela disciplina.
"""
import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from playwright.async_api import async_playwright, BrowserContext

BASE_URL    = "https://www.qconcursos.com/questoes-de-concursos/questoes"
BROKK       = "https://brokk.qconcursos.com"
OUTPUT_JSON = Path(r"C:\Users\David M\Documents\BuscaQuest\taxonomia_qc_full.json")
OUTPUT_TXT  = Path(r"C:\Users\David M\Documents\BuscaQuest\prompt_grounding_taxonomia.txt")

TARGET_DISCIPLINES = [
    (1,   "Português"),
    (2,   "Direito Administrativo"),
    (3,   "Direito Constitucional"),
    (4,   "Raciocínio Lógico"),
    (9,   "Direito Penal"),
    (10,  "Direito Processual Penal"),
    (13,  "Matemática"),
    (39,  "Matemática Financeira"),
    (40,  "Estatística"),
    (46,  "Noções de Informática"),
    (97,  "Segurança da Informação"),
    (203, "Direito Penal Militar"),
    (204, "Direito Processual Penal Militar"),
    (226, "Matemática Atuarial"),
]

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Origin": "https://www.qconcursos.com",
    "Referer": "https://www.qconcursos.com/",
    "X-Requested-With": "XMLHttpRequest",
}

captured_auth_headers: dict = {}

def clean(s: str) -> str:
    s = re.sub(r"\(\d[\d.,]*\s*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None

def build_flat(raw: list, parent_id=None) -> list:
    out = []
    for s in (raw or []):
        if not isinstance(s, dict): continue
        sid  = to_int(s.get("id") or s.get("subject_id"))
        nome = clean(s.get("name") or s.get("nome") or "")
        if not sid or not nome: continue
        pid  = to_int(s.get("parent_id") or s.get("parentId")) or parent_id
        out.append({"id": sid, "nome": nome, "parent_id": pid})
        kids = s.get("children") or s.get("subjects") or []
        out.extend(build_flat(kids, sid))
    return out

async def api_get(ctx: BrowserContext, url: str) -> Optional[dict | list]:
    hdrs = {**HEADERS, **{k: v for k, v in captured_auth_headers.items()
                          if k in ("authorization","x-api-key","x-product-id","x-token")}}
    try:
        r = await ctx.request.get(url, headers=hdrs, timeout=20000)
        if r.ok:
            return await r.json()
        print(f"    HTTP {r.status} -> {url}")
        return None
    except Exception as e:
        print(f"    ERRO: {str(e)[:100]}")
        return None

async def fetch_subjects(ctx: BrowserContext, disc_id: int) -> list:
    """
    Chama o endpoint real de subjects com discipline_id como filtro.
    Pagina até esgotar os resultados.
    """
    all_subjects = []
    page_num = 1
    seen_ids: set = set()

    while True:
        # Endpoint real descoberto no HTML do site
        url = (f"{BROKK}/product/1/subjects"
               f"?use_separator=true"
               f"&discipline_id={disc_id}"
               f"&per_page=100"
               f"&page={page_num}")

        data = await api_get(ctx, url)
        if not data:
            # Tenta sem use_separator
            url2 = (f"{BROKK}/product/1/subjects"
                    f"?discipline_id={disc_id}&per_page=100&page={page_num}")
            data = await api_get(ctx, url2)

        if not data:
            break

        raw = data if isinstance(data, list) else (
            data.get("data") or data.get("subjects") or data.get("items") or []
        )

        if not raw:
            break

        # Verifica se é o catálogo global (sem filtro de disciplina)
        # O catálogo global tem 258 itens na primeira página
        if page_num == 1 and len(raw) == 258:
            print(f"    AVISO: retornou catálogo global (sem filtro real de discipline_id)")
            # Tenta outras variações de URL
            for alt_url in [
                f"{BROKK}/product/1/subjects?discipline_ids[]={disc_id}&per_page=100",
                f"{BROKK}/product/1/subjects?disciplines[]={disc_id}&per_page=100",
                f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=100&use_separator=true",
                f"{BROKK}/product/1/subjects?filter[discipline_id]={disc_id}&per_page=100",
            ]:
                alt_data = await api_get(ctx, alt_url)
                if alt_data:
                    alt_raw = alt_data if isinstance(alt_data, list) else (
                        alt_data.get("data") or alt_data.get("subjects") or []
                    )
                    if alt_raw and len(alt_raw) != 258:
                        print(f"    OK alternativo ({len(alt_raw)} itens): {alt_url}")
                        raw = alt_raw
                        break
            else:
                # Aceita o catálogo global como subjects desta disciplina
                print(f"    Usando catálogo global filtrado por nome...")
                break

        flat = build_flat(raw)
        new_items = [s for s in flat if s["id"] not in seen_ids]
        seen_ids.update(s["id"] for s in new_items)
        all_subjects.extend(new_items)
        print(f"    Página {page_num}: {len(raw)} raw, {len(new_items)} novos (total: {len(all_subjects)})")

        if len(raw) < 100:
            break
        page_num += 1
        await asyncio.sleep(0.2)

    return all_subjects

def write_json(taxonomy):
    OUTPUT_JSON.write_text(
        json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    total_s = sum(len(d["subjects"]) for d in taxonomy)
    print(f"\n[OK] {OUTPUT_JSON.name} — {len(taxonomy)} disciplinas, {total_s} assuntos")

def write_txt(taxonomy):
    lines = []
    for disc in taxonomy:
        lines.append(f"\n=== DISCIPLINA: [{disc['discipline_id']}] {disc['discipline_nome']} ===")
        roots = [s for s in disc["subjects"] if s["parent_id"] is None]
        cmap  = {}
        for s in disc["subjects"]:
            if s["parent_id"]:
                cmap.setdefault(s["parent_id"], []).append(s)
        for r in roots:
            lines.append(f"[{r['id']}] {r['nome']}")
            for c in cmap.get(r["id"], []):
                lines.append(f"  -> [{c['id']}] {c['nome']}")
                for g in cmap.get(c["id"], []):
                    lines.append(f"    --> [{g['id']}] {g['nome']}")
    OUTPUT_TXT.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] {OUTPUT_TXT.name}")

async def validate(ctx: BrowserContext, taxonomy):
    import random
    samples = [(d["discipline_id"], s["id"]) for d in taxonomy for s in d["subjects"]
               if s["parent_id"] is None]  # Só raízes para validar
    if not samples: print("[!] Sem pares para validar."); return
    print("\n--- Validando 3 URLs ---")
    for disc_id, subj_id in random.sample(samples, min(3, len(samples))):
        url = (f"https://www.qconcursos.com/questoes-de-concursos/questoes"
               f"?discipline_ids[]={disc_id}&subject_ids[]={subj_id}"
               f"&exclude_nullified=true&exclude_outdated=true")
        try:
            r = await ctx.request.get(url, timeout=15000)
            print(f"  HTTP {r.status} | disc={disc_id} subj={subj_id}")
        except Exception as e:
            print(f"  ERRO: {e}")
        print(f"  {url}")

async def main():
    print("=" * 60)
    print("  QConcursos Taxonomy Extractor v9.0 — FINAL")
    print("  Endpoint: /product/1/subjects?discipline_id=X")
    print("=" * 60)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
            ignore_https_errors=True,
        )
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};"
        )
        page = await ctx.new_page()

        # Captura auth headers
        async def on_req(req):
            if "brokk" in req.url:
                captured_auth_headers.update(req.headers)
        page.on("request", on_req)

        print("\n[->] Estabelecendo sessão...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except Exception:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)

        # Clica em Disciplina para disparar XHR e capturar auth headers
        try:
            btn = await page.query_selector("button.dropdown-toggle:has-text('Disciplina')")
            if btn:
                await btn.click()
                await page.wait_for_timeout(2000)
                print("    Dropdown Disciplina aberto")
        except Exception:
            pass

        # Agora clica em Assunto para ver o comportamento
        try:
            btn2 = await page.query_selector("button.dropdown-toggle:has-text('Assunto')")
            if btn2:
                await btn2.click()
                await page.wait_for_timeout(2000)
                print("    Dropdown Assunto aberto")
        except Exception:
            pass

        print(f"\n[->] Extraindo subjects de {len(TARGET_DISCIPLINES)} disciplinas...")
        taxonomy = []
        for disc_id, disc_nome in TARGET_DISCIPLINES:
            print(f"\n  [{disc_id:3}] {disc_nome}")
            subjects = await fetch_subjects(ctx, disc_id)
            unique_count = len(set(s["id"] for s in subjects))
            print(f"  => {unique_count} assuntos únicos")
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": subjects
            })
            await asyncio.sleep(0.3)

        write_json(taxonomy)
        write_txt(taxonomy)
        await validate(ctx, taxonomy)

        print("\n--- Resumo Final ---")
        for d in taxonomy:
            flag = "OK " if d["subjects"] else "---"
            unique = len(set(s["id"] for s in d["subjects"]))
            print(f"  [{flag}] [{d['discipline_id']:3}] {d['discipline_nome']:35} {unique} assuntos únicos")

        await browser.close()
        print("\n[OK] Extração concluída!")

asyncio.run(main())
