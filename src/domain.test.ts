import { describe, expect, it } from 'vitest';
import { calcularNota, normalizarBusca, validarCatalogo, intercalarModalidades, type Projeto } from './domain';

describe('regras de avaliação', () => {
  it('calcula a nota ponderada do exemplo oficial', () => {
    expect(calcularNota([4, 5, 4, 3])).toBeCloseTo(4.15);
  });
  it('rejeita notas ausentes, decimais e fora da escala', () => {
    expect(() => calcularNota([4, 5, 4])).toThrow();
    expect(() => calcularNota([4, 5.5, 4, 3])).toThrow();
    expect(() => calcularNota([4, 5, 4, 6])).toThrow();
  });
  it('normaliza acentos para busca', () => {
    expect(normalizarBusca('Inovação')).toBe(normalizarBusca('inovacao'));
  });
  it('rejeita IDs duplicados', () => {
    expect(() => validarCatalogo([{id:'NAC-001'},{id:'NAC-001'}])).toThrow();
  });
});
describe('catálogo intercalado',()=>{
  const p=(id:string,modalidade:Projeto['modalidade'])=>({id,modalidade} as Projeto);
  const e1=p('EXT-001','Mostra de Extensão'),e2=p('EXT-002','Mostra de Extensão');
  const n1=p('NAC-001','Mostra Nacional'),n2=p('NAC-002','Mostra Nacional'),n3=p('NAC-003','Mostra Nacional');
  it('alterna extensão e nacional e preserva o excedente',()=>{
    const original=[e1,e2,n1,n2,n3];
    expect(intercalarModalidades(original)).toEqual([e1,n1,e2,n2,n3]);
    expect(original).toEqual([e1,e2,n1,n2,n3]);
  });
  it('preserva listas de uma modalidade e listas vazias',()=>{
    expect(intercalarModalidades([n1,n2])).toEqual([n1,n2]);
    expect(intercalarModalidades([e1,e2])).toEqual([e1,e2]);
    expect(intercalarModalidades([])).toEqual([]);
  });
});
