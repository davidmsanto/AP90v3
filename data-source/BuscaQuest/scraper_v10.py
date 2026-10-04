"""
scraper_v10_ui_flow.py
======================
Fluxo UI exato do site:
1. Abre dropdown "Disciplina" → aguarda lista carregar
2. Clica em cada disciplina pelo texto visível
3. Abre dropdown "Assunto" → captura o XHR disparado
4. Extrai subjects do XHR (agora filtrado pela disciplina selecionada)
5. Desmarca a disciplina → próxima iteração
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
DEBUG_DIR   = Path(r"C:\Users\David M\Documents\BuscaQuest\debug_subjects")
DEBUG_DIR.mkdir(exist_ok=True)

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

def build_flat(raw: list, parent_id=None) -> list:
    out = []
    for s in (raw or []):
        if not isinstance(s, dict): continue
        sid  = to_int(s.get("id") or s.get("subject_id"))
        nome = clean(s.get("name") or s.get("nome") or "")
        if not sid or not nome: continue
        pid = to_int(s.get("parent_id") or s.get("parentId")) or parent_id
        out.append({"id": sid, "nome": nome, "parent_id": pid})
        kids = s.get("children") or s.get("subjects") or []
        out.extend(build_flat(kids, sid))
    return out


async def get_subjects_via_ui(page: Page, disc_id: int, disc_nome: str) -> list:
    """
    Executa o fluxo completo de UI para capturar os subjects de uma disciplina:
    1. Clica no dropdown Disciplina
    2. Seleciona a disciplina pelo ID no hidden input
    3. Clica no dropdown Assunto
    4. Captura o XHR de subjects disparado
    """
    subjects_captured = []
    event = asyncio.Event()

    async def on_resp(resp):
        url = resp.url
        if "brokk" in url and "subject" in url.lower():
            ct = resp.headers.get("content-type", "")
            if "json" in ct:
                try:
                    body = await resp.json()
                    raw = body if isinstance(body, list) else (
                        body.get("data") or body.get("subjects") or body.get("items") or []
                    )
                    if raw:
                        print(f"    [xhr-subject] {url}")
                        print(f"    -> {len(raw)} itens brutos")
                        # Salva o raw para debug
                        dbg = DEBUG_DIR / f"disc_{disc_id}_subjects_raw.json"
                        dbg.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
                        flat = build_flat(raw)
                        subjects_captured.extend(flat)
                        event.set()
                except Exception as e:
                    print(f"    [xhr-err] {e}")

    page.on("response", on_resp)

    try:
        # PASSO 1: Clica no dropdown Disciplina
        disc_btn = await page.wait_for_selector(
            "button.dropdown-toggle:has-text('Disciplina')",
            timeout=10000
        )
        await disc_btn.click()
        await page.wait_for_timeout(2000)
        print(f"    [1] Dropdown Disciplina aberto")

        # PASSO 2: Aguarda os itens da disciplina carregarem
        await page.wait_for_selector(".q-options li", timeout=8000)

        # Pega todos os li do dropdown de disciplina
        items = await page.query_selector_all(".q-options li:not(.q-separator)")
        print(f"    [2] {len(items)} disciplinas no dropdown")

        # Procura a disciplina pelo ID (hidden input) ou texto
        found = False
        for item in items:
            # Tenta via input hidden dentro do li
            inp = await item.query_selector("input[type='hidden'], input[type='checkbox']")
            item_val = None
            if inp:
                item_val = await inp.get_attribute("value")
            if to_int(item_val) == disc_id:
                await item.click()
                found = True
                print(f"    [2] Disciplina selecionada via input value={disc_id}")
                break

        if not found:
            # Tenta via texto visível
            for item in items:
                text = clean(await item.inner_text())
                if disc_nome.lower() in text.lower() or text.lower() in disc_nome.lower():
                    await item.click()
                    found = True
                    print(f"    [2] Disciplina selecionada via texto: {text[:50]}")
                    break

        if not found:
            print(f"    [2] Disciplina NÃO encontrada no dropdown!")
            # Tenta busca rápida
            search = await page.query_selector("#quick-search")
            if search:
                await search.fill(disc_nome[:10])
                await page.wait_for_timeout(1500)
                items2 = await page.query_selector_all(".q-options li:not(.q-separator)")
                if items2:
                    await items2[0].click()
                    found = True
                    print(f"    [2] Selecionado após busca rápida")

        # Fecha dropdown Disciplina
        try:
            ok_btn = await page.query_selector(".js-close-select-dropdown-btn")
            if ok_btn:
                await ok_btn.click()
                await page.wait_for_timeout(500)
        except Exception:
            pass

        if not found:
            page.remove_listener("response", on_resp)
            return []

        await page.wait_for_timeout(1000)

        # PASSO 3: Clica no dropdown Assunto (agora habilitado)
        subj_btn = await page.query_selector(
            "#subject_ids button.dropdown-toggle"
        )
        if not subj_btn:
            subj_btn = await page.query_selector(
                "button.dropdown-toggle:has-text('Assunto')"
            )

        if subj_btn:
            # Verifica se está habilitado
            disabled = await subj_btn.get_attribute("disabled")
            if disabled:
                print(f"    [3] Dropdown Assunto ainda desabilitado!")
                # Tenta navegar via URL com discipline selecionada
            else:
                await subj_btn.click()
                print(f"    [3] Dropdown Assunto aberto — aguardando XHR...")
                # Aguarda o XHR de subjects
                try:
                    await asyncio.wait_for(event.wait(), timeout=10.0)
                    print(f"    [3] XHR capturado!")
                except asyncio.TimeoutError:
                    print(f"    [3] Timeout — sem XHR de subjects")

                # Fecha dropdown Assunto
                try:
                    ok2 = await page.query_selector("#subject_ids .js-close-select-dropdown-btn")
                    if ok2:
                        await ok2.click()
                except Exception:
                    pass
        else:
            print(f"    [3] Dropdown Assunto não encontrado!")

        # Desmarca a disciplina para próxima iteração
        try:
            # Abre dropdown disciplina novamente
            disc_btn2 = await page.query_selector("button.dropdown-toggle:has-text('Disciplina')")
            if not disc_btn2:
                # Procura pelo placeholder modificado
                disc_btn2 = await page.query_selector("#discipline_ids button.dropdown-toggle")
            if disc_btn2:
                await disc_btn2.click()
                await page.wait_for_timeout(1000)
                # Desmarca o item selecionado
                checked = await page.query_selector(".q-options li.selected, .q-options li.active")
                if checked:
                    await checked.click()
                ok3 = await page.query_selector(".js-close-select-dropdown-btn")
                if ok3:
                    await ok3.click()
                await page.wait_for_timeout(500)
        except Exception as e:
            print(f"    [reset] Erro ao desmarcar: {e}")
            # Recarrega a página para resetar
            try:
                await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(2000)
            except Exception:
                pass

    except Exception as e:
        print(f"    ERRO: {e}")
    finally:
        page.remove_listener("response", on_resp)

    return subjects_captured


async def get_subjects_via_url_intercept(page: Page, disc_id: int) -> list:
    """
    Alternativa: navega para URL filtrada e intercepta o XHR de subjects
    disparado pela seleção automática da disciplina via query param.
    """
    subjects_captured = []
    event = asyncio.Event()

    async def on_resp(resp):
        url = resp.url
        if "brokk" in url and "subject" in url.lower():
            ct = resp.headers.get("content-type", "")
            if "json" in ct:
                try:
                    body = await resp.json()
                    raw = body if isinstance(body, list) else (
                        body.get("data") or body.get("subjects") or []
                    )
                    if raw and len(raw) < 258:
                        flat = build_flat(raw)
                        subjects_captured.extend(flat)
                        print(f"    [url-xhr] {url} -> {len(flat)} subjects")
                        event.set()
                    elif raw:
                        print(f"    [url-xhr-skip] {url} -> {len(raw)} itens (catálogo global)")
                        dbg = DEBUG_DIR / f"disc_{disc_id}_global.json"
                        dbg.write_text(json.dumps(raw[:5], ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception:
                    pass

    page.on("response", on_resp)

    filter_url = f"{BASE_URL}?discipline_ids[]={disc_id}"
    try:
        await page.goto(filter_url, wait_until="networkidle", timeout=30000)
    except Exception:
        await page.goto(filter_url, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(3000)

    # Agora tenta abrir o dropdown de Assunto
    try:
        subj_btn = await page.query_selector("#subject_ids button.dropdown-toggle:not([disabled])")
        if subj_btn:
            await subj_btn.click()
            print(f"    [url] Assunto dropdown aberto")
            try:
                await asyncio.wait_for(event.wait(), timeout=8.0)
            except asyncio.TimeoutError:
                print(f"    [url] Timeout sem XHR de subjects")
        else:
            # Verifica se há subjects no DOM via input hidden
            hidden_inputs = await page.query_selector_all(
                "#subject_ids input[type='hidden'], input[name='subject_ids[]']"
            )
            print(f"    [url] {len(hidden_inputs)} hidden inputs de subjects no DOM")
            for inp in hidden_inputs:
                sid  = to_int(await inp.get_attribute("value"))
                if sid:
                    subjects_captured.append({"id": sid, "nome": f"Subject_{sid}", "parent_id": None})
    except Exception as e:
        print(f"    [url] Erro: {e}")

    page.remove_listener("response", on_resp)
    return subjects_captured


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
    print("  QConcursos Taxonomy Extractor v10.0")
    print("  UI Flow: Disciplina → Assunto → XHR capture")
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

        print("\n[->] Carregando página base...")
        try:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"    Erro ao carregar: {e}")
        await page.wait_for_timeout(3000)

        taxonomy = []
        for disc_id, disc_nome in TARGET_DISCIPLINES:
            print(f"\n  [{disc_id:3}] {disc_nome}")

            # Método 1: UI flow (Disciplina → Assunto)
            subjects = await get_subjects_via_ui(page, disc_id, disc_nome)

            # Método 2: URL + abrir dropdown
            if not subjects:
                print(f"    Tentando via URL filtrada...")
                subjects = await get_subjects_via_url_intercept(page, disc_id)

            print(f"  => {len(subjects)} assuntos")
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": subjects
            })

        write_json(taxonomy)
        write_txt(taxonomy)

        print("\n--- Resumo ---")
        for d in taxonomy:
            flag = "OK " if d["subjects"] else "---"
            print(f"  [{flag}] [{d['discipline_id']:3}] {d['discipline_nome']:35} {len(d['subjects'])} assuntos")

        await browser.close()
        print("\n[OK] Concluído!")

asyncio.run(main())
