import { Topico, DisponibilidadeSemanal, ItemCronograma } from '../types';

export const DIA_SEMANA_MAP: Record<number, keyof DisponibilidadeSemanal> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
};

export function formatarDataISO(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Distribui os tópicos restantes do edital ao longo dos dias do mês/período.
 * Ordena do maior peso pro menor, respeitando a quantidade de horas de cada dia
 * e o tempo médio por tópico.
 */
export function distribuirTopicosNoCalendario(
  topicos: Topico[],
  disponibilidade: DisponibilidadeSemanal,
  tempoMedioMinutos: number,
  dataInicio: Date = new Date(),
  maxDias: number = 90
): ItemCronograma[] {
  // 1. Filtrar tópicos restantes (não concluídos)
  const topicosRestantes = topicos.filter((t) => !t.concluido);
  if (topicosRestantes.length === 0) return [];

  // 2. Ordenar estritamente por peso decrescente (maior peso pro menor)
  // Sem IA, sem heurística de aproveitamento ou atraso
  const filaTopicos = [...topicosRestantes].sort((a, b) => {
    if (b.peso !== a.peso) {
      return b.peso - a.peso;
    }
    return 0;
  });

  const somaHorasSemanais = Object.values(disponibilidade).reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
  if (somaHorasSemanais <= 0) return [];

  const duracaoTopico = Math.max(5, tempoMedioMinutos || 45);
  const itensCronograma: ItemCronograma[] = [];

  const dataAtual = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
  let diasProcessados = 0;

  while (filaTopicos.length > 0 && diasProcessados < maxDias) {
    const diaSemanaNum = dataAtual.getDay();
    const chaveDia = DIA_SEMANA_MAP[diaSemanaNum];
    const horasDisponiveis = Number(disponibilidade[chaveDia]) || 0;

    if (horasDisponiveis > 0) {
      const capacidadeTopicos = Math.floor((horasDisponiveis * 60) / duracaoTopico);
      const dataISO = formatarDataISO(dataAtual);

      let ordem = 1;
      for (let i = 0; i < capacidadeTopicos && filaTopicos.length > 0; i++) {
        const proximoTopico = filaTopicos.shift()!;
        itensCronograma.push({
          id: `cron_${proximoTopico.id}_${dataISO}_${Math.random().toString(36).slice(2, 6)}`,
          topicoId: proximoTopico.id,
          disciplinaId: proximoTopico.disciplinaId,
          data: dataISO,
          ordem: ordem++,
        });
      }
    }

    dataAtual.setDate(dataAtual.getDate() + 1);
    diasProcessados++;
  }

  return itensCronograma;
}

/**
 * Executa o rollover automático: se um tópico agendado para um dia (< hoje)
 * não foi marcado como concluído, é automaticamente reagendado para o próximo
 * dia em que a mesma disciplina aparece no calendário (empurrar, sem duplicar).
 */
/**
 * Retorna a capacidade máxima de tópicos suportada em uma data específica
 * com base na disponibilidade do dia da semana e no tempo médio por tópico.
 */
export function obterCapacidadeData(
  dataStr: string,
  disponibilidade: DisponibilidadeSemanal,
  tempoMedioMinutos: number
): number {
  const [y, m, d] = dataStr.split('-').map(Number);
  const dataObj = new Date(y, m - 1, d);
  const diaSemanaNum = dataObj.getDay();
  const chaveDia = DIA_SEMANA_MAP[diaSemanaNum];
  const horas = Number(disponibilidade[chaveDia]) || 0;
  if (horas <= 0) return 0;
  const duracao = Math.max(5, tempoMedioMinutos || 45);
  return Math.floor((horas * 60) / duracao);
}

/**
 * Executa o rollover automático com respeito estrito à capacidade diária em horas:
 * Se um tópico agendado para um dia (< hoje) não foi concluído:
 * 1. Procura o próximo dia em que a mesma disciplina aparece no calendário E que ainda tenha capacidade sobrando.
 * 2. Se aquele dia já estiver cheio, continua procurando o próximo dia da disciplina com capacidade sobrando.
 * 3. Se nenhum dia da disciplina tiver vaga, aloca no próximo dia futuro com capacidade sobrando (final da fila).
 * Nenhum dia do calendário terá mais tópicos do que sua capacidade em horas permite.
 */
export function executarRolloverAtrasados(
  cronogramaAtual: ItemCronograma[],
  topicos: Topico[],
  disponibilidade: DisponibilidadeSemanal,
  tempoMedioMinutos: number = 45,
  dataReferencia: Date = new Date()
): { novoCronograma: ItemCronograma[]; alteradosCount: number } {
  const hojeStr = formatarDataISO(dataReferencia);
  const topicosMap = new Map<string, Topico>();
  topicos.forEach((t) => topicosMap.set(t.id, t));

  // 1. Separar itens válidos dos atrasados
  const itensValidos: ItemCronograma[] = [];
  const itensAtrasados: ItemCronograma[] = [];

  for (const item of cronogramaAtual) {
    const topico = topicosMap.get(item.topicoId);
    if (item.data < hojeStr && topico && !topico.concluido) {
      itensAtrasados.push(item);
    } else {
      itensValidos.push(item);
    }
  }

  if (itensAtrasados.length === 0) {
    return { novoCronograma: cronogramaAtual, alteradosCount: 0 };
  }

  let alteradosCount = 0;

  // 2. Processar cada item atrasado garantindo respeito à capacidade
  for (const itemAtrasado of itensAtrasados) {
    const discId = itemAtrasado.disciplinaId;

    // Próximas datas distintas (>= hoje) em que a mesma disciplina já aparece no calendário
    const datasFuturasMesmaDisciplina = Array.from(
      new Set(
        itensValidos
          .filter((it) => it.data >= hojeStr && it.disciplinaId === discId && it.topicoId !== itemAtrasado.topicoId)
          .map((it) => it.data)
      )
    ).sort();

    let dataDestino: string | null = null;

    // A) Procurar o próximo dia em que a mesma disciplina aparece E que ainda tem capacidade sobrando
    for (const dataCandidata of datasFuturasMesmaDisciplina) {
      const capMax = obterCapacidadeData(dataCandidata, disponibilidade, tempoMedioMinutos);
      const ocupados = itensValidos.filter((it) => it.data === dataCandidata).length;

      if (ocupados < capMax) {
        dataDestino = dataCandidata;
        break; // Encontrou o primeiro dia da mesma disciplina com vaga!
      }
    }

    // B) Se todos os dias futuros da disciplina estiverem com capacidade cheia:
    // Procurar o primeiro dia futuro a partir de hoje que ainda tenha capacidade sobrando
    if (!dataDestino) {
      const cursor = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), dataReferencia.getDate());
      for (let i = 0; i < 60; i++) {
        const dataCandidata = formatarDataISO(cursor);
        const capMax = obterCapacidadeData(dataCandidata, disponibilidade, tempoMedioMinutos);
        const ocupados = itensValidos.filter((it) => it.data === dataCandidata).length;

        if (capMax > 0 && ocupados < capMax) {
          dataDestino = dataCandidata;
          break;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Se encontrou uma data com vaga disponível, insere no cronograma sem estourar o dia
    if (dataDestino) {
      const itensNoDestino = itensValidos.filter((it) => it.data === dataDestino);
      const maxOrdem = itensNoDestino.reduce((max, it) => Math.max(max, it.ordem || 0), 0);

      itensValidos.push({
        ...itemAtrasado,
        data: dataDestino,
        ordem: maxOrdem + 1,
      });

      alteradosCount++;
    }
  }

  // 3. Ordenar cronograma final por data e ordem
  itensValidos.sort((a, b) => {
    if (a.data !== b.data) {
      return a.data.localeCompare(b.data);
    }
    return (a.ordem || 0) - (b.ordem || 0);
  });

  return { novoCronograma: itensValidos, alteradosCount };
}
