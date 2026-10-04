import asyncio, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")

def clean(s):
    s = re.sub(r"\(\d[\d.,]*\s*\)", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def build_flat(raw, pid=None):
    out = []
    for s in raw:
        if not isinstance(s, dict): continue
        sid = s.get("id") or s.get("subject_id")
        nome = clean(s.get("name") or s.get("nome") or "")
        parent = s.get("parent_id") or s.get("parentId") or pid
        if sid and nome:
            out.append({"id": int(sid), "nome": nome, "parent_id": parent})
        kids = s.get("children") or s.get("subjects") or []
        out.extend(build_flat(kids, sid))
    return out

async def main():
    print("\n" + "="*60)
    print(" 🕵️ COLETOR INFALÍVEL DE ASSUNTOS (MODO ESCUTA)")
    print("="*60)
    print("1. O Chrome vai abrir na página de questões.")
    print("2. Faça o login se precisar.")
    print("3. PARA CADA MATÉRIA que você quer extrair, faça isso manualmente:")
    print("   -> Selecione a Disciplina no filtro.")
    print("   -> Clique no filtro 'Assunto' e espere a lista aparecer na tela.")
    print("   -> O script vai interceptar a rede, salvar os dados na mesma hora e avisar aqui no terminal!")
    print("   -> Limpe os filtros e repita para a próxima.")
    print("4. Quando terminar todas, apenas feche o navegador.")
    print("="*60 + "\n")
    
    taxonomy = {}
    
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        
        async def on_resp(resp):
            url = resp.url
            if "brokk" in url and "subject" in url.lower():
                try:
                    if "json" in resp.headers.get("content-type", ""):
                        data = await resp.json()
                        raw = data if isinstance(data, list) else (data.get("data") or data.get("subjects") or data.get("items") or [])
                        
                        if raw and len(raw) > 0 and len(raw) != 258:
                            # Tenta extrair ID da disciplina da URL
                            disc_id = None
                            m = re.search(r"discipline_ids?\[?\]?(?:%5B%5D)?=(\d+)", url)
                            if m:
                                disc_id = int(m.group(1))
                            else:
                                disc_id = f"Desconhecido_{len(taxonomy)}"
                            
                            flat = build_flat(raw)
                            
                            if disc_id not in taxonomy or len(flat) > len(taxonomy[disc_id].get("subjects", [])):
                                taxonomy[disc_id] = {
                                    "discipline_id": disc_id,
                                    "discipline_nome": f"Disciplina {disc_id}",
                                    "subjects": flat
                                }
                                
                                # Gera os arquivos em tempo real
                                with open("taxonomia_qc_full.json", "w", encoding="utf-8") as f:
                                    json.dump(list(taxonomy.values()), f, ensure_ascii=False, indent=2)
                                
                                # Gera o TXT para o seu prompt do assistente
                                lines = []
                                for d in taxonomy.values():
                                    lines.append(f"\n=== DISCIPLINA: [{d['discipline_id']}] {d['discipline_nome']} ===")
                                    roots = [s for s in d["subjects"] if s["parent_id"] is None]
                                    cmap  = {}
                                    for s in d["subjects"]:
                                        if s["parent_id"]: cmap.setdefault(s["parent_id"], []).append(s)
                                    for r in roots:
                                        lines.append(f"[{r['id']}] {r['nome']}")
                                        for c in cmap.get(r["id"], []):
                                            lines.append(f"  -> [{c['id']}] {c['nome']}")
                                            for g in cmap.get(c["id"], []):
                                                lines.append(f"    --> [{g['id']}] {g['nome']}")
                                
                                with open("prompt_grounding_taxonomia.txt", "w", encoding="utf-8") as f:
                                    f.write("\n".join(lines))
                                
                                print(f"✅ SUCESSO: Capturados {len(flat)} assuntos para a Disciplina ID {disc_id}! Arquivo atualizado.")
                except Exception:
                    pass
                    
        page.on("response", on_resp)
        await page.goto("https://www.qconcursos.com/questoes-de-concursos/questoes")
        
        while not page.is_closed():
            await asyncio.sleep(1)

asyncio.run(main())
