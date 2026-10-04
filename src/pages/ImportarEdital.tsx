import React, { useState } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Check, 
  AlertTriangle, 
  RotateCcw, 
  Key, 
  Trash2, 
  Plus, 
  Loader2,
  Calendar,
  Building,
  Briefcase,
  FileText,
  ExternalLink,
  Search,
  X,
  CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { 
  DEFAULT_USER_ID, 
  Edital, 
  Topico, 
  ExtractedDisciplina, 
  ExtractedTopico, 
  TaxonomiaDisciplina, 
  QConcursosFiltro 
} from '../types';
import { Card, Button, Badge, MetricCard } from '../components/ui';
import { extractEditalWithAI, parseEditalLocalFallback } from '../services/extractEdital';
import { mapEditalToQconcursos, buildQConcursosUrl } from '../services/mapEditalToQconcursos';
import { getAISettings, saveAISettings, clearAISettings, testAIConnection, AIProvider } from '../services/aiClient';
import { ModalQConcursosSelector } from '../components/ModalQConcursosSelector';

interface ImportarEditalProps {
  onSuccess?: () => void;
}

const SAMPLE_EDITAL_TEXT = `
DISCIPLINA: LÍNGUA PORTUGUESA
1 Compreensão e interpretação de textos de gêneros variados.
2 Reconhecimento de tipos e gêneros textuais.
3 Domínio da ortografia oficial.
4 Domínio dos mecanismos de coesão textual: Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual.
5 Domínio dos mecanismos de coesão textual: Emprego de tempos e modos verbais.
6 Domínio da estrutura morfossintática do período: Emprego das classes de palavras.
7 Domínio da estrutura morfossintática do período: Relações de coordenação entre orações e entre termos da oração.
8 Domínio da estrutura morfossintática do período: Relações de subordinação entre orações e entre termos da oração.
9 Domínio da estrutura morfossintática do período: Emprego dos sinais de pontuação.
10 Domínio da estrutura morfossintática do período: Concordância verbal e nominal.
11 Domínio da estrutura morfossintática do período: Regência verbal e nominal.
12 Domínio da estrutura morfossintática do período: Emprego do sinal indicativo de crase.
13 Domínio da estrutura morfossintática do período: Colocação dos pronomes átonos.
14 Reescrita de frases e parágrafos do texto: Significação das palavras.
15 Reescrita de frases e parágrafos do texto: Substituição de palavras ou de trechos de texto.
16 Reescrita de frases e parágrafos do texto: Reorganização da estrutura de orações e de períodos do texto.
17 Reescrita de frases e parágrafos do texto: Reescrita de textos de diferentes gêneros e níveis de formalidade.

DISCIPLINA: TECNOLOGIA DA INFORMAÇÃO E SEGURANÇA CIBERNÉTICA
1 Noções de sistema operacional (ambientes Linux e Windows).
2 Edição de textos, planilhas e apresentações (pacotes Microsoft Office).
3 Redes de computadores: conceitos básicos, ferramentas, aplicativos e procedimentos de Internet e intranet.
4 Programas de navegação (Microsoft Edge e Google Chrome).
5 Programas de correio eletrônico (Microsoft Outlook).
6 Sítios de busca e pesquisa na Internet e Grupos de discussão.
7 Computação na nuvem (cloud computing).
8 Conceitos de organização e de gerenciamento de informações, arquivos, pastas e programas.
9 Segurança da informação: procedimentos de segurança, vírus, worms, pragas virtuais e aplicativos de segurança (antivírus, firewall, anti-spyware, backup, cloud storage).
10 Banco de dados: organização de arquivos, métodos de acesso, abstração, modelos de dados, SGBD, linguagens de definição e manipulação, SQL, proteção, segurança, integridade, distribuídos e orientado a objetos.
11 Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD).
12 Serviços públicos digitais e Inteligência Artificial.
13 Linguagem de programação (Java, Python, Apex e C#).
14 Fundamentos de Segurança da Informação (confidencialidade, integridade, disponibilidade).
15 Gestão de Riscos e Conformidade (avaliação de riscos, políticas de segurança, conformidade).
16 Segurança de Rede (Firewalls, IDS/IPS, VPNs e segmentação de rede).
17 Criptografia: técnicas e principais ferramentas.
18 Segurança em Nuvem.
19 Gestão de Identidades e Acesso (Autenticação, Autorização, SSO, SAML, OAuth2, OpenID Connect).
20 Principais tipos de ataques e vulnerabilidades.
21 Controles e testes de segurança para aplicações Web e Web Services.
22 Soluções para Segurança da Informação (Firewall, IDS, IPS, SIEM, Proxy, IAM, PAM, Antivírus, Antispam).
23 Frameworks de segurança (MITRE, CIS Controls e NIST CSF).
24 Tratamento de Incidentes Cibernéticos.
25 Assinatura e certificação digital, criptografia e proteção de dados em trânsito e em repouso.
26 Segurança em nuvens e de contêineres.

DISCIPLINA: RACIOCÍNIO LÓGICO-MATEMÁTICO
1 Princípios de contagem.
2 Razões e proporções.
3 Regras de três simples.
4 Porcentagens.
5 Equações de 1º e de 2º graus.
6 Sequências numéricas.
7 Progressões aritméticas e geométricas.
8 Funções e gráficos.
9 Estruturas lógicas.
10 Lógica de argumentação (Analogias, inferências, deduções e conclusões).
11 Lógica Sentencial (ou Proposicional): Proposições simples e compostas.
12 Lógica Sentencial (ou Proposicional): Tabelas-verdade.
13 Lógica Sentencial (ou Proposicional): Equivalências e Leis de De Morgan.
14 Lógica Sentencial (ou Proposicional): Diagramas lógicos.
15 Lógica de primeira ordem.
16 Princípios de contagem e probabilidade.
17 Operações com conjuntos.
18 Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais.

DISCIPLINA: NOÇÕES DE DIREITOS HUMANOS
1 Teoria geral dos direitos humanos: Conceitos, terminologia, estrutura normativa, fundamentação.
2 Afirmação histórica dos direitos humanos.
3 Direitos humanos e responsabilidade do Estado.
4 Direitos humanos na Constituição Federal.
5 Política Nacional de Direitos Humanos.
6 Tratados Internacionais: A Constituição brasileira e os tratados internacionais de direitos humanos.
7 Tratados Internacionais: Pacto de São José da Costa Rica e Decreto nº 678/1992 (Convenção Americana sobre Direitos Humanos).

DISCIPLINA: ATUALIDADES
1 Tópicos relevantes e atuais de diversas áreas (segurança, política, economia, sociedade, tecnologia, ecologia etc.).

DISCIPLINA: ÉTICA NO SERVIÇO PÚBLICO
1 Ética e moral; Ética, princípios e valores.
2 Ética e democracia: exercício da cidadania; Ética e função pública.
3 Legislação de Ética: Lei estadual nº 6.754/2006 (Código de Ética Funcional do Servidor Público do Estado de Alagoas).

DISCIPLINA: NOÇÕES DE DIREITO PENAL
1 Aplicação da lei penal: Princípios; A lei penal no tempo e no espaço; Tempo e lugar do crime; Lei penal excepcional, especial e temporária; Contagem de prazo; Irretroatividade da lei penal.
2 Crimes contra a pessoa.
3 Crimes contra o patrimônio.
4 Crimes contra a administração pública.
5 Disposições constitucionais aplicáveis ao direito penal.

DISCIPLINA: NOÇÕES DE DIREITO PROCESSUAL PENAL
1 Disposições preliminares do Código de Processo Penal.
2 Inquérito policial: Histórico, natureza, conceito, finalidade, características, fundamento, titularidade, grau de cognição, valor probatório, formas de instauração, notitia criminis, delatio criminis, procedimentos investigativos, indiciamento, garantias do investigado, conclusão.
3 Prisão e liberdade provisória.
4 Disposições constitucionais aplicáveis ao direito processual penal.
5 Legislação Específica: Lei 9.099/1995 e suas alterações (Juizados Especiais Cíveis e Criminais).

DISCIPLINA: NOÇÕES DE DIREITO CONSTITUCIONAL
1 Constituição Federal de 1988: Direitos e Garantias Fundamentais.
2 Constituição Federal de 1988: Título V, Capítulo III - Da Segurança Pública.

DISCIPLINA: NOÇÕES DE DIREITO ADMINISTRATIVO
1 Organização administrativa: Centralização, descentralização, concentração e desconcentração; Administração direta e indireta; Autarquias, fundações, empresas públicas e sociedade de economia mista.
2 Ato administrativo: Conceito, requisitos, atributos, classificação e espécies.
3 Agente público: Legislação pertinente, disposições constitucionais aplicáveis, cargo, emprego e função pública.
4 Poderes administrativos: Hierárquico, disciplinar, regulamentar e de polícia; Uso e abuso do poder.
5 Licitações: Princípios; Contratação direta, dispensa e inexigibilidade; Modalidades, tipos e procedimentos.
6 Controle da administração pública: Controle judicial e controle legislativo.
7 Responsabilidade civil do Estado: Responsabilidade por ato comissivo e omissão; Requisitos; Causas excludentes e atenuantes.

DISCIPLINA: LEGISLAÇÃO INSTITUCIONAL DO ESTADO DE ALAGOAS
1 Constituição do Estado de Alagoas.
2 Lei estadual nº 3.437/1975 e suas alterações (Estatuto da Polícia Civil do Estado de Alagoas).
3 Lei estadual nº 5.247/1991 e suas alterações (Regime Jurídico Único dos Servidores Públicos Civis do Estado de Alagoas).
4 Lei estadual nº 14.735/2026 e suas alterações (Lei Orgânica Nacional das Polícias Civis).
5 Lei nº 6.441/2003 e suas alterações.
6 Lei Estadual nº 6.276/2001 e suas alterações.
7 Lei estadual nº 6.479/2004.
8 Lei nº 10.826/2003 e suas alterações (Estatuto do Desarmamento).
9 Lei Estadual nº 4.590/1984.

DISCIPLINA: LEGISLAÇÃO PENAL ESPECIAL
1 Crimes Financeiros e Fiscais: Crimes contra as finanças públicas.
2 Lei de Drogas: Lei nº 11.343/2006 e suas alterações (Tráfico ilícito e uso indevido de substâncias entorpecentes).
3 Crime Organizado: Lei nº 12.850/2013 e suas alterações (Crime organizado).
4 Sistema Financeiro Nacional: Lei nº 7.492/1986 (Crimes contra o sistema Financeiro Nacional).
5 Ordem Econômica e Tributária: Lei nº 8.137/1990 e suas alterações (Crimes contra a ordem econômica e tributária e as relações de consumo).
6 Lavagem de Dinheiro: Lei nº 9.613/1998 e suas alterações (Lavagem de dinheiro).
7 Ordem Econômica: Lei nº 8.176/1991 (Crimes contra a ordem econômica).
8 Crimes Hediondos: Lei nº 8.072/1990 e suas alterações (Crimes hediondos).
9 Preconceito: Lei nº 7.716/1989 e suas alterações (Crimes resultantes de preconceitos de raça ou de cor).
10 Tortura: Lei nº 9.455/1997 e suas alterações (Crimes de tortura).
11 Meio Ambiente: Lei nº 9.605/1998 e suas alterações (Crimes contra o meio ambiente).
12 Crimes de Responsabilidade: Decreto-Lei nº 201/1967, Lei nº 1.079/1950 e Lei nº 8.176/1991.
13 Crimes Falimentares: Lei nº 11.101/2005 e suas alterações.
14 Licitações: Lei nº 14.133/2021 (Crimes em licitações e contratos administrativos).
15 Abuso de Autoridade: Lei nº 13.869/2019 (Crimes de abuso de autoridade).
16 Crime Cibernético: Convenção de Budapeste - Decreto nº 11.491/2023 (Promulga a Convenção sobre o Crime Cibernético).
17 Estatuto da Pessoa com Deficiência: Lei nº 13.146/2015 e suas alterações (Crimes previstos no Estatuto da Pessoa com Deficiência).
18 Pessoa Idosa: Lei 10.741/2003 e suas alterações (Crimes cometidos contra a pessoa idosa).

DISCIPLINA: NOÇÕES DE CONTABILIDADE, ANÁLISE FINANCEIRA E CRIMES CONTRA A ORDEM TRIBUTÁRIA
1 Noções de Contabilidade: Conceitos, objetivos e finalidades da contabilidade.
2 Noções de Contabilidade: Patrimônio: componentes, equação fundamental do patrimônio, situação líquida, representação gráfica.
3 Noções de Contabilidade: Atos e fatos administrativos: conceitos, fatos permutativos, modificativos e mistos.
4 Noções de Contabilidade: Contas: conceitos, contas de débitos, contas de créditos e saldos; Plano de contas.
5 Noções de Contabilidade: Contabilização de operações contábeis diversas.
6 Noções de Contabilidade: Análise e conciliações contábeis: composição de contas, análise de contas, conciliação bancária.
7 Noções de Contabilidade: Balancete de verificação: conceitos, modelos e técnicas de elaboração.
8 Noções de Contabilidade: Balanço patrimonial e Demonstração de resultado de exercício (DRE).
9 Noções de Contabilidade: Noções de finanças, orçamento, tributos e seus impactos nas operações das empresas.
10 Análise Financeira: Métodos e ferramentas de análise; Gestão, identificação, mitigação e monitoramento de risco financeiro.
11 Crimes contra a Ordem Tributária: Crimes de lavagem de dinheiro ou ocultação de bens, direitos e valores (Lei nº 9.613/1998).
12 Crimes contra a Ordem Tributária: Crimes de fraude a credores em processos de recuperação judicial, extrajudicial e falência.
13 Crimes contra a Ordem Tributária: Crimes contra a previdência social, finanças públicas, Sistema Financeiro Nacional e mercado de capitais.
14 Crimes contra a Ordem Tributária: Análise de indícios de fraudes contábeis, ocultação de patrimônio, smurfing, laranjas, empresas fictícias e movimentações atípicas.
15 Crimes contra a Ordem Tributária: Lei nº 8.137/1990 e suas alterações (Crimes contra a ordem tributária).

DISCIPLINA: ESTATÍSTICA E ANÁLISE DE DADOS
1 Estatística descritiva e análise exploratória de dados: gráficos, diagramas, tabelas, medidas descritivas (posição, dispersão, assimetria e curtose).
2 Probabilidade e Probabilidade Condicional: definições, axiomas, independência, Regra de Bayes, Teorema da Probabilidade Total.
3 Variáveis aleatórias discretas e contínuas; Função de probabilidade e densidade de probabilidade; Esperança e momentos.
4 Principais distribuições de probabilidade: uniforme, Bernoulli, binomial, normal.
5 Medidas de tendência central (média, mediana, moda) e dispersão (amplitude, variância, desvio padrão, coeficiente de variação).
6 Coeficiente de Correlação de Pearson, Teorema Central do Limite e Regra Empírica (Três Sigma).
7 Técnicas de amostragem: aleatória simples, estratificada, sistemática e por conglomerados; Tamanho amostral.
8 Inferência estatística: estimação pontual, intervalar e testes de hipóteses (teste t de Student, qui-quadrado).
9 Análise de regressão linear: mínimos quadrados, máxima verossimilhança, ANOVA e análise de resíduos.
10 Análise de Dados: Dados estruturados, não estruturados, abertos; Coleta, tratamento, armazenamento, ETL; Formatos (XML, JSON, CSV); Aritmética computacional.
11 Análise de Dados: Exploração e Mineração de dados: CRISP-DM, pré-processamento, classificação, associação, clusterização, detecção de anomalias, modelagem preditiva.
12 Análise de Dados: Processamento de Linguagem Natural (PLN): semântica vetorial, redução de dimensionalidade, tópicos latentes, classificação de textos, sentimentos, n-gramas.
13 Análise de Dados: Machine Learning: erro em modelos, validação, underfitting, overfitting, regularização, hiperparâmetros, modelos lineares, árvores de decisão, redes neurais, Naive Bayes.
14 Análise de Dados: Linguagem Python: sintaxe, variáveis, controle de fluxo, estruturas de dados, funções, arquivos; Bibliotecas (NLTK, TensorFlow, Pandas, NumPy, Scikit-learn, SciPy).

DISCIPLINA: CRIMES CIBERNÉTICOS E SEGURANÇA DIGITAL
1 Crimes Cibernéticos: Lei nº 12.737/2012 (Lei Carolina Dieckmann).
2 Crimes Cibernéticos: Conceito e Classificação de Crimes Cibernéticos.
3 Crimes Cibernéticos: Requisitos legais e limites para a Busca e Apreensão de itens digitais (Art. 240 e seguintes do CPP).
4 Segurança Digital: Privacidade e Cuidados com redes sociais.
5 Segurança Digital: Autenticação: Autenticação multifator (MFA) e Senhas seguras.
6 Segurança Digital: Golpes virtuais (Phishing), Links suspeitos e Malwares.
7 Segurança Digital: Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD).
`;

export const ImportarEdital: React.FC<ImportarEditalProps> = ({ onSuccess }) => {
  const { salvarEdital } = useAppStore();

  // Estados do Formulário
  const [concurso, setConcurso] = useState('PC-AL 2026');
  const [cargo, setCargo] = useState('Agente de Polícia Civil');
  const [banca, setBanca] = useState('Cebraspe');
  const [dataProva, setDataProva] = useState('2026-11-15');
  const [conteudoBruto, setConteudoBruto] = useState(SAMPLE_EDITAL_TEXT);

  // Estados do Fluxo de Importação
  const [fase, setFase] = useState<'formulario' | 'processando' | 'revisao'>('formulario');
  const [mensagemProgresso, setMensagemProgresso] = useState('');
  const [etapaAtual, setEtapaAtual] = useState<'A' | 'B'>('A');
  const [usouIA, setUsouIA] = useState<boolean>(false);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);

  // Dados pós-extração
  const [disciplinasExtraidas, setDisciplinasExtraidas] = useState<ExtractedDisciplina[]>([]);
  const [taxonomiaRecorte, setTaxonomiaRecorte] = useState<TaxonomiaDisciplina[]>([]);

  // Configuração de Chave de IA
  const [showConfigAI, setShowConfigAI] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>(getAISettings().provider);
  const [aiKey, setAiKey] = useState(getAISettings().apiKey);
  const [aiModel, setAiModel] = useState<string>(getAISettings().model || 'gemini-2.0-flash');
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Modal Seletor de Assunto QC
  const [modalTopic, setModalTopic] = useState<{
    disciplinaId: string;
    topic: ExtractedTopico;
  } | null>(null);

  const handleSaveAISettings = () => {
    saveAISettings(aiProvider, aiKey, aiModel);
    setShowConfigAI(false);
    alert('Configurações de IA salvas com sucesso!');
  };

  const handleTestAI = async () => {
    if (!aiKey.trim()) {
      setTestResult({ success: false, message: 'Insira uma chave de API antes de testar.' });
      return;
    }
    setIsTestingAI(true);
    setTestResult(null);
    try {
      saveAISettings(aiProvider, aiKey, aiModel);
      const res = await testAIConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || String(err) });
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleClearAI = () => {
    clearAISettings();
    setAiKey('');
    setTestResult(null);
    setShowConfigAI(false);
    alert('Chave removida com sucesso! O AP90 utilizará o algoritmo inteligente local (100% gratuito e offline).');
  };

  const handleCarregarExemplo = () => {
    setConcurso('PC-AL 2026');
    setCargo('Agente de Polícia Civil');
    setBanca('Cebraspe');
    setDataProva('2026-11-15');
    setConteudoBruto(SAMPLE_EDITAL_TEXT);
  };

  const handleEstruturarEdital = async () => {
    if (!conteudoBruto.trim()) {
      alert('Por favor, cole o conteúdo programático do edital.');
      return;
    }

    setFase('processando');
    setAvisoIA(null);

    try {
      // ETAPA A: Estruturação (IA com aviso transparente caso use fallback)
      setEtapaAtual('A');
      setMensagemProgresso('Etapa A: Estruturando disciplinas e tópicos hierárquicos...');
      const extractResult = await extractEditalWithAI(conteudoBruto);
      let disciplinas = extractResult.disciplinas;
      setUsouIA(extractResult.usedAI);
      if (extractResult.warning) {
        setAvisoIA(extractResult.warning);
      }

      if (!disciplinas || disciplinas.length === 0) {
        disciplinas = parseEditalLocalFallback(conteudoBruto);
      }

      if (!disciplinas || disciplinas.length === 0) {
        throw new Error('Não foi possível identificar conteúdo no texto informado. Por favor, verifique o texto colado.');
      }

      // ETAPA B: Mapeamento pro QConcursos (Leis + Keywords + Grounding IA + Recorte)
      setEtapaAtual('B');
      setMensagemProgresso('Etapa B: Mapeando tópicos para a taxonomia do QConcursos...');
      const mapped = await mapEditalToQconcursos(
        disciplinas, 
        (msg) => {
          setMensagemProgresso(`Etapa B: ${msg}`);
        },
        banca
      );

      setDisciplinasExtraidas(mapped.disciplinas);
      setTaxonomiaRecorte(mapped.taxonomiaRecorte);
      setFase('revisao');
    } catch (err: any) {
      console.error(err);
      alert(`Erro no processamento do edital: ${err.message || err}`);
      setFase('formulario');
    }
  };

  // Funções de Edição na Revisão
  const handleUpdateTopicName = (discId: string, topicoId: string, newNome: string) => {
    setDisciplinasExtraidas(prev =>
      prev.map(d => {
        if (d.id !== discId) return d;
        return {
          ...d,
          topicos: d.topicos.map(t => (t.id === topicoId ? { ...t, nome: newNome } : t)),
        };
      })
    );
  };

  const handleUpdateTopicPeso = (discId: string, topicoId: string, newPeso: number) => {
    setDisciplinasExtraidas(prev =>
      prev.map(d => {
        if (d.id !== discId) return d;
        return {
          ...d,
          topicos: d.topicos.map(t => (t.id === topicoId ? { ...t, peso: Math.max(1, newPeso) } : t)),
        };
      })
    );
  };

  const handleDeleteTopic = (discId: string, topicoId: string) => {
    setDisciplinasExtraidas(prev =>
      prev.map(d => {
        if (d.id !== discId) return d;
        return {
          ...d,
          topicos: d.topicos.filter(t => t.id !== topicoId),
        };
      })
    );
  };

  const handleAddTopic = (discId: string) => {
    setDisciplinasExtraidas(prev =>
      prev.map(d => {
        if (d.id !== discId) return d;
        const newTopic: ExtractedTopico = {
          id: `manual_${Date.now()}`,
          nome: 'Novo Tópico',
          peso: 1,
          qconcursosFiltro: null,
        };
        return { ...d, topicos: [...d.topicos, newTopic] };
      })
    );
  };

  const handleUpdateTopicFiltro = (filtro: QConcursosFiltro | null) => {
    if (!modalTopic) return;
    const { disciplinaId, topic } = modalTopic;

    setDisciplinasExtraidas(prev =>
      prev.map(d => {
        if (d.id !== disciplinaId) return d;
        return {
          ...d,
          topicos: d.topicos.map(t =>
            t.id === topic.id
              ? {
                  ...t,
                  qconcursosFiltro: filtro,
                  definidoManualmente: true,
                }
              : t
          ),
        };
      })
    );
  };

  const handleResolverQuestoes = (discId: string, topico: ExtractedTopico) => {
    if (topico.qconcursosFiltro) {
      // 1. qconcursosFiltro preenchido → botão ativo, abre o link direto
      const url = buildQConcursosUrl(topico.qconcursosFiltro);
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // 2 e 3: Abre modal (com sugestões pré-carregadas ou em branco)
      setModalTopic({ disciplinaId: discId, topic: topico });
    }
  };

  const handleConfirmarEdital = () => {
    const editalId = `edital_${Date.now()}`;
    const editalModel: Edital = {
      id: editalId,
      userId: DEFAULT_USER_ID,
      nome: `${concurso} - ${cargo}`,
      concurso,
      cargo,
      banca,
      dataProva,
      disciplinas: disciplinasExtraidas.map(d => ({
        id: d.id,
        nome: d.nome,
        peso: d.peso || 1,
      })),
    };

    const flatTopicos: Topico[] = disciplinasExtraidas.flatMap(d =>
      d.topicos.map(t => ({
        id: t.id,
        disciplinaId: d.id,
        nome: t.nome,
        peso: t.peso || 1,
        concluido: false,
        qconcursosFiltro: t.qconcursosFiltro,
        sugestoesQC: t.sugestoesQC,
        definidoManualmente: t.definidoManualmente,
      }))
    );

    salvarEdital(editalModel, flatTopicos, taxonomiaRecorte);
    alert('Edital estruturado e salvo com sucesso!');
    onSuccess?.();
  };

  // Cálculos de métricas da revisão
  const totalTopicos = disciplinasExtraidas.reduce((acc, d) => acc + d.topicos.length, 0);
  const totalMapeados = disciplinasExtraidas.reduce(
    (acc, d) => acc + d.topicos.filter(t => t.qconcursosFiltro !== null).length,
    0
  );
  const totalPendentes = totalTopicos - totalMapeados;

  // RENDERIZAÇÃO: PROCESSANDO
  if (fase === 'processando') {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <Card variant="elevated" padding="lg">
          <div className="w-12 h-12 rounded-full bg-surface border border-surface-border-elevated flex items-center justify-center mx-auto text-accent-success animate-spin mb-4">
            <Loader2 className="w-6 h-6" />
          </div>
          <h2 className="text-h1 text-text-primary tracking-tight mb-2">
            Estruturando Edital
          </h2>
          <p className="text-body text-text-secondary mb-6">
            {mensagemProgresso}
          </p>

          <div className="flex justify-center gap-3">
            <Badge variant={etapaAtual === 'A' ? 'success' : 'neutral'}>
              Etapa A: Hierarquia & Estruturação
            </Badge>
            <Badge variant={etapaAtual === 'B' ? 'success' : 'neutral'}>
              Etapa B: QConcursos
            </Badge>
          </div>
        </Card>
      </div>
    );
  }

  // RENDERIZAÇÃO: TELA DE REVISÃO PÓS-EXTRAÇÃO
  if (fase === 'revisao') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Aviso explícito de Fallback de IA caso tenha ocorrido sobrecarga */}
        {avisoIA && (
          <div className="p-4 rounded-card bg-amber-500/10 border border-amber-500/30 text-caption text-amber-400 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5 text-text-primary">
                  Estruturação Concluída com Algoritmo Local
                </strong>
                <span className="text-text-secondary">{avisoIA}</span>
                <p className="mt-1 text-xs text-text-muted">
                  Todas as disciplinas e tópicos foram identificados e mapeados. Você pode revisar pesos, adicionar tópicos ou confirmar o edital abaixo.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAvisoIA(null)}
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-surface-border transition-colors"
              title="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header de Ação Principal */}
        <Card variant="elevated" padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="success">ESTRUTURAÇÃO CONCLUÍDA</Badge>
              {usouIA ? (
                <Badge variant="success">Processado via IA ({aiProvider.toUpperCase()})</Badge>
              ) : (
                <Badge variant="neutral">Estruturado via Algoritmo Local</Badge>
              )}
              <span className="text-caption font-mono text-text-secondary">{banca}</span>
            </div>
            <h1 className="text-h1 text-text-primary">
              {concurso}
            </h1>
            <p className="text-body text-text-secondary">
              {cargo} • Prova prevista: {dataProva || 'A definir'}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setFase('formulario')}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmarEdital}
              icon={<Check className="w-4 h-4" />}
            >
              Confirmar edital
            </Button>
          </div>
        </Card>

        {/* Métricas de Extração com os Badges Solicitados */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Disciplinas Extraídas"
            value={disciplinasExtraidas.length}
            context="Base estruturada"
            icon={<BookOpen className="w-4 h-4" />}
          />
          <MetricCard
            label="Tópicos Mapeados"
            value={totalMapeados}
            context={`${Math.round((totalMapeados / (totalTopicos || 1)) * 100)}% de correspondência`}
            badge={<Badge variant="success">Mapeados: {totalMapeados}</Badge>}
          />
          <MetricCard
            label="Pendentes"
            value={totalPendentes}
            context="Revisão manual disponível"
            badge={
              totalPendentes === 0 ? (
                <Badge variant="success">100%</Badge>
              ) : (
                <Badge variant="warning">Pendentes: {totalPendentes}</Badge>
              )
            }
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        </div>

        {/* Lista de Disciplinas e Tópicos Editáveis */}
        <div className="space-y-4">
          {disciplinasExtraidas.map(disc => (
            <Card key={disc.id} variant="default" padding="md" className="space-y-3">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-accent-success" />
                  <h2 className="text-h2 text-text-primary">{disc.nome}</h2>
                  <Badge variant="neutral" className="text-caption">
                    {disc.topicos.length} tópicos
                  </Badge>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddTopic(disc.id)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Adicionar tópico
                </Button>
              </div>

              {/* Tabela de Tópicos */}
              <div className="divide-y divide-surface-border">
                {disc.topicos.map(topico => {
                  const isMapped = topico.qconcursosFiltro !== null;

                  return (
                    <div
                      key={topico.id}
                      className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-body"
                    >
                      {/* Nome do Tópico Editável */}
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={topico.nome}
                          onChange={e => handleUpdateTopicName(disc.id, topico.id, e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-surface-border focus:border-accent-success rounded px-2 py-1 text-body text-text-primary focus:outline-none focus:bg-surface transition-colors"
                        />
                      </div>

                      {/* Controles: Peso + Mapeamento QC + Ações */}
                      <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto justify-between md:justify-end">
                        {/* Peso */}
                        <div className="flex items-center gap-1 text-caption text-text-secondary font-mono">
                          <span>Peso:</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={topico.peso}
                            onChange={e =>
                              handleUpdateTopicPeso(disc.id, topico.id, parseInt(e.target.value) || 1)
                            }
                            className="w-12 bg-surface border border-surface-border text-center rounded py-0.5 text-caption font-mono text-text-primary focus:border-accent-success focus:outline-none"
                          />
                        </div>

                        {/* Mapeamento QConcursos */}
                        <div className="flex items-center gap-2">
                          {isMapped ? (
                            <button
                              onClick={() => setModalTopic({ disciplinaId: disc.id, topic: topico })}
                              className="text-left group"
                              title="Clique para alterar mapeamento"
                            >
                              <Badge
                                variant="success"
                                className="max-w-[180px] truncate cursor-pointer group-hover:border-accent-success"
                              >
                                {topico.qconcursosFiltro?.assuntoNome || `QC ID ${topico.qconcursosFiltro?.assuntoId}`}
                              </Badge>
                            </button>
                          ) : (
                            <button
                              onClick={() => setModalTopic({ disciplinaId: disc.id, topic: topico })}
                              className="cursor-pointer"
                              title="Clique para mapear ou ver sugestões"
                            >
                              <Badge variant="warning" className="cursor-pointer hover:border-accent-warning">
                                {topico.sugestoesQC && topico.sugestoesQC.length > 0
                                  ? `Sugestões (${topico.sugestoesQC.length})`
                                  : 'Não mapeado'}
                              </Badge>
                            </button>
                          )}
                        </div>

                        {/* Botão "Resolver questões" com 3 estados */}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleResolverQuestoes(disc.id, topico)}
                          title={
                            isMapped
                              ? `Abrir questões no QConcursos (${topico.qconcursosFiltro?.assuntoNome || topico.qconcursosFiltro?.disciplinaNome})`
                              : topico.sugestoesQC && topico.sugestoesQC.length > 0
                              ? `Tópico com ${topico.sugestoesQC.length} sugestão(ões) detectada(s) — clique para escolher com 1 clique`
                              : 'Mapear tópico para resolver questões'
                          }
                          icon={
                            isMapped ? (
                              <ExternalLink className="w-3.5 h-3.5 text-accent-success" />
                            ) : (
                              <Search className="w-3.5 h-3.5 text-accent-warning" />
                            )
                          }
                        >
                          Resolver questões
                        </Button>

                        {/* Botão Excluir Tópico */}
                        <button
                          onClick={() => handleDeleteTopic(disc.id, topico.id)}
                          className="text-text-secondary hover:text-accent-critical p-1 rounded hover:bg-surface-elevated transition-colors"
                          title="Remover tópico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        {/* Rodapé com Ação Principal */}
        <div className="flex items-center justify-between pt-4 pb-8 border-t border-surface-border">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setFase('formulario')}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Voltar ao Formulário
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirmarEdital}
            icon={<Check className="w-5 h-5" />}
          >
            Confirmar edital
          </Button>
        </div>

        {/* Modal de Mapeamento Manual do QConcursos */}
        {modalTopic && (
          <ModalQConcursosSelector
            isOpen={true}
            onClose={() => setModalTopic(null)}
            taxonomiaRecorte={taxonomiaRecorte}
            topicoNome={modalTopic.topic.nome}
            currentFiltro={modalTopic.topic.qconcursosFiltro}
            sugestoes={modalTopic.topic.sugestoesQC}
            onSelect={handleUpdateTopicFiltro}
          />
        )}
      </div>
    );
  }

  // RENDERIZAÇÃO: FORMULÁRIO DE ENTRADA
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero / Header da Tela */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success">IMPORTAÇÃO INTELIGENTE</Badge>
              <span className="text-caption font-mono text-text-secondary">
                Etapa 1: Estruturação
              </span>
            </div>
            <h1 className="text-h1 text-text-primary tracking-tight mb-2">
              Importar Edital
            </h1>
            <p className="text-body text-text-secondary max-w-xl leading-relaxed">
              Cole o conteúdo programático bruto do PDF. O AP90 estruturará a hierarquia de disciplinas e tópicos com IA e mapeará automaticamente para as questões do QConcursos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfigAI(!showConfigAI)}
              icon={<Key className="w-3.5 h-3.5" />}
            >
              Configurar IA
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCarregarExemplo}
              icon={<FileText className="w-3.5 h-3.5" />}
            >
              Carregar Exemplo (PC-AL)
            </Button>
          </div>
        </div>

        {/* Painel Expansível de Chave de IA */}
        {showConfigAI && (
          <div className="mt-6 pt-5 border-t border-surface-border-elevated bg-surface p-4 rounded-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-h2 text-text-primary">Configurar Conexão com IA</h3>
                <p className="text-caption text-text-secondary">
                  Salva com segurança apenas no seu navegador (localStorage).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearAI}
                  className="text-accent-critical hover:text-accent-critical border-accent-critical/30 hover:border-accent-critical"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Limpar Chave (Modo Local)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-caption font-mono text-text-secondary mb-1">
                  Provedor
                </label>
                <select
                  value={aiProvider}
                  onChange={e => setAiProvider(e.target.value as AIProvider)}
                  className="w-full bg-surface-card border border-surface-border rounded-lg p-2 text-body text-text-primary focus:border-accent-success focus:outline-none"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                </select>
              </div>

              <div>
                <label className="block text-caption font-mono text-text-secondary mb-1">
                  Modelo Selecionado
                </label>
                <select
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="w-full bg-surface-card border border-surface-border rounded-lg p-2 text-body text-text-primary focus:border-accent-success focus:outline-none"
                >
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Padrão)</option>
                  <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B (Menor sobrecarga / Mais estável)</option>
                  <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash Lite</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-caption font-mono text-text-secondary mb-1">
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiKey}
                    onChange={e => setAiKey(e.target.value)}
                    placeholder="Cole sua chave aqui..."
                    className="flex-1 bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-body text-text-primary focus:border-accent-success focus:outline-none font-mono text-caption"
                  />
                  <Button variant="primary" size="sm" onClick={handleSaveAISettings}>
                    Salvar
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-border">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isTestingAI || !aiKey.trim()}
                  onClick={handleTestAI}
                  icon={isTestingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                >
                  {isTestingAI ? 'Testando conexão...' : 'Testar Conexão com IA'}
                </Button>
              </div>

              <div className="text-caption text-text-muted">
                💡 <span className="text-text-secondary">Dica:</span> Se a API do Google estiver instável (503), o AP90 estrutura o edital automaticamente via algoritmo local sem falhas.
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-caption flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-accent-success/10 border border-accent-success/30 text-accent-success'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <strong>{testResult.success ? 'Conexão Bem-Sucedida:' : 'Aviso de Conexão:'}</strong>{' '}
                  {testResult.message}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Formulário de Metadados Básicos */}
      <Card variant="default" padding="md">
        <h2 className="text-h2 text-text-primary mb-4">
          Identificação do Concurso
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Concurso / Órgão</span>
            </label>
            <input
              type="text"
              value={concurso}
              onChange={e => setConcurso(e.target.value)}
              placeholder="Ex: TJ-SP, PF, Bacen"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-body text-text-primary focus:border-accent-success focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Cargo</span>
            </label>
            <input
              type="text"
              value={cargo}
              onChange={e => setCargo(e.target.value)}
              placeholder="Ex: Escrevente, Agente"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-body text-text-primary focus:border-accent-success focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
              Banca Examinadora
            </label>
            <input
              type="text"
              value={banca}
              onChange={e => setBanca(e.target.value)}
              placeholder="Ex: Vunesp, Cebraspe, FGV"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-body text-text-primary focus:border-accent-success focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Data da Prova</span>
            </label>
            <input
              type="date"
              value={dataProva}
              onChange={e => setDataProva(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-body text-text-primary focus:border-accent-success focus:outline-none transition-colors"
            />
          </div>
        </div>
      </Card>

      {/* Conteúdo Programático (Textarea Grande) */}
      <Card variant="default" padding="md">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary">
            Conteúdo Programático (Texto Bruto do PDF)
          </label>
          <span className="text-caption font-mono text-text-secondary">
            {conteudoBruto.length} caracteres
          </span>
        </div>

        <textarea
          rows={14}
          value={conteudoBruto}
          onChange={e => setConteudoBruto(e.target.value)}
          placeholder="Cole aqui o texto copiado diretamente do PDF do edital..."
          className="w-full bg-surface border border-surface-border rounded-lg p-4 font-mono text-caption text-text-primary leading-relaxed placeholder:text-text-secondary/50 focus:border-accent-success focus:outline-none transition-colors"
        />

        {/* CTA Principal da Tela: Apenas este botão tem variant="primary" */}
        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={handleEstruturarEdital}
            icon={<Sparkles className="w-5 h-5" />}
          >
            Estruturar edital
          </Button>
        </div>
      </Card>
    </div>
  );
};
