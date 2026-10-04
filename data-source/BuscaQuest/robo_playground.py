import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        print("\n>>> ABRINDO PÁGINA DE LOGIN...")
        await page.goto("https://www.qconcursos.com/conta/entrar")
        
        print("\n" + "="*60)
        print(" 🔓 FAÇA SEU LOGIN NO NAVEGADOR!")
        print(" Quando logar e a tela principal carregar,")
        print(" volte AQUI NO TERMINAL e APERTE ENTER.")
        print("="*60 + "\n")
        
        await asyncio.to_thread(input, ">> Pressione ENTER aqui quando estiver logado: ")
        
        print("\n>>> NAVEGANDO PARA O PLAYGROUND DE FILTROS...")
        captured_xhr = {}
        
        async def on_resp(resp):
            url = resp.url
            if "json" in resp.headers.get("content-type", ""):
                try:
                    data = await resp.json()
                    captured_xhr[url] = data
                    print(f"  [XHR Capturado] {url}")
                except Exception:
                    pass
        
        page.on("response", on_resp)
        
        try:
            await page.goto("https://app.qconcursos.com/playground/filtro", wait_until="networkidle", timeout=45000)
        except Exception:
            await page.goto("https://app.qconcursos.com/playground/filtro", wait_until="domcontentloaded", timeout=45000)
            
        print("  Aguardando carregamento da página...")
        await page.wait_for_timeout(5000)
        
        html = await page.content()
        
        print("\n=== SALVANDO DADOS DO PLAYGROUND ===")
        Path("playground_dump_html.html").write_text(html, encoding="utf-8")
        Path("playground_dump_xhr.json").write_text(json.dumps(captured_xhr, ensure_ascii=False, indent=2), encoding="utf-8")
        
        print("✅ HTML salvo como playground_dump_html.html")
        print("✅ Dados de rede salvos como playground_dump_xhr.json")
        
        await browser.close()
        print("\nTUDO PRONTO! Pode me avisar no chat.")

asyncio.run(main())
