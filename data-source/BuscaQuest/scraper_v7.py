"""
scraper_v7_xhr_capture.py
=========================
Estratégia: usar Playwright headful para CLICAR em cada disciplina
no painel de filtros e capturar via XHR interceptor o endpoint REAL
de subjects (que inclui discipline_id no payload ou na URL).
"""
import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from playwright.async_api import async_playwright, Page

BASE_URL    = "https://www.qconcursos.com/questoes-de-concursos/questoes"
BROKK       = "https://brokk.qconcursos.com"
OUTPUT_JSON = Path(r"C:\Users\David M\Documents\BuscaQuest\taxonomia_qc_full.json")
OUTPUT_TXT  = Path(r"C:\Users\David M\Documents\BuscaQuest\prompt_grounding_taxonomia.txt")

# IDs confirmados pelo log da v5
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

def clean(s: str) -> str:
    s = re.sub(r"\(\d[\d.,]*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None

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


async def get_subjects_via_url(page: Page, disc_id: int) -> list:
    """
    Navega até a página filtrada por discipline_id e captura
    o XHR de subjects disparado pelo carregamento da página.
    """
    collected: list = []
    captured_event = asyncio.Event()

    async def on_response(resp):
        url = resp.url
        # O endpoint de subjects REAL provavelmente tem o disc_id na URL ou nos params
        if "subject" in url.lower() and "brokk" in url:
            ct = resp.headers.get("content-type", "")
            if "json" in ct:
                try:
                    body = await resp.json()
                    raw = body if isinstance(body, list) else (
                        body.get("data") or body.get("subjects") or []
                    )
                    if raw and len(raw) > 0:
                        # Verifica se é específico desta disciplina (heurística: < 258 itens flat)
                        flat = build_subjects_flat(raw)
                        print(f"    XHR subjects: {url}")
                        print(f"    -> {len(flat)} assuntos")
                        collected.extend(flat)
                        captured_event.set()
                except Exception as e:
                    print(f"    parse err: {e}")

    page.on("response", on_response)

    # Navega para a URL filtrada por disciplina — isso deve disparar o XHR correto
    filter_url = (
        f"{BASE_URL}?discipline_ids[]={disc_id}"
        f"&exclude_nullified=true&exclude_outdated=true"
    )
    try:
        await page.goto(filter_url, wait_until="networkidle", timeout=30000)
    except:
        await page.goto(filter_url, wait_until="domcontentloaded", timeout=30000)

    # Aguarda o XHR de subjects até 8s
    try:
        await asyncio.wait_for(captured_event.wait(), timeout=8.0)
    except asyncio.TimeoutError:
        print(f"    Timeout: nenhum XHR de subjects capturado.")

    page.remove_listener("response", on_response)
    return collected


async def get_subjects_via_filter_click(page: Page, disc_id: int, disc_nome: str) -> list:
    """
    Clica no checkbox da disciplina no painel de filtros e captura o XHR de subjects.
    """
    collected: list = []
    captured_event = asyncio.Event()
    seen_urls: set = set()

    async def on_response(resp):
        url = resp.url
        if url in seen_urls:
            return
        if "brokk" in url and "json" in resp.headers.get("content-type", ""):
            seen_urls.add(url)
            try:
                body = await resp.json()
                # Procura por endpoint que retorne subjects específicos desta disciplina
                raw = None
                if isinstance(body, list) and body:
                    raw = body
                elif isinstance(body, dict):
                    raw = (body.get("data") or body.get("subjects") or
                           body.get("items") or [])
                if raw and len(raw) > 0:
                    flat = build_subjects_flat(raw)
                    if 1 < len(flat) < 250:  # Heurística: não é o catálogo global
                        print(f"    [click-xhr] {url}")
                        print(f"    -> {len(flat)} assuntos (provavel match)")
                        collected.extend(flat)
                        captured_event.set()
                    else:
                        print(f"    [skip-xhr] {url} -> {len(flat) if raw else 0} (muito generico)")
            except Exception:
                pass

    page.on("response", on_response)

    # Selectors possíveis para o checkbox/label da disciplina por ID
    selectors = [
        f"input[value='{disc_id}'][name*='discipline']",
        f"input[data-discipline-id='{disc_id}']",
        f"label[for*='discipline'][for*='{disc_id}']",
        f"[data-id='{disc_id}']",
        f"input[value='{disc_id}']",
    ]

    clicked = False
    for sel in selectors:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                clicked = True
                print(f"    Clicado: {sel}")
                break
        except Exception:
            pass

    if not clicked:
        # Tenta encontrar por texto
        try:
            label = await page.query_selector(f"text='{disc_nome}'")
            if label:
                await label.click()
                clicked = True
                print(f"    Clicado por texto: {disc_nome}")
        except Exception:
            pass

    if clicked:
        try:
            await asyncio.wait_for(captured_event.wait(), timeout=6.0)
        except asyncio.TimeoutError:
            pass

    page.remove_listener("response", on_response)
    return collected


async def dump_all_xhr(page: Page) -> dict:
    """Captura TODOS os XHRs do brokk durante o carregamento da página."""
    all_responses: dict = {}

    async def on_response(resp):
        if "brokk" in resp.url:
            ct = resp.headers.get("content-type", "")
            if "json" in ct:
                try:
                    body = await resp.json()
                    all_responses[resp.url] = body
                except Exception:
                    pass

    page.on("response", on_response)
    try:
        await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
    except:
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
    await page.wait_for_timeout(4000)

    # Clica em Disciplina para abrir o painel e capturar subjects
    for sel in ["button:has-text('Disciplina')", "button:has-text('Filtrar')", "[class*='discipline']"]:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                await page.wait_for_timeout(3000)
                print(f"  Painel aberto: {sel}")
                break
        except Exception:
            pass

    page.remove_listener("response", on_response)
    return all_responses


def write_json(taxonomy):
    OUTPUT_JSON.write_text(
        json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    total_s = sum(len(d["subjects"]) for d in taxonomy)
    print(f"\n[OK] {OUTPUT_JSON.name} -- {len(taxonomy)} disciplinas, {total_s} assuntos")


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


async def main():
    print("=" * 60)
    print("  QConcursos Taxonomy Extractor v7.0")
    print("  XHR capture via navegação por disciplina")
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

        # Fase 1: captura todos os XHRs da carga inicial
        print("\n[Fase 1] Capturando XHRs da carga inicial...")
        all_xhr = await dump_all_xhr(page)
        print(f"  XHRs brokk capturados: {len(all_xhr)}")
        for url, body in all_xhr.items():
            n = len(body) if isinstance(body, list) else type(body).__name__
            print(f"    {url} -> {n}")

        # Salva dump completo dos XHRs para análise
        dump_path = Path(r"C:\Users\David M\Documents\BuscaQuest\xhr_dump_v7.json")
        dump_path.write_text(
            json.dumps(all_xhr, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8"
        )
        print(f"  Dump salvo: {dump_path.name}")

        # Fase 2: por disciplina, navega e captura subjects via URL filtrada
        print("\n[Fase 2] Capturando subjects por disciplina via navegação...")
        taxonomy = []
        for disc_id, disc_nome in TARGET_DISCIPLINES:
            print(f"\n  [{disc_id}] {disc_nome}")
            subjects = await get_subjects_via_url(page, disc_id)

            if not subjects:
                print(f"    Tentando via click no filtro...")
                # Volta à página principal
                try:
                    await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(2000)
                    # Abre painel de filtros
                    for sel in ["button:has-text('Disciplina')", "[class*='discipline']"]:
                        try:
                            el = await page.query_selector(sel)
                            if el:
                                await el.click()
                                await page.wait_for_timeout(2000)
                                break
                        except Exception:
                            pass
                    subjects = await get_subjects_via_filter_click(page, disc_id, disc_nome)
                except Exception as e:
                    print(f"    Erro: {e}")

            print(f"    Total: {len(subjects)} assuntos")
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": subjects
            })
            await asyncio.sleep(0.5)

        write_json(taxonomy)
        write_txt(taxonomy)

        # Resumo
        print("\n--- Resumo ---")
        for d in taxonomy:
            status = "OK" if d["subjects"] else "VAZIO"
            print(f"  [{status}] [{d['discipline_id']:3}] {d['discipline_nome']:35} {len(d['subjects'])} assuntos")

        await browser.close()
        print("\n[OK] Concluído!")


asyncio.run(main())
