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