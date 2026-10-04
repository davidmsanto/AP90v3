import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

try:
    from playwright.async_api import async_playwright, Page
except ImportError:
    print("playwright nao encontrado")
    sys.exit(1)

BASE_URL = "https://www.qconcursos.com/questoes-de-concursos/questoes"
BROKK    = "https://brokk.qconcursos.com"
OUTPUT_JSON = Path("taxonomia_qc_full.json")
OUTPUT_TXT  = Path("prompt_grounding_taxonomia.txt")

PRIORITY = [
    "lingua portuguesa","portugues","direito constitucional","direito administrativo",
    "direito penal","processual penal","legislacao","raciocinio logico",
    "estatistica","informatica","seguranca da informacao","legislação",
    "português","raciocínio"
]

def clean(s: str) -> str:
    s = re.sub(r"\(\d[\d.,]*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None

captured = {}

async def setup_interceptor(page: Page):
    async def on_resp(resp):
        url = resp.url
        if "brokk.qconcursos.com" in url and "json" in resp.headers.get("content-type",""):
            try:
                captured[url] = await resp.json()
            except: pass
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

async def fetch_all_disciplines(page: Page) -> list:
    """Pagina o endpoint de disciplinas usando fetch() dentro do browser (herda cookies/headers)."""
    disciplines = []
    p = 1
    while True:
        url = f"{BROKK}/product/1/disciplines?per_page=100&page={p}"
        resp = await page.evaluate(f"""async () => {{
            const r = await fetch('{url}', {{
                headers: {{
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }}
            }});
            return r.ok ? await r.json() : null;
        }}""")
        if not resp:
            print(f"  Pagina {p}: resposta nula/erro, parando.")
            break
        items = resp if isinstance(resp, list) else resp.get("data", resp.get("disciplines", []))
        if not items:
            break
        disciplines.extend(items)
        print(f"  Pagina {p}: {len(items)} disciplinas (total: {len(disciplines)})")
        if len(items) < 100:
            break
        p += 1
    return disciplines

async def fetch_subjects_for_discipline(page: Page, disc_id: int) -> list:
    """Busca todos os assuntos de uma disciplina, incluindo hierarquia."""
    urls_to_try = [
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?per_page=500",
        f"{BROKK}/product/1/subjects?discipline_id={disc_id}&per_page=500",
        f"{BROKK}/product/1/disciplines/{disc_id}/subjects?include=children&per_page=500",
    ]
    for url in urls_to_try:
        resp = await page.evaluate(f"""async () => {{
            const r = await fetch('{url}', {{
                headers: {{'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}}
            }});
            if (!r.ok) return null;
            return await r.json();
        }}""")
        if resp:
            raw = resp if isinstance(resp, list) else resp.get("data", resp.get("subjects", []))
            if raw:
                subjs = build_subjects_flat(raw)
                print(f"    [{disc_id}] {len(subjs)} assuntos via {url.split('brokk')[1]}")
                return subjs
    print(f"    [{disc_id}] Nenhum assunto encontrado.")
    return []

def write_json(taxonomy):
    OUTPUT_JSON.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[OK] {OUTPUT_JSON} — {len(taxonomy)} disciplinas")

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

async def validate(page: Page, taxonomy: list):
    import random
    samples = [(d["discipline_id"], s["id"]) for d in taxonomy for s in d["subjects"]]
    if not samples:
        print("[!] Sem pares para validar.")
        return
    for disc_id, subj_id in random.sample(samples, min(3, len(samples))):
        url = (f"https://www.qconcursos.com/questoes-de-concursos/questoes"
               f"?discipline_ids[]={disc_id}&subject_ids[]={subj_id}"
               f"&exclude_nullified=true&exclude_outdated=true")
        print(f"\n  Validando: {url}")
        try:
            r = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            print(f"    HTTP {r.status if r else 'N/A'}")
        except Exception as e:
            print(f"    ERRO: {e}")

async def main():
    print("="*60)
    print("  QConcursos Taxonomy Extractor v3.0 — API via Browser Context")
    print("="*60)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox","--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            viewport={"width":1280,"height":900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            locale="pt-BR"
        )
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};"
        )
        page = await ctx.new_page()
        await setup_interceptor(page)

        print(f"\n[->] Carregando pagina principal...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(4000)

        # Garante que o filtro de disciplina foi clicado (para obter cookies necessarios)
        print("[->] Clicando em Disciplina para ativar sessao da API...")
        for sel in ["button:has-text('Disciplina')","[class*='discipline']","button:has-text('Filtrar')"]:
            try:
                el = await page.query_selector(sel)
                if el:
                    await el.click()
                    await page.wait_for_timeout(2000)
                    break
            except: pass

        print("\n[->] Buscando todas as disciplinas...")
        raw_disciplines = await fetch_all_disciplines(page)
        print(f"     Total bruto: {len(raw_disciplines)}")

        if not raw_disciplines:
            # Fallback: usa o que foi capturado pelo interceptor
            for url, payload in captured.items():
                if "discipline" in url:
                    raw_disciplines = payload if isinstance(payload, list) else payload.get("data",[])
                    print(f"     Usando captura XHR: {url} ({len(raw_disciplines)} items)")
                    break

        taxonomy = []
        for disc in raw_disciplines:
            disc_id   = to_int(disc.get("id") or disc.get("discipline_id"))
            disc_nome = clean(disc.get("name") or disc.get("nome") or "")
            if not disc_id or not disc_nome: continue

            # Filtro de prioridade
            nome_lower = disc_nome.lower()
            if not any(p in nome_lower for p in PRIORITY):
                continue

            print(f"\n  [{disc_id}] {disc_nome}")
            subjects = await fetch_subjects_for_discipline(page, disc_id)
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": subjects
            })
            await page.wait_for_timeout(500)  # rate-limit gentil

        if not taxonomy:
            print("\n[!] Nenhuma disciplina prioritaria encontrada.")
            print("    Disciplinas brutas disponiveis:")
            for d in raw_disciplines:
                print(f"      {d}")
            await browser.close()
            return

        write_json(taxonomy)
        write_txt(taxonomy)
        await validate(page, taxonomy)
        await browser.close()
        print("\n[OK] Concluido!")

asyncio.run(main())
