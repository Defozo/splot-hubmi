/** Field IDs are a shared contract with the editable forms, never translated by a model. */
export const ASSISTANT_PROMPT_VERSION = 'editable-grounded-v2';
export const ASSISTANT_FIELDS = {
  idea: ['problem', 'audience', 'context', 'trials', 'beneficiaries', 'value', 'activities', 'partners', 'resources', 'costs', 'impact'],
  middleman: ['goal', 'audience', 'mechanism', 'adaptations', 'risks', 'accessibility', 'metrics', 'timeline'],
  invitation: ['scope'],
  pilot: ['summary'],
} as const;
export type AssistantKind = keyof typeof ASSISTANT_FIELDS;

/**
 * Amounts belong in the deterministic budget editor. A narrative model is never
 * allowed to introduce prices, even as examples or as supposed free services.
 * This intentionally rejects some otherwise useful financial prose; it cannot
 * silently turn an unknown price into a usable budget assumption.
 */
export function containsFinancialClaim(text: string): boolean {
  const normalized = text.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  if (/(?:\b(?:pln|eur|usd|zl|zlot\w*|grosz\w*|euro|dolar\w*)\b|[$€]|bezplatn|darmow|nieodplatn)/u.test(normalized)) return true;
  const financial = /koszt|budzet|stawk|wynagrodz|oplat|wycen|cennik|finansow|dotac|grant|wydatk|\bcen[ayie]/u.test(normalized);
  const numberedValue = /\d|\b(?:zero|jeden|jedna|jedno|dwa|dwie|trzy|cztery|piec|szesc|siedem|osiem|dziewiec|dziesiec|dwadziescia|trzydziesci|czterdziesci|piecdziesiat|sto|stowka|tysiac|milion)\b/u.test(normalized);
  return financial && numberedValue;
}

export function validateAssistantSuggestions(kind: AssistantKind, raw: unknown, allowedSources: string[]) {
  if (!Array.isArray(raw)) throw new Error('Niepoprawny format propozycji.');
  const suggestions: {field: string; text: string; sourceIds: string[]; basis: 'ai_proposal'}[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const item of raw) {
    if (!item || !(ASSISTANT_FIELDS[kind] as readonly string[]).includes(item.field) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 5000 || !Array.isArray(item.sourceIds) || !item.sourceIds.every((id: unknown) => typeof id === 'string' && allowedSources.includes(id)) || seen.has(item.field) || containsFinancialClaim(item.field === 'costs' ? `Koszty: ${item.text}` : item.text)) {
      discarded++;
      continue;
    }
    seen.add(item.field);
    suggestions.push({field: item.field, text: item.text, sourceIds: item.sourceIds, basis: 'ai_proposal'});
  }
  return {suggestions, discarded};
}
