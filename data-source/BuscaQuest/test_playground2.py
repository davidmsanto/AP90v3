import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        )
        await page.goto("https://app.qconcursos.com/playground/filtro", wait_until="networkidle")
        html = await page.content()
        with open('playground.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print('Salvo playground.html')
        await browser.close()
asyncio.run(main())
