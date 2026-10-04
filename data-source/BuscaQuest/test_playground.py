import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        )
        
        print('Acessando https://app.qconcursos.com/playground/filtro ...')
        
        responses = []
        page.on("response", lambda r: responses.append(r.url) if "json" in r.headers.get("content-type", "") else None)
        
        await page.goto("https://app.qconcursos.com/playground/filtro", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        html = await page.content()
        print(f"HTML size: {len(html)}")
        if 'Cloudflare' in html or 'Just a moment' in html:
            print('Bloqueado pelo Cloudflare :(')
        else:
            print('Pagina carregada com sucesso!')
            # Buscar INITIAL_STATE ou similar
            import re
            for pat in [r'window\.__INITIAL_STATE__\s*=\s*({.+?});', r'window\.__NUXT__\s*=\s*({.+?});', r'<script id="__NEXT_DATA__" type="application/json">({.+?})</script>']:
                m = re.search(pat, html, re.DOTALL)
                if m:
                    print(f"Encontrou estado da aplicacao! Padrão: {pat}")
                    with open('playground_state.json', 'w', encoding='utf-8') as f:
                        f.write(m.group(1))
                    break
                    
        print("\nXHRs:")
        for r in responses:
            print(r)
            
        await browser.close()

asyncio.run(main())
