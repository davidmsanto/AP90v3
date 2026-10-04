import urllib.request
import json
import ssl

token = "AhDQKvXynt8cqawoFytkFb5xBExYS6FkgGzs_M6pTqxv"
hermodr_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJ1c2VyX2lkIjoxMjE5NDMzN30.IGbOqd45xiPdxDGjzRi-bj3CmRGLEZoTJH2Q2HvoClw5_t39D6s0rUHH29zZC7HHMQOqTHxbZCwAuoNtWIQGNd1XkH6nrhExQArs4MglaOmzUJGD3s89KhcqVxaN8m3-iaxWFaUIK5bTO-EKK4XL1WKehNRPyvof67gRWSHZKdceoXGt9xCNdOC0tbfVqOzdsnGvYh1nQ034AcIACFhIrhtBMG1SjIs3_4NqHR_6lpqkUiNUhLNYDdTfg3_R6Kp4C2GSktZXl6wWR_5U3DgQFQkQKU_9DchKd73kjEnywCfxfydkTRtrBqblNEEuYV9ILlliPnrovrqogKukv56AhQmRmweuK3m0NRzeQ86r4Q4vfJNfivo_ceFO3n1u77gIoHGtgoJpsRBFP1ITO4VID2v6zs9Yp8NBcV7ZoeCUPa9XIdVyCNLCOGZllLU7X6YvCLAPDhGy2Jbyh4lfOlxxsCiYnYmDURCgLWFNuNmM5UPzEoeMGVPw2B9t95PCCHDyC-ZZ53Oc0IgAi7OBz6udPgdZOJkBSSZmVmRbpizuYlcz90_Y1_eJzzyS7bYqvVpGs-bo-cW3zEYqL7KzoqaZsKqpedc-xUxf5fTgpafozle5Uo4qksKbfkJ-4EihO8N9On3YkZBhtzbKPQNW0PFRr7UiM7jbPZzvhOdCcnbvKCA"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls_to_test = [
    ("Sem Auth", "https://brokk.qconcursos.com/product/1/disciplines/1/subjects?per_page=50", {}),
    ("Token Bearer", "https://brokk.qconcursos.com/product/1/disciplines/1/subjects?per_page=50", {"Authorization": f"Bearer {token}"}),
    ("Hermodr Bearer", "https://brokk.qconcursos.com/product/1/disciplines/1/subjects?per_page=50", {"Authorization": f"Bearer {hermodr_token}"}),
    ("X-Token", "https://brokk.qconcursos.com/product/1/disciplines/1/subjects?per_page=50", {"X-User-Token": token}),
    ("Brokk query", "https://brokk.qconcursos.com/product/1/subjects?discipline_ids[]=1&per_page=50", {}),
]

for name, url, headers in urls_to_test:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", **headers})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            n = len(data) if isinstance(data, list) else len(data.get('data', []))
            print(f"[{name}] Sucesso: {n} itens retornados! HTTP {resp.status}")
            if n > 0:
                sample = data[0] if isinstance(data, list) else data.get('data', [])[0]
                print(f"  Amostra: {sample}")
    except urllib.error.HTTPError as e:
        print(f"[{name}] Falha: HTTP {e.code}")
    except Exception as e:
        print(f"[{name}] Erro: {e}")
