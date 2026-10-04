import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

patterns = [
    "https://brokk.qconcursos.com/product/1/subjects?discipline_id=1",
    "https://brokk.qconcursos.com/product/1/subjects?discipline_id=1&per_page=10",
    "https://brokk.qconcursos.com/product/1/subjects?discipline_ids=1",
    "https://brokk.qconcursos.com/product/1/subjects?by_discipline=1",
    "https://brokk.qconcursos.com/product/1/subjects?by_discipline_id=1",
    "https://brokk.qconcursos.com/product/1/subjects?q[discipline_id_eq]=1",
    "https://brokk.qconcursos.com/product/1/disciplines/1/subjects",
    "https://brokk.qconcursos.com/disciplines/1/subjects",
    "https://www.qconcursos.com/api/disciplines/1/subjects",
    "https://www.qconcursos.com/api/subjects?discipline_id=1",
    "https://app.qconcursos.com/api/subjects?discipline_id=1",
    "https://brokk.qconcursos.com/product/1/subjects?use_separator=true&discipline_ids[]=1",
]

for url in patterns:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            n = len(data) if isinstance(data, list) else len(data.get('data', []))
            print(f"[{resp.status}] {n} itens -> {url}")
            if n > 0 and n != 258:
                first = data[0] if isinstance(data, list) else data.get('data', [])[0]
                print(f"   MATCH POSSÍVEL: {first}")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {url}")
    except Exception as e:
        print(f"[ERR] {url} -> {e}")
