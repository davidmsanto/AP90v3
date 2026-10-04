"""
scraper_v8_dom_subjects.py
==========================
Estratégia definitiva baseada no diagnóstico completo:

A API brokk.qconcursos.com/product/1/disciplines retorna as DISCIPLINAS (matérias top-level).
Os ASSUNTOS (subjects) dentro de cada disciplina são carregados dinamicamente no DOM
quando o usuário seleciona uma disciplina no painel de filtros da página de questões.

Este script:
1. Abre a página de questões
2. Para cada disciplina-alvo, clica no checkbox correspondente no painel de filtros
3. Aguarda o carregamento dos subjects no DOM
4. Extrai os subjects via DOM scraping (inputs com value = subject_id)
5. Gera os dois artefatos de saída
"""

import asyncio, json, re, sys
from pathlib import Path
from typing import Optional

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from playwright.async_api import async_playwright, Page

BASE_URL    = "https://www.qconcursos.com/questoes-de-concursos/questoes"
OUTPUT_JSON = Path(r"C:\Users\David M\Documents\BuscaQuest\taxonomia_qc_full.json")
OUTPUT_TXT  = Path(r"C:\Users\David M\Documents\BuscaQuest\prompt_grounding_taxonomia.txt")

# Disciplinas confirmadas pelo log da v5 (id, nome)
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
    s = re.sub(r"\(\d[\d.,]*\s*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def to_int(v) -> Optional[int]:
    try: return int(v)
    except: return None


async def capture_subjects_for_discipline(page: Page, disc_id: int, disc_nome: str) -> list:
    """
    Navega até a URL com o discipline_id selecionado e extrai os subjects do DOM.
    O site carrega os assuntos via AJAX ao filtrar por disciplina.
    """
    subjects = []
    captured_xhr: list = []

    # Intercepta XHR disparado ao filtrar
    async def on_resp(resp):
        url = resp.url
        if "brokk" in url and "json" in resp.headers.get("content-type", ""):
            try:
                body = await resp.json()
                raw = body if isinstance(body, list) else (
                    body.get("data") or body.get("subjects") or []
                )
                if raw:
                    captured_xhr.append((url, raw))
                    print(f"    [xhr] {url} -> {len(raw)} itens")
            except Exception:
                pass

    page.on("response", on_resp)

    # Navega para página filtrada pela disciplina
    url = f"{BASE_URL}?discipline_ids[]={disc_id}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=35000)
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=35000)
        except Exception as e:
            print(f"    Erro navegação: {e}")
            page.remove_listener("response", on_resp)
            return []

    await page.wait_for_timeout(2500)

    # Tenta abrir o painel de assuntos/subjects
    for sel in [
        "button:has-text('Assunto')",
        "button:has-text('Tópico')",
        "button:has-text('Subject')",
        "[class*='subject'] button",
        "[class*='topic'] button",
        "[aria-label*='assunto']",
        "[aria-label*='subject']",
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                await page.wait_for_timeout(2000)
                print(f"    Clicado painel assuntos: {sel}")
                break
        except Exception:
            pass

    # Extrai subjects do DOM — múltiplos seletores
    selectors_subjects = [
        "input[name='subject_ids[]']",
        "input[name*='subject']",
        "[data-subject-id]",
        "[class*='subject'] input[type='checkbox']",
        "[class*='topic'] input[type='checkbox']",
        "input[value][name*='subject']",
    ]

    for sel in selectors_subjects:
        els = await page.query_selector_all(sel)
        if els:
            print(f"    DOM subjects via '{sel}': {len(els)} elementos")
            for el in els:
                # Tenta extrair o ID
                sid = to_int(
                    await el.get_attribute("value") or
                    await el.get_attribute("data-subject-id") or
                    await el.get_attribute("data-id")
                )
                if not sid:
                    continue

                # Tenta extrair o nome do label associado
                name_raw = ""
                # Tenta label[for=id_do_input]
                el_id = await el.get_attribute("id")
                if el_id:
                    label = await page.query_selector(f"label[for='{el_id}']")
                    if label:
                        name_raw = await label.inner_text()

                if not name_raw:
                    # Tenta parent ou próximo sibling
                    try:
                        parent = await el.evaluate_handle("el => el.parentElement")
                        name_raw = await parent.evaluate("el => el.innerText")
                    except Exception:
                        pass

                nome = clean(name_raw) if name_raw else f"Subject {sid}"
                subjects.append({"id": sid, "nome": nome, "parent_id": None})

            if subjects:
                break

    # Se DOM não retornou subjects, usa XHR capturado (mas só se for específico desta disciplina)
    if not subjects and captured_xhr:
        for xhr_url, raw in captured_xhr:
            if len(raw) < 258:  # Não é o catálogo global
                for item in raw:
                    sid  = to_int(item.get("id") or item.get("subject_id"))
                    nome = clean(item.get("nome") or item.get("name") or "")
                    pid  = to_int(item.get("parent_id") or item.get("parentId"))
                    if sid and nome:
                        subjects.append({"id": sid, "nome": nome, "parent_id": pid})
                if subjects:
                    print(f"    Subjects via XHR ({xhr_url}): {len(subjects)}")
                    break

    page.remove_listener("response", on_resp)
    return subjects


async def capture_via_html_initial_state(page: Page, disc_id: int) -> list:
    """Tenta extrair subjects do __INITIAL_STATE__ / props do Vue/React injetados no HTML."""
    content = await page.content()

    # Procura por dados de subjects no HTML
    patterns = [
        rf'"discipline_id"\s*:\s*{disc_id}[^}}]+?"subjects"\s*:\s*(\[.+?\])',
        rf'"subjects"\s*:\s*(\[.+?"discipline_id"\s*:\s*{disc_id}.+?\])',
        r'"subjects"\s*:\s*(\[(?:\{{[^}}]+\}}[,\s]*)+\])',
        r'subject_ids\[?\]?[^"]*":\s*(\[[\d,\s]+\])',
    ]
    for pat in patterns:
        m = re.search(pat, content, re.DOTALL)
        if m:
            try:
                raw = json.loads(m.group(1))
                subjects = []
                for item in raw:
                    if isinstance(item, dict):
                        sid  = to_int(item.get("id") or item.get("subject_id"))
                        nome = clean(item.get("nome") or item.get("name") or "")
                        pid  = to_int(item.get("parent_id"))
                        if sid and nome:
                            subjects.append({"id": sid, "nome": nome, "parent_id": pid})
                    elif isinstance(item, int):
                        subjects.append({"id": item, "nome": f"Subject {item}", "parent_id": None})
                if subjects:
                    print(f"    HTML state: {len(subjects)} subjects")
                    return subjects
            except Exception:
                pass
    return []


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


async def main():
    print("=" * 60)
    print("  QConcursos Taxonomy Extractor v8.0")
    print("  DOM Scraping de subjects por disciplina")
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

        # Carga inicial para estabelecer sessão/cookies
        print("\n[->] Estabelecendo sessão...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        except Exception:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)

        # Salva o HTML da página principal para análise
        html = await page.content()
        Path(r"C:\Users\David M\Documents\BuscaQuest\page_debug.html").write_text(
            html, encoding="utf-8"
        )
        print("  HTML da página salvo em page_debug.html")

        # Extrai todos os seletores de filtro disponíveis no DOM
        print("\n[->] Mapeando filtros disponíveis no DOM...")
        filter_info = await page.evaluate("""() => {
            const result = {};
            // Inputs de discipline
            const discInputs = document.querySelectorAll('input[name*="discipline"], [data-discipline-id]');
            result.discipline_inputs = Array.from(discInputs).slice(0, 10).map(el => ({
                tag: el.tagName,
                type: el.type,
                name: el.name,
                value: el.value,
                id: el.id,
                dataId: el.dataset.disciplineId || el.dataset.id,
                text: el.textContent?.trim().slice(0, 50)
            }));
            // Inputs de subject
            const subjInputs = document.querySelectorAll('input[name*="subject"], [data-subject-id]');
            result.subject_inputs = Array.from(subjInputs).slice(0, 10).map(el => ({
                tag: el.tagName,
                type: el.type,
                name: el.name,
                value: el.value,
                id: el.id,
                dataId: el.dataset.subjectId || el.dataset.id,
                text: el.textContent?.trim().slice(0, 50)
            }));
            // Botões e labels relacionados a filtros
            const buttons = document.querySelectorAll('button, [role="button"]');
            result.filter_buttons = Array.from(buttons)
                .filter(b => /disciplina|assunto|filtro|subject|discipline/i.test(b.textContent))
                .slice(0, 10)
                .map(b => ({
                    text: b.textContent?.trim().slice(0, 60),
                    class: b.className.slice(0, 60),
                    'aria-label': b.getAttribute('aria-label')
                }));
            return result;
        }""")
        print(json.dumps(filter_info, ensure_ascii=False, indent=2))

        # Salva o mapeamento de filtros
        Path(r"C:\Users\David M\Documents\BuscaQuest\filter_map.json").write_text(
            json.dumps(filter_info, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        taxonomy = []
        for disc_id, disc_nome in TARGET_DISCIPLINES:
            print(f"\n[{disc_id:3}] {disc_nome}")

            # Tenta extrair subjects via navegação e DOM
            subjects = await capture_subjects_for_discipline(page, disc_id, disc_nome)

            # Fallback: tenta HTML state
            if not subjects:
                subjects = await capture_via_html_initial_state(page, disc_id)

            print(f"  => {len(subjects)} assuntos extraídos")
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": subjects
            })
            await asyncio.sleep(0.5)

        write_json(taxonomy)
        write_txt(taxonomy)

        print("\n--- Resumo ---")
        for d in taxonomy:
            status = "OK " if d["subjects"] else "VAZIO"
            print(f"  [{status}] [{d['discipline_id']:3}] {d['discipline_nome']:35} {len(d['subjects'])} assuntos")

        await browser.close()
        print("\n[OK] Concluído!")


asyncio.run(main())
