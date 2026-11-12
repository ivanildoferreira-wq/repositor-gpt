import { describe, expect, it } from 'vitest';
import { calcularNota, normalizarBusca, validarCatalogo } from './domain';

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