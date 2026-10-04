import { describe, expect, it } from 'vitest';
import validator from '../src/schemaValidator';

describe('Interpretowana walidacja formularzy przy CSP bez unsafe-eval', () => {
  const schema: any = { type: 'object', required: ['plan', 'consent'], properties: { plan: { type: 'string', minLength: 5 }, consent: { const: true }, participants: { type: 'integer', minimum: 1 } }, additionalProperties: false };
  it('przyjmuje kompletny wniosek i wskazuje dokładne błędne pola', () => {
    expect(validator.validateFormData({ plan: 'Cztery spotkania', consent: true, participants: 12 }, schema).errors).toEqual([]);
    const invalid = validator.validateFormData({ plan: 'x', consent: false, participants: 0 }, schema);
    expect(invalid.errorSchema.plan?.__errors).toHaveLength(1);
    expect(invalid.errorSchema.consent?.__errors).toHaveLength(1);
    expect(invalid.errorSchema.participants?.__errors).toHaveLength(1);
    expect(validator.validateFormData({}, schema).errorSchema.plan?.__errors).toHaveLength(1);
    expect(validator.validateFormData({ plan: 'Dobry plan', consent: true, unknown: 1 }, schema).errorSchema.unknown?.__errors).toHaveLength(1);
  });
  it('rozwiązuje referencje oraz warunkowe i zagnieżdżone schematy', () => {
    const root: any = { $defs: { amount: { type: 'number', minimum: 10 } }, type: 'object', properties: { budget: { $ref: '#/$defs/amount' } } };
    expect(validator.isValid(root.properties.budget, 20, root)).toBe(true);
    expect(validator.isValid(root.properties.budget, 5, root)).toBe(false);
    const conditional: any = { type: 'object', properties: { group: { enum: ['small', 'large'] }, count: { type: 'integer' } }, if: { properties: { group: { const: 'large' } } }, then: { properties: { count: { minimum: 5 } } } };
    expect(validator.validateFormData({ group: 'large', count: 2 }, conditional).errors.length).toBeGreaterThan(0);
    expect(validator.validateFormData({ group: 'large', count: 8 }, conditional).errors).toEqual([]);
  });
});
