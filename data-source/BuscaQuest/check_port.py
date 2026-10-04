import urllib.request
import json
import ssl
import sys

sys.stdout.reconfigure(encoding="utf-8")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://brokk.qconcursos.com/product/1/subjects?discipline_ids=1'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as r:
    data = json.loads(r.read().decode('utf-8'))

total = 0
def count(item):
    global total
    total += 1
    for child in item.get('nested_subjects', []):
        count(child)

for item in data:
    count(item)
    print(f"[{item['id']}] {item['name']} (filhos: {len(item.get('nested_subjects', []))})")

print('Total em Português:', total)
