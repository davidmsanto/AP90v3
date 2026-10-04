"""
scraper_qconcursos.py
=====================
Extrai a taxonomia completa (Disciplinas - Assuntos - Subassuntos) do
Qconcursos via dois metodos em cascata:

  1. [PREFERENCIAL] Interceptacao XHR / __INITIAL_STATE__ no HTML
  2. [FALLBACK]     DOM scraping com Playwright (headful se necessario)

Saida:
  - taxonomia_qc_full.json
  - prompt_grounding_taxonomia.txt
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Optional

try:
    from playwright.async_api import async_playwright, Page
except ImportError:
    print("Playwright nao encontrado. Instale com: pip install playwright && python -m playwright install chromium")
    sys.exit(1)

BASE_URL = "https://www.qconcursos.com/questoes-de-concursos/questoes"
OUTPUT_JSON = Path("taxonomia_qc_full.json")
OUTPUT_TXT  = Path("prompt_grounding_taxonomia.txt")

PRIORITY_DISCIPLINES = [
    "lingua portuguesa", "direito constitucional", "direito administrativo",
    "direito penal", "direito processual penal", "legislacao",
    "raciocinio logico", "estatistica", "informatica", "seguranca da informacao"
]

KNOWN_API_PATTERNS = [
    "taxonom", "discipline", "subject", "filter", "questoes/filtros",
    "api/v", "graphql", "disciplines", "subjects"
]

def clean_name(raw: str) -> str:
    text = re.sub(r"\(\d[\d.,]*\)", "", raw)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def ensure_int(val) -> Optional[int]:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None

captured_api_responses = {}

async def setup_xhr_interceptor(page: Page):
    async def handle_response(response):
        url = response.url
        if any(p in url.lower() for p in KNOWN_API_PATTERNS):
            ct = response.headers.get("content-type", "")
            if "json" in ct:
                try:
                    body = await response.json()
                    captured_api_responses[url] = body
                    print(f"[XHR] Capturado: {url}")
                except Exception:
                    pass
    page.on("response", handle_response)

async def try_extract_initial_state(page: Page) -> Optional[list]:
    content = await page.content()
    patterns = [
        r"window\.__INITIAL_STATE__\s*=\s*({.+?});\s*(?:</script>|window\.)",
        r"window\.__NUXT__\s*=\s*({.+?});\s*</script>",
        r"window\.__APP_INITIAL_DATA__\s*=\s*({.+?});\s*</script>",
        r'"disciplines"\s*:\s*(\[.+?\])',
        r'"disciplinas"\s*:\s*(\[.+?\])',
    ]
    for pat in patterns:
        m = re.search(pat, content, re.DOTALL | re.IGNORECASE)
        if m:
            try:
                data = json.loads(m.group(1))
                print(f"[OK] Padrao encontrado: {pat[:60]}")
                disciplines = extract_disciplines_from_state(data)
                if disciplines:
                    return disciplines
            except json.JSONDecodeError:
                pass
    return None

def extract_disciplines_from_state(data, depth=0):
    if depth > 8:
        return None
    if isinstance(data, list) and len(data) > 0:
        sample = data[0]
        if isinstance(sample, dict) and any(k in sample for k in ("id", "discipline_id")):
            if any(k in sample for k in ("name", "nome", "title", "subjects")):
                return data
    if isinstance(data, dict):
        for key in ("disciplines", "disciplinas", "subjects", "filters", "data"):
            if key in data:
                result = extract_disciplines_from_state(data[key], depth + 1)
                if result:
                    return result
        for v in data.values():
            result = extract_disciplines_from_state(v, depth + 1)
            if result:
                return result
    return None

def parse_api_taxonomy(raw):
    def search(node, depth=0):
        if depth > 6:
            return None
        if isinstance(node, list) and node:
            item = node[0]
            if isinstance(item, dict) and ("subjects" in item or "discipline_id" in item or "nome" in item):
                return node
        if isinstance(node, dict):
            for k in ("data", "disciplines", "disciplinas", "result", "payload"):
                if k in node:
                    r = search(node[k], depth + 1)
                    if r:
                        return r
        return None
    return search(raw)

def normalize_subjects(raw: list, parent_id) -> list:
    out = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        sid = ensure_int(s.get("id") or s.get("subject_id") or s.get("assunto_id"))
        snome = clean_name(s.get("name") or s.get("nome") or s.get("title") or "")
        if not sid or not snome:
            continue
        out.append({"id": sid, "nome": snome, "parent_id": parent_id})
        children = s.get("children") or s.get("subjects") or s.get("assuntos") or []
        if children:
            out.extend(normalize_subjects(children, parent_id=sid))
    return out

def normalize_taxonomy(raw_disciplines: list) -> list:
    result = []
    for disc in raw_disciplines:
        disc_id = ensure_int(disc.get("discipline_id") or disc.get("id") or disc.get("disciplina_id"))
        disc_nome = clean_name(disc.get("discipline_nome") or disc.get("name") or disc.get("nome") or disc.get("title") or "")
        if not disc_id or not disc_nome:
            continue
        subjects_raw = disc.get("subjects") or disc.get("assuntos") or disc.get("topics") or []
        subjects = normalize_subjects(subjects_raw, parent_id=None)
        result.append({"discipline_id": disc_id, "discipline_nome": disc_nome, "subjects": subjects})
    return result

def write_json(taxonomy: list):
    OUTPUT_JSON.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {OUTPUT_JSON} escrito ({len(taxonomy)} disciplinas).")

def write_grounding_txt(taxonomy: list):
    lines = []
    for disc in taxonomy:
        lines.append(f"\n=== DISCIPLINA: [{disc['discipline_id']}] {disc['discipline_nome']} ===")
        roots = [s for s in disc["subjects"] if s["parent_id"] is None]
        children_map = {}
        for s in disc["subjects"]:
            if s["parent_id"] is not None:
                children_map.setdefault(s["parent_id"], []).append(s)
        for root in roots:
            lines.append(f"[{root['id']}] {root['nome']}")
            for child in children_map.get(root["id"], []):
                lines.append(f"  -> [{child['id']}] {child['nome']}")
                for gc in children_map.get(child["id"], []):
                    lines.append(f"    --> [{gc['id']}] {gc['nome']}")
    OUTPUT_TXT.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] {OUTPUT_TXT} escrito.")

async def validate_sample_urls(page: Page, taxonomy: list):
    import random
    samples = []
    for disc in taxonomy:
        for subj in disc["subjects"]:
            samples.append((disc["discipline_id"], subj["id"]))
    if not samples:
        print("[!] Sem amostras para validar.")
        return
    chosen = random.sample(samples, min(3, len(samples)))
    print("\n--- Validacao de URLs ---")
    for disc_id, subj_id in chosen:
        url = (f"https://www.qconcursos.com/questoes-de-concursos/questoes"
               f"?discipline_ids[]={disc_id}&subject_ids[]={subj_id}"
               f"&exclude_nullified=true&exclude_outdated=true")
        print(f"  Testando: {url}")
        try:
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            status = resp.status if resp else "N/A"
            print(f"    HTTP {status}")
        except Exception as e:
            print(f"    ERRO: {e}")

async def main():
    print("=" * 60)
    print("  QConcursos Taxonomy Extractor v2.0")
    print("=" * 60)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/127.0.0.0 Safari/537.36"),
            locale="pt-BR",
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
            "window.chrome = { runtime: {} };"
        )
        page = await context.new_page()
        await setup_xhr_interceptor(page)

        print(f"\n[->] Acessando {BASE_URL} ...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except Exception as e:
            print(f"[!] Timeout: {e}")
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)

        print("[->] Aguardando 5s para hidratacao do JS...")
        await page.wait_for_timeout(5000)

        taxonomy = None

        print("\n[1] Tentando __INITIAL_STATE__...")
        state_data = await try_extract_initial_state(page)
        if state_data:
            try:
                taxonomy = normalize_taxonomy(state_data)
                print(f"    Disciplinas via INITIAL_STATE: {len(taxonomy)}")
            except Exception as e:
                print(f"    Falha: {e}")
                taxonomy = None

        if not taxonomy:
            print("\n[2] Verificando XHR capturados...")
            for url, payload in captured_api_responses.items():
                parsed = parse_api_taxonomy(payload)
                if parsed:
                    try:
                        taxonomy = normalize_taxonomy(parsed)
                        print(f"    Taxonomia de XHR: {url}")
                        break
                    except Exception as e:
                        print(f"    Falha: {e}")

        if not taxonomy:
            print("\n[3] Tentando abrir filtros para disparar XHR...")
            filter_triggers = [
                "button[class*='filter']",
                "button:has-text('Filtrar')",
                "button:has-text('Disciplina')",
                "[class*='discipline']",
            ]
            for sel in filter_triggers:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        await el.click()
                        await page.wait_for_timeout(3000)
                        print(f"    Clicado: {sel}")
                        break
                except Exception:
                    pass
            for url, payload in captured_api_responses.items():
                parsed = parse_api_taxonomy(payload)
                if parsed:
                    taxonomy = normalize_taxonomy(parsed)
                    print(f"    Taxonomia apos clique: {url}")
                    break

        if not taxonomy:
            print("\n[FALHA] Nao foi possivel extrair a taxonomia automaticamente.")
            print("    XHR capturados:")
            for url in captured_api_responses:
                print(f"      {url}")

            # Salva dump dos XHR para analise manual
            dump_path = Path("xhr_dump.json")
            dump_path.write_text(
                json.dumps(captured_api_responses, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8"
            )
            print(f"    Dump salvo em: {dump_path}")
            await browser.close()
            return

        priority_filtered = [
            d for d in taxonomy
            if any(p in d["discipline_nome"].lower().replace('é','e').replace('â','a').replace('ô','o') 
                   for p in PRIORITY_DISCIPLINES)
        ]
        final_taxonomy = priority_filtered if priority_filtered else taxonomy

        print(f"\n[OK] Total de disciplinas: {len(final_taxonomy)}")
        for d in final_taxonomy:
            print(f"    [{d['discipline_id']}] {d['discipline_nome']} - {len(d['subjects'])} assuntos")

        write_json(final_taxonomy)
        write_grounding_txt(final_taxonomy)
        await validate_sample_urls(page, final_taxonomy)
        await browser.close()
        print("\n[OK] Extracao concluida com sucesso!")

if __name__ == "__main__":
    asyncio.run(main())
