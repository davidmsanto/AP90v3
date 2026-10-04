import asyncio, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

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

def clean(s):
    s = re.sub(r"\(\d[\d.,]*\s*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def build_flat(raw: list, parent_id=None) -> list:
    out = []
    for s in (raw or []):
        if not isinstance(s, dict): continue
        sid  = s.get("id") or s.get("subject_id")
        nome = clean(s.get("name") or s.get("nome") or "")
        pid  = s.get("parent_id") or s.get("parentId") or parent_id
        if sid and nome:
            out.append({"id": int(sid), "nome": nome, "parent_id": pid})
        kids = s.get("children") or s.get("subjects") or []
        out.extend(build_flat(kids, sid))
    return out

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        print("\n>>> ABRINDO PÁGINA DE LOGIN...")
        await page.goto("https://www.qconcursos.com/conta/entrar")
        
        print("\n" + "="*60)
        print(" 🔓 FAÇA O SEU LOGIN COM E-MAIL E SENHA NO NAVEGADOR!")
        print(" Quando você estiver logado e vir a tela inicial do site,")
        print(" volte AQUI NO TERMINAL e APERTE ENTER para o robô começar.")
        print("="*60 + "\n")
        
        # Pausa a automação até o usuário apertar Enter no terminal
        await asyncio.to_thread(input, ">> Pressione ENTER aqui quando estiver pronto: ")
        
        print("\n>>> INICIANDO EXTRAÇÃO DE ASSUNTOS...")
        taxonomy = []
        
        for disc_id, disc_nome in TARGET_DISCIPLINES:
            print(f"\n⏳ Extraindo: {disc_nome}...")
            
            # Recarrega a página de questões limpa
            await page.goto("https://www.qconcursos.com/questoes-de-concursos/questoes", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            
            captured_subjects = []
            event = asyncio.Event()
            
            # Interceptador da rede
            async def on_resp(resp):
                if "brokk" in resp.url and "subject" in resp.url.lower():
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            data = await resp.json()
                            raw = data if isinstance(data, list) else (data.get("data") or data.get("subjects") or data.get("items") or [])
                            
                            # Filtra catálogo global (258 itens é o catálogo global)
                            if raw and len(raw) > 0 and len(raw) != 258:
                                flat_subjects = build_flat(raw)
                                captured_subjects.extend(flat_subjects)
                                event.set()
                    except Exception:
                        pass

            page.on("response", on_resp)
            
            try:
                # 1. Clicar no dropdown Disciplina
                disc_btn = await page.query_selector("button.dropdown-toggle:has-text('Disciplina')")
                if disc_btn:
                    await disc_btn.click()
                    await page.wait_for_timeout(1000)
                    
                    # 2. Pesquisar disciplina
                    search_input = await page.query_selector("input#quick-search")
                    if search_input:
                        await search_input.fill(disc_nome)
                        await page.wait_for_timeout(1500)
                    
                    # 3. Clicar na disciplina
                    options = await page.query_selector_all(".q-options li:not(.q-separator)")
                    for opt in options:
                        text = await opt.inner_text()
                        if disc_nome.lower() in text.lower():
                            await opt.click()
                            break
                    
                    # 4. Fechar dropdown
                    close_btn = await page.query_selector(".js-close-select-dropdown-btn")
                    if close_btn:
                        await close_btn.click()
                    await page.wait_for_timeout(1500)
                    
                    # 5. Clicar no dropdown Assunto
                    subj_btn = await page.query_selector("button.dropdown-toggle:has-text('Assunto')")
                    if not subj_btn:
                        subj_btn = await page.query_selector("#subject_ids button.dropdown-toggle")
                        
                    if subj_btn:
                        await subj_btn.click()
                        
                        # Aguarda XHR
                        try:
                            await asyncio.wait_for(event.wait(), timeout=10.0)
                            
                            # Filtra duplicados (caso o XHR retorne múltiplos eventos)
                            unique_subjects = {s["id"]: s for s in captured_subjects}.values()
                            captured_subjects = list(unique_subjects)
                            
                            print(f"  ✅ Sucesso: {len(captured_subjects)} assuntos capturados.")
                        except asyncio.TimeoutError:
                            print(f"  ❌ Timeout: a rede não retornou assuntos específicos.")
                else:
                    print("  ❌ Erro: Não achou o botão Disciplina.")
            except Exception as e:
                print(f"  ❌ Erro de UI: {e}")
            finally:
                page.remove_listener("response", on_resp)
            
            taxonomy.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": captured_subjects
            })
            
        print("\n=== SALVANDO ARQUIVOS ===")
        # Salva o JSON completo
        json_path = Path("taxonomia_qc_full.json")
        json_path.write_text(json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8")
        
        # Salva o TXT formatado para o prompt
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
        
        txt_path = Path("prompt_grounding_taxonomia.txt")
        txt_path.write_text("\n".join(lines), encoding="utf-8")
        
        print("✅ taxonomia_qc_full.json salvo!")
        print("✅ prompt_grounding_taxonomia.txt salvo!")
        
        await browser.close()
        print("\nTUDO PRONTO! Pode avisar no chat que terminou.")

asyncio.run(main())
