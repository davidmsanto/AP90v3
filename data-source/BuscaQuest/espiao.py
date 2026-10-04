import asyncio, json, sys
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")

async def main():
    print("Iniciando o Espião de Rede...")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--no-sandbox"])
        ctx = await browser.new_context(ignore_https_errors=True)
        page = await ctx.new_page()
        
        captured_urls = []
        
        async def on_resp(resp):
            url = resp.url
            if "brokk" in url and "json" in resp.headers.get("content-type", ""):
                try:
                    req = resp.request
                    print(f"\n[CAPTURADO] {req.method} {url}")
                    if req.post_data:
                        print(f"Payload POST: {req.post_data}")
                    
                    body = await resp.json()
                    n = len(body) if isinstance(body, list) else (len(body.get('data', [])) if isinstance(body, dict) else 1)
                    print(f"Retornou: {n} itens")
                    
                    # Salva a URL se for de subjects
                    if "subject" in url.lower():
                        with open("segredo_api.txt", "a", encoding="utf-8") as f:
                            f.write(f"URL: {url}\nPayload: {req.post_data}\n\n")
                except Exception as e:
                    pass
        
        page.on("response", on_resp)
        
        print("\n" + "="*50)
        print("NAVEGADOR ABERTO!")
        print("1. Resolva o Cloudflare (se aparecer)")
        print("2. Clique no filtro 'Disciplina' e selecione 'Português'")
        print("3. Aguarde uns segundos, e então clique no filtro 'Assunto'")
        print("4. O script vai capturar a URL exata aqui no terminal!")
        print("="*50 + "\n")
        
        await page.goto("https://www.qconcursos.com/questoes-de-concursos/questoes", timeout=0)
        
        # Fica aberto por 3 minutos para você ter tempo de clicar
        await page.wait_for_timeout(180000)
        await browser.close()

asyncio.run(main())
