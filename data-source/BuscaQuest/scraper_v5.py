import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL    = "https://www.qconcursos.com/questoes-de-concursos/questoes"
BROKK       = "https://brokk.qconcursos.com"
OUTPUT_JSON = Path("taxonomia_qc_full.json")
OUTPUT_TXT  = Path("prompt_grounding_taxonomia.txt")

# Filtro EXATO por nome (substrings, mas restritas o suficiente)
# Nao usar "legislacao" generico — muito amplo!
PRIORITY_EXACT = [
    "lingua portuguesa", "língua portuguesa",
    "direito constitucional",
    "direito administrativo",
    "direito penal",           # vai pegar Direito Penal e Direito Penal Militar
    "direito processual penal",
    "legislação especial", "legislacao especial",
    "legislação extravagante", "legislacao extravagante",
    "raciocínio lógico", "raciocinio logico",
    "matemática", "matematica",
    "estatística", "estatistica",
    "informática", "informatica",
    "segurança da informação", "seguranca da informacao",
    "tecnologia da informação", "tecnologia da informacao",
    "português", "portugues",
]

# IDs descobertos na execucao anterior (garantia de captura)
KNOWN_IDS = {2, 3, 9, 10, 203, 204}  # Dir.Adm, Dir.Const, Dir.Penal, Dir.Proc.Penal + Militares

def clean(s: str) -> str:
    s = re.sub(r"\(\d[\d.,]*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None

captured_req_headers: dict = {}

async def setup_interceptor(page: Page):
    async def on_req(req):
        if "brokk.qconcursos.com" in req.url:
            captured_req_headers.update(req.headers)
    async def on_resp(resp):
        if "brokk.qconcursos.com" in resp.url and "json" in resp.headers.get("content-type",""):
            try:
                body = await resp.json()
                n = len(body) if isinstance(body,list) else "obj"
                print(f"[XHR] {resp.url} -> {n} items")
            except: pass
    page.on("request", on_req)
    page.on("response", on_resp)

def is_priority(disc_id: int, nome: str) -> bool:
    if disc_id in KNOWN_IDS:
        return True
    nome_l = nome.lower()
    return any(p in nome_l for p in PRIORITY_EXACT)

def build_subjects_flat(raw: list, parent_id=None) -> list:
    out = []
    for s in (raw or []):
        if not isinstance(s, dict): continue
        sid  = to_int(s.get("id") or s.get("subject_id"))
        nome = clean(s.get("name") or s.get("nome") or "")
        if not sid or not nome: continue
        out.append({"id": sid, "nome": nome, "parent_id": parent_id})
        kids = s.get("children") or s.get("subjects") or s.get("sub_subjects") or []
        out.extend(build_subjects_flat(kids, sid))
    return out

async def api_get(ctx: BrowserContext, url: str):
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Origin": "https://www.qconcursos.com",
        "Referer": "https://www.qconcursos.com/",
        "X-Requested-With": "XMLHttpRequest",
    }
    for h in ("authorization","x-api-key","x-product-id","x-app-version","x-token"):
        if h in captured_req_headers:
            headers[h] = captured_req_headers[h]
    try:
        resp = await ctx.request.get(url, headers=headers, timeout=20000)
        return await resp.json() if resp.ok else None
    except Exception as e:
        print(f"    ERRO api_get: {str(e)[:120]}")
        return None

async def fetch_all_disciplines(ctx: BrowserContext) -> list:
    all_items, p = [], 1
    while True:
        data = await api_get(ctx, f"{BROKK}/product/1/disciplines?per_page=100&page={p}")
        if not data: break
        items = data if isinstance(data, list) else (data.get("data") or data.get("disciplines") or [])
        if not items: break
        all_items.extend(items)
        print(f"  Pagina {p}: {len(items)} disciplinas (acumulado: {len(all_items)})")
        if len(items) < 100: break
        p += 1
    return all_items

async def fetch_subjects(ctx: BrowserContext, disc_id: int) -> list:
    for url in [
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=500&include=children",
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=500",
        f"{BROKK}/product/1/subjects?discipline_id={disc_id}&per_page=500",
    ]:
        data = await api_get(ctx, url)
        if not data: continue
        raw = data if isinstance(data, list) else (data.get("data") or data.get("subjects") or [])
        if raw:
            flat = build_subjects_flat(raw)
            print(f"    [{disc_id}] {len(flat)} assuntos")
            return flat
    return []

def write_json(taxonomy):
    OUTPUT_JSON.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8")
    total_s = sum(len(d["subjects"]) for d in taxonomy)
    print(f"\n[OK] {OUTPUT_JSON} -- {len(taxonomy)} disciplinas, {total_s} assuntos")

def write_txt(taxonomy):
    lines = []
    for disc in taxonomy:
        lines.append(f"\n=== DISCIPLINA: [{disc['discipline_id']}] {disc['discipline_nome']} ===")
        roots = [s for s in disc["subjects"] if s["parent_id"] is None]
        cmap  = {}
        for s in disc["subjects"]:
            if s["parent_id"]: cmap.setdefault(s["parent_id"], []).append(s)
        for r in roots:
            lines.append(f"[{r['id']}] {r['nome']}")
            for c in cmap.get(r["id"], []):
                lines.append(f"  -> [{c['id']}] {c['nome']}")
                for g in cmap.get(c["id"], []):
                    lines.append(f"    --> [{g['id']}] {g['nome']}")
    OUTPUT_TXT.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] {OUTPUT_TXT}")

async def validate(ctx: BrowserContext, taxonomy):
    import random
    samples = [(d["discipline_id"], s["id"]) for d in taxonomy for s in d["subjects"]]
    if not samples: return
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
    print("="*60)
    print("  QConcursos Taxonomy Extractor v5.0 — Filtro Cirurgico")
    print("="*60)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox","--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            viewport={"width":1280,"height":900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            locale="pt-BR",
            ignore_https_errors=True,
        )
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};"
        )
        page = await ctx.new_page()
        await setup_interceptor(page)

        print(f"\n[->] Carregando pagina...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)

        # Clica em Disciplina para ativar sessao e capturar headers auth
        print("[->] Ativando sessao da API...")
        for sel in ["button:has-text('Disciplina')","button:has-text('Filtrar')","[class*='discipline']"]:
            try:
                el = await page.query_selector(sel)
                if el:
                    await el.click()
                    await page.wait_for_timeout(2000)
                    break
            except: pass

        print("\n[->] Buscando todas as disciplinas...")
        raw_disciplines = await fetch_all_disciplines(ctx)
        print(f"\n    Total bruto: {len(raw_disciplines)} disciplinas")

        # Filtro cirurgico
        selected = []
        skipped  = []
        for d in raw_disciplines:
            disc_id   = to_int(d.get("id") or d.get("discipline_id"))
            disc_nome = clean(d.get("name") or d.get("nome") or "")
            if not disc_id or not disc_nome: continue
            if is_priority(disc_id, disc_nome):
                selected.append((disc_id, disc_nome))
            else:
                skipped.append(f"[{disc_id}] {disc_nome}")

        print(f"\n[->] Disciplinas selecionadas ({len(selected)}):")
        for did, dn in selected:
            print(f"    [{did}] {dn}")
        print(f"\n[->] Puladas: {len(skipped)}")

        taxonomy = []
        for disc_id, disc_nome in selected:
            print(f"\n  [{disc_id}] {disc_nome} -- assuntos...")
            subjects = await fetch_subjects(ctx, disc_id)
            taxonomy.append({"discipline_id": disc_id, "discipline_nome": disc_nome, "subjects": subjects})
            await asyncio.sleep(0.3)

        write_json(taxonomy)
        write_txt(taxonomy)
        await validate(ctx, taxonomy)
        await browser.close()
        print("\n[OK] Concluido!")

asyncio.run(main())
