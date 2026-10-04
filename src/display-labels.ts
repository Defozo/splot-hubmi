const states: Record<string, string> = {
  awaiting_author: 'Czeka na potwierdzenie autora', draft: 'Szkic', review: 'Do weryfikacji',
  expert_review: 'Weryfikacja eksperta', submitted: 'Przekazano do ROPS', accepted: 'Przyjęto',
  approved: 'Zatwierdzono', indexing: 'Przygotowywanie publikacji', published: 'Opublikowano',
  superseded: 'Zastąpiono nowszą wersją', withdrawn: 'Wycofano', rejected: 'Odrzucono',
  recruiting: 'Trwają zapisy', running: 'W trakcie testu', completed: 'Zakończono',
  reviewed: 'Wnioski zatwierdzone', proposed: 'Propozycja', open: 'Otwarty', closed: 'Zamknięty',
  pending: 'Oczekuje', invited: 'Zaproszenie', active: 'Aktywne', inactive: 'Nieaktywne',
  resolved: 'Rozwiązano', review_required: 'Wymaga przeglądu', blocked: 'Wstrzymano',
  changes_requested: 'Prośba o uzupełnienie', cancelled: 'Anulowano', conflict: 'Wymaga ponownego uzgodnienia',
  expired: 'Wygasło', scheduled: 'Zaplanowano', failed: 'Nie powiodło się', processing: 'Przetwarzanie',
};
export function stateLabel(value: string): string { return states[value] || 'Status do sprawdzenia'; }
export function stateTone(value: string): string {
  if (['approved', 'published', 'accepted', 'running', 'active', 'reviewed'].includes(value)) return 'good';
  return ['rejected', 'withdrawn', 'blocked', 'failed', 'conflict', 'expired'].includes(value) ? 'danger' : '';
}
export function knowledgeKindLabel(value: string): string {
  const labels: Record<string, string> = { innovation: 'Innowacja', case: 'Doświadczenie pilotażu', report: 'Raport', video: 'Film', course: 'Materiał edukacyjny', education: 'Materiał edukacyjny', map: 'Wskaźniki do mapy' };
  return labels[value] || 'Materiał wiedzy';
}
export function jobKindLabel(value: string): string {
  return ({ knowledge_import: 'Import wiedzy', knowledge_index: 'Przygotowanie wyszukiwania', privacy_erasure: 'Usuwanie prywatnych danych' } as Record<string, string>)[value] || 'Zadanie systemowe';
}
export function jobStateLabel(value: string): string { return value === 'running' ? 'W trakcie wykonywania' : stateLabel(value); }
export function integrationStateLabel(value?: string): string {
  if (!value) return 'Pozostaje w HubMI';
  return ({ accepted_in_hubmi: 'Przyjęto w HubMI', transferred_to_simulator: 'Przekazano do symulatora', confirmed_by_simulator: 'Potwierdzone przez symulator' } as Record<string, string>)[value] || 'Stan przekazania wymaga sprawdzenia';
}

// Historical system events contain "record title: status". Translate only the
// known final state in that template, preserving the original stored event.
export function notificationBody(notice: { title: string; body: string }): string {
  if (notice.title !== 'Zmiana statusu sprawy') return notice.body;
  return notice.body.replace(/: ([a-z_]+)$/, (original, state: string) => states[state] ? `: ${states[state]}` : original);
}

// These are audit operations, not the resulting status. A single approval does
// not mean the whole card is approved, and publication first starts indexing.
const auditEvents: Record<string, string> = {
  create: 'Utworzenie sprawy', edit: 'Zapisanie zmian', assign: 'Przypisanie opiekuna',
  watch: 'Włączenie obserwowania', unwatch: 'Wyłączenie obserwowania', quiet: 'Zmiana wyciszenia powiadomień',
  classify: 'Klasyfikacja potrzeby', submit: 'Przekazanie do oceny', accept: 'Przyjęcie', reject: 'Odrzucenie',
  request_changes: 'Prośba o uzupełnienie', export_simulator: 'Przekazanie wniosku do symulatora',
  confirm_simulator: 'Potwierdzenie w symulatorze', open: 'Otwarcie naboru', close: 'Zamknięcie naboru',
  archive: 'Archiwizacja naboru', review_sources: 'Świadomy przegląd źródeł Karty',
  request_review: 'Przekazanie Karty do weryfikacji', verify: 'Weryfikacja Karty przez eksperta',
  approve: 'Zapisanie akceptacji', withdraw: 'Wycofanie', approve_shared: 'Zatwierdzenie wspólnego etapu',
  cancel: 'Anulowanie współpracy', renew: 'Ponowienie uzgodnienia', recruit: 'Otwarcie zapisów do pilotażu',
  start: 'Rozpoczęcie pilotażu', resume: 'Wznowienie pilotażu', complete: 'Zakończenie pilotażu',
  review: 'Przegląd wyników pilotażu', publish_experience: 'Przekazanie doświadczenia do redakcji wiedzy',
  resolve: 'Zamknięcie rozmowy', resource_conflict: 'Oznaczenie konfliktu zasobu',
  assisted_submission_created: 'Zapisanie potrzeby przez pomocnika',
  assisted_submission_confirmed: 'Potwierdzenie potrzeby przez autora',
  application_submitted: 'Złożenie wniosku grantowego', attachment_scan: 'Kontrola załącznika',
  attachment_delete: 'Usunięcie załącznika', source_import: 'Dodanie źródła',
  source_withdraw: 'Wycofanie źródła', source_restore: 'Przywrócenie źródła po przeglądzie',
  knowledge_edit: 'Zapisanie szkicu materiału wiedzy', knowledge_review: 'Przekazanie materiału do weryfikacji',
  knowledge_publish: 'Rozpoczęcie publikacji materiału', knowledge_retry_index: 'Ponowienie przygotowania publikacji',
  knowledge_restore: 'Rozpoczęcie przywracania materiału', knowledge_withdraw: 'Wycofanie materiału wiedzy',
  knowledge_publication_indexed: 'Zakończenie publikacji materiału', knowledge_import: 'Import materiałów wiedzy',
  privacy_erasure_requested: 'Zlecenie usunięcia prywatnych danych',
  privacy_erasure_completed: 'Zakończenie usuwania prywatnych danych',
};
export function auditEventLabel(action: string): string { return Object.hasOwn(auditEvents, action) ? auditEvents[action] : 'Inna operacja systemowa'; }

export type AuditDisplayEvent = { action: string; entityId?: string; entityType?: string; details?: unknown; metadata?: unknown };
const auditObjects: Record<string, string> = {
  need: 'Potrzeba', idea: 'Fiszka pomysłu', card: 'Karta wdrożenia', offer: 'Oferta zasobu',
  partnership: 'Uzgodnienie współpracy', pilot: 'Pilotaż', enrollment: 'Zgłoszenie do pilotażu',
  feedback: 'Opinia uczestnika', thread: 'Rozmowa', message: 'Wiadomość', call: 'Nabór',
  application: 'Wniosek grantowy', call_watch: 'Obserwowanie naboru', knowledge: 'Materiał wiedzy',
  source: 'Źródło', file: 'Załącznik', privacy_erasure: 'Zadanie usunięcia prywatnych danych',
};
function eventData(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function auditObjectLabel(event: AuditDisplayEvent): string {
  const details = eventData(event.details), metadata = eventData(event.metadata);
  const explicitType = [event.entityType, details.kind, details.entityType, metadata.kind, metadata.entityType]
    .find(value => typeof value === 'string' && Object.hasOwn(auditObjects, value));
  let label = typeof explicitType === 'string' ? auditObjects[explicitType] : undefined;
  // Infer only object types that are unambiguous in the recorded backend event.
  // attachment_delete points at its parent record, not at the deleted file.
  if (!label) {
    if (['source_import', 'source_withdraw', 'source_restore'].includes(event.action)) label = auditObjects.source;
    else if (event.action === 'knowledge_import') label = 'Import materiałów wiedzy';
    else if (['knowledge_edit', 'knowledge_review', 'knowledge_publish', 'knowledge_retry_index', 'knowledge_restore', 'knowledge_withdraw', 'knowledge_publication_indexed'].includes(event.action)) label = auditObjects.knowledge;
    else if (['assisted_submission_created', 'assisted_submission_confirmed', 'classify'].includes(event.action)) label = auditObjects.need;
    else if (['privacy_erasure_requested', 'privacy_erasure_completed'].includes(event.action)) label = auditObjects.privacy_erasure;
    else if (['application_submitted', 'export_simulator', 'confirm_simulator'].includes(event.action)) label = auditObjects.application;
    else if (['review_sources', 'request_review', 'verify', 'resource_conflict'].includes(event.action)) label = auditObjects.card;
    else if (['recruit', 'start', 'resume', 'complete', 'review', 'publish_experience'].includes(event.action)) label = auditObjects.pilot;
    else if (['approve_shared', 'cancel', 'renew'].includes(event.action)) label = auditObjects.partnership;
    else if (['open', 'close', 'archive'].includes(event.action)) label = auditObjects.call;
    else if (event.action === 'resolve') label = auditObjects.thread;
    else if (event.action === 'attachment_scan') label = auditObjects.file;
    else if (event.action === 'attachment_delete') label = 'Sprawa z usuniętym załącznikiem';
    else label = Object.hasOwn(auditEvents, event.action) ? 'Sprawa w obiegu' : 'Obiekt zdarzenia';
  }
  const version = details.version ?? metadata.version;
  return typeof version === 'number' && Number.isSafeInteger(version) && version > 0 ? `${label} · wersja ${version}` : label;
}

export type ReadableDemoTitle = { title: string; original?: string; context?: string };
// Exact templates from tests/e2e/hub.spec.ts and check-source-review-browser.mjs.
// Do not strip arbitrary numbers, dates, whitespace, or user-provided prefixes.
const demoTimestampTitle = /^(Konsultacja testowa|Spotkania sąsiedzkie E2E|Sala testowa|(?:(?:Doświadczenie: )?Pilotaż: )?Karta wspólnego spotkania|Kontrola daty źródła|Izolowana kontrola źródeł|Potrzeba testu źródeł|Karta testu źródeł) ([1-9]\d{12})$/;
const demoIsoTitle = /^(Test obserwowania|Pomiar techniczny komunikacji) (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)(?: ([1-9]|1\d|20))?$/;
const demoDate = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: 'Europe/Warsaw', hourCycle: 'h23',
});
export function readableDemoTitle(title: string): ReadableDemoTitle {
  const timestamp = title.match(demoTimestampTitle), iso = title.match(demoIsoTitle);
  if (!timestamp && !iso) return { title };
  if ((timestamp && timestamp[0] !== title) || (iso && iso[0] !== title)) return { title };
  if (iso && ((iso[1] === 'Test obserwowania' && iso[3]) || (iso[1] === 'Pomiar techniczny komunikacji' && !iso[3]))) return { title };
  const time = timestamp ? Number(timestamp[2]) : Date.parse(iso![2]);
  if (!Number.isFinite(time) || (iso && new Date(time).toISOString() !== iso[2])) return { title };
  const base = timestamp?.[1] || iso![1], sequence = iso?.[3] ? ` · operacja ${iso[3]}` : '';
  return {
    title: `${base} · próba ${demoDate.format(time)}${sequence}`,
    original: title,
    context: 'Powtarzalna próba techniczna aplikacji. Data oznacza czas w Polsce; pełny tytuł zachowano w szczegółach.',
  };
}

type Unit = { name: string; one: string; few: string; many: string };
const person: Unit = { name: 'osoba udostępniająca kompetencje lub czas', one: 'osoba', few: 'osoby', many: 'osób' };
const generic: Unit = { name: 'jednostka zasobu', one: 'jednostka zasobu', few: 'jednostki zasobu', many: 'jednostek zasobu' };
function reservationUnit(resourceKey?: string): Unit {
  if (resourceKey === 'accessibleRoom') return { name: 'sala', one: 'sala', few: 'sale', many: 'sal' };
  if (resourceKey === 'devices') return { name: 'urządzenie', one: 'urządzenie', few: 'urządzenia', many: 'urządzeń' };
  if (resourceKey === 'accessibleVehicle') return { name: 'pojazd', one: 'pojazd', few: 'pojazdy', many: 'pojazdów' };
  if (['coordinator', 'volunteers', 'digitalTrainer', 'psychologist', 'accessibilityExpert'].includes(resourceKey || '')) return person;
  return generic;
}
export function reservationUnitLabel(resourceKey?: string): string { return reservationUnit(resourceKey).name; }
export function reservationQuantity(quantity: number | undefined, resourceKey?: string): string {
  if (!Number.isInteger(quantity) || (quantity ?? 0) < 1) return 'Nie określono liczby jednostek';
  const unit = reservationUnit(resourceKey), plural = new Intl.PluralRules('pl-PL').select(quantity!);
  return `${quantity} ${plural === 'one' ? unit.one : plural === 'few' ? unit.few : unit.many}`;
}
export function reservationHint(resourceKey?: string): string {
  return resourceKey === 'accessibleRoom'
    ? 'Rezerwujesz całą salę. Liczba miejsc dla uczestników jest podana w nazwie lub warunkach oferty. Limit określa liczbę sal, które można zarezerwować w tym samym czasie.'
    : 'Limit określa liczbę jednostek zasobu, które można zarezerwować w tym samym czasie. Nie oznacza liczby uczestników pilotażu.';
}
