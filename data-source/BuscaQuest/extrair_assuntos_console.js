(async function() {
    const TARGETS = [
        {id: 1, nome: "Português"},
        {id: 2, nome: "Direito Administrativo"},
        {id: 3, nome: "Direito Constitucional"},
        {id: 4, nome: "Raciocínio Lógico"},
        {id: 9, nome: "Direito Penal"},
        {id: 10, nome: "Direito Processual Penal"},
        {id: 13, nome: "Matemática"},
        {id: 39, nome: "Matemática Financeira"},
        {id: 40, nome: "Estatística"},
        {id: 46, nome: "Noções de Informática"},
        {id: 97, nome: "Segurança da Informação"},
        {id: 203, nome: "Direito Penal Militar"},
        {id: 204, nome: "Direito Processual Penal Militar"},
        {id: 226, nome: "Matemática Atuarial"}
    ];
    
    let taxonomy = [];
    console.log("%c[QConcursos] Iniciando extração de " + TARGETS.length + " disciplinas...", "color: #00ff00; font-size: 16px; font-weight: bold;");
    
    for (let target of TARGETS) {
        console.log(`%c⏳ Buscando assuntos para: ${target.nome}...`, "color: #ffaa00;");
        try {
            // Usa o endpoint oficial da API que descobrimos
            let res = await fetch(`https://brokk.qconcursos.com/product/1/subjects?use_separator=true&discipline_id=${target.id}&per_page=1000`);
            
            if (!res.ok) {
                console.error(`Falha no HTTP ${res.status} para ${target.nome}`);
                continue;
            }
            
            let data = await res.json();
            
            // Adaptação para o formato de resposta
            let raw = Array.isArray(data) ? data : (data.data || data.subjects || data.items || []);
            
            // Se vier o catálogo global de 258 matérias, ignora (significa que o filtro falhou)
            if (raw.length === 258) {
                console.warn(`⚠️ API retornou o catálogo global para ${target.nome}. O filtro foi ignorado.`);
                continue;
            }
            
            let subjects = raw.map(s => {
                let id = parseInt(s.id || s.subject_id);
                // Limpa o nome removendo a contagem de questões ex: (1.523)
                let nome = (s.name || s.nome || "").replace(/\(\d[\d.,]*\s*\)/g, "").replace(/\s+/g, " ").trim();
                let pid = parseInt(s.parent_id || s.parentId) || null;
                return { id, nome, parent_id: pid };
            }).filter(s => s.id && s.nome);
            
            taxonomy.push({
                discipline_id: target.id,
                discipline_nome: target.nome,
                subjects: subjects
            });
            
            console.log(`%c✅ Sucesso: ${subjects.length} assuntos capturados.`, "color: #00ff00;");
        } catch (e) {
            console.error(`❌ Erro em ${target.nome}:`, e);
        }
        
        // Pequena pausa para evitar bloqueio da API
        await new Promise(r => setTimeout(r, 600));
    }
    
    console.log("%c🎉 Extração concluída! Iniciando download...", "color: #00aaff; font-size: 14px;");
    
    if (taxonomy.length === 0) {
        console.error("Nenhuma disciplina foi capturada com sucesso.");
        return;
    }
    
    // Gera o arquivo JSON e aciona o download
    let jsonStr = JSON.stringify(taxonomy, null, 2);
    let blob = new Blob([jsonStr], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = "taxonomia_qc_full.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log("Download do taxonomia_qc_full.json realizado. Coloque este arquivo na pasta BuscaQuest!");
})();
