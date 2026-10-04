import urllib.request
import json
import ssl
import sys

sys.stdout.reconfigure(encoding="utf-8")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://brokk.qconcursos.com/product/1/disciplines?per_page=500"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Total de disciplinas retornadas: {len(data)}")
        if data:
            print("Primeiras 5 disciplinas:")
            for d in data[:5]:
                print(f"  [{d['id']}] {d['nome']}")
            print("Últimas 5 disciplinas:")
            for d in data[-5:]:
                print(f"  [{d['id']}] {d['nome']}")
        with open("todas_disciplinas_raw.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Salvo em todas_disciplinas_raw.json")
except Exception as e:
    print(f"Erro: {e}")
