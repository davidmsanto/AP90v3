import re
from pathlib import Path
import json

html_path = Path('C:/Users/David M/Documents/BuscaQuest/playground_dump_html.html')
html = html_path.read_text(encoding='utf-8')

print(f"HTML Length: {len(html)}")

patterns = [
    r"window\.__INITIAL_STATE__\s*=\s*(\{.+?\});",
    r"window\.__NUXT__\s*=\s*(\{.+?\});",
    r'<script id="__NEXT_DATA__" type="application/json">(\{.+?\})</script>'
]

found = False
for pat in patterns:
    match = re.search(pat, html, re.DOTALL)
    if match:
        print(f"Encontrou dados no padrão: {pat}")
        state = match.group(1)
        Path('playground_state.json').write_text(state, encoding='utf-8')
        found = True
        break

if not found:
    print("Estado JSON embarcado não encontrado. Buscando menções a 'Direito Constitucional'...")
    idx = html.find('Direito Constitucional')
    if idx > 0:
        print("Trecho com Direito Constitucional:")
        print(html[max(0, idx-200):idx+500])
    else:
        print("Disciplina não encontrada no HTML.")
