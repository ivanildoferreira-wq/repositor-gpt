export type Modalidade = 'Mostra Nacional' | 'Mostra de Extensão';
export type Projeto = {
  id: string; titulo: string; modalidade: Modalidade; area_tematica: string;
  data: string; inicio: string; fim: string; formato: string; local: string;
  fontes: string[];
};
export const PESOS = [0.30, 0.30, 0.25, 0.15] as const;
export const CRITERIOS = [
  'Criatividade e inovação',
  'Clareza da apresentação',
  'Relevância e impacto',
  'Demonstração e resultados',
] as const;
export function calcularNota(notas: number[]): number {
  if (notas.length !== 4 || notas.some(n => !Number.isInteger(n) || n < 1 || n > 5))
    throw new Error('Informe quatro notas inteiras entre 1 e 5.');
  return notas.reduce((total, nota, i) => total + nota * PESOS[i], 0);
}
export function normalizarBusca(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
export function validarCatalogo(data: unknown): Projeto[] {
  if (!Array.isArray(data)) throw new Error('O catálogo precisa ser uma lista.');
  const projects = data as Projeto[];
  const ids = new Set(projects.map(p => p.id));
  if (ids.size !== projects.length) throw new Error('Há IDs duplicados no catálogo.');
  return projects;
}

/** Alterna as modalidades sem alterar a ordem original dentro de cada grupo. */
export function intercalarModalidades(projetos: Projeto[]): Projeto[] {
  const extensao=projetos.filter(p=>p.modalidade==='Mostra de Extensão');
  const nacional=projetos.filter(p=>p.modalidade==='Mostra Nacional');
  const outros=projetos.filter(p=>p.modalidade!=='Mostra de Extensão'&&p.modalidade!=='Mostra Nacional');
  const resultado:Projeto[]=[];
  for(let i=0;i<Math.max(extensao.length,nacional.length);i++){
    if(extensao[i])resultado.push(extensao[i]);
    if(nacional[i])resultado.push(nacional[i]);
  }
  return resultado.concat(outros);
}

/** Ordenação educativa: média, quantidade de avaliações e código como último critério de exibição. */
export function ordenarRanking<T extends {id:string;media:number;avaliacoes:number}>(itens:T[]) {
  const ordenados=[...itens].sort((a,b)=>b.media-a.media||b.avaliacoes-a.avaliacoes||a.id.localeCompare(b.id));
  return ordenados.map((item,i)=>({...item,posicao:i+1,empate:ordenados.some(outro=>outro.id!==item.id&&outro.media===item.media&&outro.avaliacoes===item.avaliacoes)}));
}
