import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

# Fix encoding UTF-8 no Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

try:
    from playwright.async_api import async_playwright, Page, BrowserContext
except ImportError:
    print("playwright nao encontrado"); sys.exit(1)

BASE_URL    = "https://www.qconcursos.com/questoes-de-concursos/questoes"
BROKK       = "https://brokk.qconcursos.com"
OUTPUT_JSON = Path("taxonomia_qc_full.json")
OUTPUT_TXT  = Path("prompt_grounding_taxonomia.txt")

PRIORITY = [
    "lingua portuguesa","portugues","direito constitucional","direito administrativo",
    "direito penal","processual penal","legislacao","legislação","raciocinio logico",
    "raciocínio","estatistica","informatica","informática","seguranca da informacao","segurança"
]

def clean(s: str) -> str:
    s = re.sub(r"\(\d[\d.,]*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None

HEADERS_BASE = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Origin": "https://www.qconcursos.com",
    "Referer": "https://www.qconcursos.com/",
    "X-Requested-With": "XMLHttpRequest",
}

captured_req_headers: dict = {}

async def setup_interceptor(page: Page):
    async def on_req(req):
        if "brokk.qconcursos.com" in req.url:
            captured_req_headers.update(req.headers)
            useful = {k:v for k,v in req.headers.items() if k in ('authorization','x-api-key','x-product-id')}
            if useful:
                print(f"[AUTH] Headers uteis capturados: {useful}")
    async def on_resp(resp):
        if "brokk.qconcursos.com" in resp.url:
            ct = resp.headers.get("content-type","")
            if "json" in ct:
                try:
                    body = await resp.json()
                    n = len(body) if isinstance(body,list) else "obj"
                    print(f"[XHR] {resp.url} -> {n}")
                except: pass
    page.on("request", on_req)
    page.on("response", on_resp)

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

async def api_get(ctx: BrowserContext, url: str) -> Optional[dict | list]:
    headers = {**HEADERS_BASE}
    if captured_req_headers:
        for h in ("authorization","x-api-key","x-product-id","x-app-version","x-token"):
            if h in captured_req_headers:
                headers[h] = captured_req_headers[h]
    try:
        resp = await ctx.request.get(url, headers=headers, timeout=20000)
        if resp.ok:
            return await resp.json()
        else:
            print(f"    HTTP {resp.status} para {url}")
            return None
    except Exception as e:
        msg = str(e)
        # Remove o bloco de cookie enorme do log de erro
        if "cookie:" in msg:
            msg = msg[:msg.index("cookie:")] + "...[cookies omitidos]"
        print(f"    ERRO: {msg[:300]}")
        return None

async def fetch_all_disciplines(ctx: BrowserContext) -> list:
    disciplines = []
    p = 1
    while True:
        url  = f"{BROKK}/product/1/disciplines?per_page=100&page={p}"
        data = await api_get(ctx, url)
        if data is None: break
        items = data if isinstance(data, list) else (
            data.get("data") or data.get("disciplines") or data.get("items") or []
        )
        if not items: break
        disciplines.extend(items)
        print(f"  Pagina {p}: {len(items)} disciplinas (total: {len(disciplines)})")
        if len(items) < 100: break
        p += 1
    return disciplines

async def fetch_subjects(ctx: BrowserContext, disc_id: int) -> list:
    candidates = [
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=500&include=children",
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=500",
        f"{BROKK}/product/1/subjects?discipline_id={disc_id}&per_page=500",
    ]
    for url in candidates:
        data = await api_get(ctx, url)
        if data is None: continue
        raw = data if isinstance(data, list) else (data.get("data") or data.get("subjects") or [])
        if raw:
            flat = build_subjects_flat(raw)
            print(f"    [{disc_id}] {len(flat)} assuntos <- ...{url[len(BROKK):]}")
            return flat
    return []

def write_json(taxonomy):
    OUTPUT_JSON.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8")
    total_s = sum(len(d["subjects"]) for d in taxonomy)
    print(f"\n[OK] {OUTPUT_JSON} -- {len(taxonomy)} disciplinas, {total_s} assuntos totais")

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

async def validate(ctx: BrowserContext, taxonomy: list):
    import random
    samples = [(d["discipline_id"], s["id"]) for d in taxonomy for s in d["subjects"]]
    if not samples:
        print("[!] Sem pares para validar.")
        return
    print("\n--- Validacao de 3 URLs ---")
    for disc_id, subj_id in random.sample(samples, min(3, len(samples))):
        url = (f"https://www.qconcursos.com/questoes-de-concursos/questoes"
               f"?discipline_ids[]={disc_id}&subject_ids[]={subj_id}"
               f"&exclude_nullified=true&exclude_outdated=true")
        try:
            r = await ctx.request.get(url, timeout=15000)
            print(f"  [{disc_id},{subj_id}] HTTP {r.status}")
        except Exception as e:
            print(f"  [{disc_id},{subj_id}] ERRO: {e}")
        print(f"  URL: {url}")

async def main():
    print("="*60)
    print("  QConcursos Taxonomy Extractor v4.1")
    print("  (SSL ignorado + UTF-8 + APIRequestContext)")
    print("="*60)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox","--disable-blink-features=AutomationControlled"]
        )
        # ignore_https_errors resolve o problema de certificado SSL do Node.js
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

        print(f"\n[->] Carregando {BASE_URL} ...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)

        print("[->] Ativando filtros para capturar tokens de autenticacao...")
        for sel in ["button:has-text('Disciplina')","button:has-text('Filtrar')","[class*='filter']"]:
            try:
                el = await page.query_selector(sel)
                if el:
                    await el.click()
                    await page.wait_for_timeout(2500)
                    print(f"    Clicado: {sel}")
                    break
            except: pass

        print(f"\n[->] Buscando disciplinas via APIRequestContext...")
        raw_disciplines = await fetch_all_disciplines(ctx)

        if not raw_disciplines:
            print("[!] API retornou vazio. Salvando debug...")
            test = await api_get(ctx, f"{BROKK}/product/1/disciplines")
            Path("debug_disciplines.json").write_text(
                json.dumps(test, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
            )
            print("[!] Verifique debug_disciplines.json")
            await browser.close()
            return

        print(f"\n[->] Total disciplinas brutas: {len(raw_disciplines)}")
        taxonomy = []
        for disc in raw_disciplines:
            disc_id   = to_int(disc.get("id") or disc.get("discipline_id"))
            disc_nome = clean(disc.get("name") or disc.get("nome") or "")
            if not disc_id or not disc_nome: continue

            nome_lower = disc_nome.lower()
            nome_ascii = (nome_lower
                .replace("é","e").replace("â","a").replace("ô","o")
                .replace("ã","a").replace("í","i").replace("ú","u")
                .replace("ç","c").replace("ó","o").replace("ê","e"))
            if not any(p in nome_lower or p in nome_ascii for p in PRIORITY):
                print(f"  [skip] [{disc_id}] {disc_nome}")
                continue

            print(f"\n  [{disc_id}] {disc_nome} -- buscando assuntos...")
            subjects = await fetch_subjects(ctx, disc_id)
            taxonomy.append({"discipline_id": disc_id, "discipline_nome": disc_nome, "subjects": subjects})
            await asyncio.sleep(0.4)

        if not taxonomy:
            print("[!] Nenhuma disciplina prioritaria encontrada.")
            Path("debug_disciplines.json").write_text(
                json.dumps(raw_disciplines, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            await browser.close()
            return

        write_json(taxonomy)
        write_txt(taxonomy)
        await validate(ctx, taxonomy)
        await browser.close()
        print("\n[OK] Tudo concluido!")

asyncio.run(main())
