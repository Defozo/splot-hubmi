import {describe, expect, it} from 'vitest';
import {ASSISTANT_FIELDS, containsFinancialClaim, validateAssistantSuggestions} from '../domain/assistant';

describe('Kontrakt edytowalnych propozycji i niewiadome koszty', () => {
  it('rejects translated fields, wrong mode fields, duplicates and unknown sources', () => {
    const result = validateAssistantSuggestions('middleman', [
      {field:'goal',text:'Rozwijanie regularnego kontaktu.',sourceIds:['source']},
      {field:'cel',text:'Błędny kontrakt',sourceIds:[]},
      {field:'activities',text:'Pole Canwy, nie Karty',sourceIds:[]},
      {field:'goal',text:'Nadpisanie celu',sourceIds:[]},
      {field:'risks',text:'Obce źródło',sourceIds:['invented']},
    ], ['source']);
    expect(result.suggestions).toEqual([{field:'goal',text:'Rozwijanie regularnego kontaktu.',sourceIds:['source'],basis:'ai_proposal'}]);
    expect(result.discarded).toBe(4);
  });
  it.each(['30\u202fPLN/h × 2 h', '5 PLN/osoba', 'Koszt 30 za godzinę', 'stawka trzydzieści za godzinę', 'Udział jest bezpłatny', '50 zł', '$10', 'zero kosztów'])('rejects unsupported monetary claim: %s', text => {
    expect(containsFinancialClaim(text)).toBe(true);
    expect(validateAssistantSuggestions('middleman', [{field:'adaptations',text,sourceIds:[]}], []).suggestions).toEqual([]);
  });
  it('preserves uncertainty and nonfinancial suggested measurements', () => {
    expect(containsFinancialClaim('Koszty materiałów i organizacji są nieznane. Uzyskaj wyceny.')).toBe(false);
    const result=validateAssistantSuggestions('idea', [{field:'costs',text:'Koszty materiałów są nieznane. Potrzebujemy wycen.',sourceIds:[]},{field:'impact',text:'Zbierz opinię uczestnika przed testem i po 4 spotkaniach.',sourceIds:[]}], []);
    expect(result.suggestions).toHaveLength(2);
  });
  it('has one explicit destination for invitation and pilot summaries', () => {
    expect(ASSISTANT_FIELDS.invitation).toEqual(['scope']);
    expect(ASSISTANT_FIELDS.pilot).toEqual(['summary']);
  });
});
