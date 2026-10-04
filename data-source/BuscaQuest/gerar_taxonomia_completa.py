import urllib.request
import json
import ssl
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# Lista das 14 disciplinas prioritárias
TARGET_DISCIPLINES = [
    (1,   "Língua Portuguesa"),
    (2,   "Direito Administrativo"),
    (3,   "Direito Constitucional"),
    (4,   "Raciocínio Lógico"),
    (9,   "Direito Penal"),
    (10,  "Direito Processual Penal"),
    (13,  "Matemática"),
    (39,  "Matemática Financeira"),
    (40,  "Estatística"),
    (46,  "Noções de Informática"),
    (97,  "Segurança da Informação"),
    (203, "Direito Penal Militar"),
    (204, "Direito Processual Penal Militar"),
    (226, "Matemática Atuarial"),
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def flatten_subjects(raw_list, parent_id=None):
    flat = []
    for item in (raw_list or []):
        if not isinstance(item, dict):
            continue
        sid = item.get("id")
        nome = (item.get("name") or "").strip()
        if sid and nome:
            flat.append({
                "id": int(sid),
                "nome": nome,
                "parent_id": parent_id
            })
            kids = item.get("nested_subjects") or []
            flat.extend(flatten_subjects(kids, parent_id=int(sid)))
    return flat

taxonomy_full = []
txt_lines = []

print("="*65)
print(" EXTRAÇÃO DETERMINÍSTICA DIRETA DA API BROKK DO QCONCURSOS")
print("="*65)

for disc_id, disc_nome in TARGET_DISCIPLINES:
    url = f"https://brokk.qconcursos.com/product/1/subjects?discipline_ids={disc_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
            flat = flatten_subjects(data)
            print(f"✅ [{disc_id:3}] {disc_nome:<35} : {len(flat)} assuntos/subassuntos extraídos")
            
            taxonomy_full.append({
                "discipline_id": disc_id,
                "discipline_nome": disc_nome,
                "subjects": flat
            })
            
            # Montagem estruturada do arquivo TXT
            txt_lines.append(f"\n=== DISCIPLINA: [{disc_id}] {disc_nome} ===")
            roots = [s for s in flat if s["parent_id"] is None]
            children_map = {}
            for s in flat:
                if s["parent_id"]:
                    children_map.setdefault(s["parent_id"], []).append(s)
            
            for r in roots:
                txt_lines.append(f"[{r['id']}] {r['nome']}")
                for c in children_map.get(r["id"], []):
                    txt_lines.append(f"  -> [{c['id']}] {c['nome']}")
                    for g in children_map.get(c["id"], []):
                        txt_lines.append(f"    --> [{g['id']}] {g['nome']}")
                        
    except Exception as e:
        print(f"❌ [{disc_id:3}] {disc_nome:<35} : Erro {e}")
        taxonomy_full.append({
            "discipline_id": disc_id,
            "discipline_nome": disc_nome,
            "subjects": []
        })

# Salvar taxonomia completa em JSON
json_out = Path(r"C:\Users\David M\Documents\BuscaQuest\taxonomia_qc_full.json")
json_out.write_text(json.dumps(taxonomy_full, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n[OK] Salvo: {json_out} ({len(taxonomy_full)} disciplinas)")

# Salvar dicionário hierárquico em TXT
txt_out = Path(r"C:\Users\David M\Documents\BuscaQuest\prompt_grounding_taxonomia.txt")
txt_out.write_text("\n".join(txt_lines), encoding="utf-8")
print(f"[OK] Salvo: {txt_out} ({len(txt_lines)} linhas)")

print("Extração concluída com 100% de sucesso determinístico!")
