import urllib.request
import json
import ssl
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Carregar lista completa de disciplinas
disciplinas_file = Path(r"C:\Users\David M\Documents\BuscaQuest\todas_disciplinas_raw.json")
disciplinas = json.loads(disciplinas_file.read_text(encoding="utf-8"))

print("="*65)
print(f" INICIANDO EXTRAÇÃO GLOBAL DE TODAS AS {len(disciplinas)} DISCIPLINAS")
print("="*65)

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
total_assuntos_geral = 0
disciplinas_com_assuntos = 0

for idx, disc in enumerate(disciplinas, 1):
    disc_id = disc["id"]
    disc_nome = disc["nome"].strip()
    
    url = f"https://brokk.qconcursos.com/product/1/subjects?discipline_ids={disc_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    
    sucesso = False
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                flat = flatten_subjects(data)
                
                taxonomy_full.append({
                    "discipline_id": disc_id,
                    "discipline_nome": disc_nome,
                    "subjects": flat
                })
                
                count_subj = len(flat)
                total_assuntos_geral += count_subj
                if count_subj > 0:
                    disciplinas_com_assuntos += 1
                
                # Montar hierarquia textual para o TXT
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
                            for gg in children_map.get(g["id"], []):
                                txt_lines.append(f"      ---> [{gg['id']}] {gg['nome']}")
                
                print(f"[{idx:3}/{len(disciplinas)}] ✅ [{disc_id:3}] {disc_nome:<40} : {count_subj} assuntos")
                sucesso = True
                break
        except Exception as e:
            time.sleep(0.5)
            
    if not sucesso:
        print(f"[{idx:3}/{len(disciplinas)}] ❌ [{disc_id:3}] {disc_nome:<40} : Erro persistente")
        taxonomy_full.append({
            "discipline_id": disc_id,
            "discipline_nome": disc_nome,
            "subjects": []
        })

    # Pausa de cortesia de 80ms para evitar rate limiting
    time.sleep(0.08)

# Salvar taxonomia completa em JSON
json_out = Path(r"C:\Users\David M\Documents\BuscaQuest\taxonomia_qc_full.json")
json_out.write_text(json.dumps(taxonomy_full, ensure_ascii=False, indent=2), encoding="utf-8")

# Salvar dicionário hierárquico em TXT
txt_out = Path(r"C:\Users\David M\Documents\BuscaQuest\prompt_grounding_taxonomia.txt")
txt_out.write_text("\n".join(txt_lines), encoding="utf-8")

print("\n" + "="*65)
print(" EXTRAÇÃO GLOBAL FINALIZADA!")
print(f" Total de Disciplinas: {len(taxonomy_full)}")
print(f" Disciplinas com Assuntos: {disciplinas_com_assuntos}")
print(f" Total Global de Assuntos e Subassuntos: {total_assuntos_geral}")
print(f" Arquivo JSON: {json_out} ({json_out.stat().st_size / 1024:.1f} KB)")
print(f" Arquivo TXT: {txt_out} ({txt_out.stat().st_size / 1024:.1f} KB, {len(txt_lines)} linhas)")
print("="*65)
