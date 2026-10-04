import { describe, expect, it } from 'vitest';
import { auditEventLabel, auditObjectLabel, integrationStateLabel, jobStateLabel, knowledgeKindLabel, notificationBody, readableDemoTitle, reservationHint, reservationQuantity, reservationUnitLabel, stateLabel } from '../src/display-labels';

describe('Etykiety istniejących danych w interfejsie', () => {
  it('zachowuje odrębne znaczenie przyjęcia, zatwierdzenia, publikacji i zastąpienia wersji', () => {
    expect(['accepted', 'approved', 'published', 'superseded'].map(stateLabel)).toEqual(['Przyjęto', 'Zatwierdzono', 'Opublikowano', 'Zastąpiono nowszą wersją']);
    expect(knowledgeKindLabel('case')).toBe('Doświadczenie pilotażu');
    expect(knowledgeKindLabel('course')).toBe('Materiał edukacyjny');
    expect(jobStateLabel('running')).toBe('W trakcie wykonywania');
    expect(integrationStateLabel('confirmed_by_simulator')).toBe('Potwierdzone przez symulator');
  });
  it('tłumaczy historyczny stan systemowy bez zmiany tytułu, wiadomości użytkownika ani zdarzenia', () => {
    const notice = { title: 'Zmiana statusu sprawy', body: 'Warsztat accepted: nowa grupa: accepted' };
    expect(notificationBody(notice)).toBe('Warsztat accepted: nowa grupa: Przyjęto');
    expect(notice.body).toBe('Warsztat accepted: nowa grupa: accepted');
    expect(notificationBody({ title: 'Odpowiedź opiekuna', body: 'Nazwa pola: accepted' })).toBe('Nazwa pola: accepted');
    expect(notificationBody({ title: notice.title, body: 'Sprawa: Stan nieuzgodniony' })).toBe('Sprawa: Stan nieuzgodniony');
  });
  it('odróżnia jedną rezerwowaną salę od liczby jej uczestników', () => {
    expect(reservationQuantity(1, 'accessibleRoom')).toBe('1 sala');
    expect(reservationUnitLabel('accessibleRoom')).toBe('sala');
    expect(reservationHint('accessibleRoom')).toContain('liczbę sal');
    expect([2, 5, 12, 22].map(n => reservationQuantity(n, 'accessibleRoom'))).toEqual(['2 sale', '5 sal', '12 sal', '22 sale']);
    expect(reservationQuantity(15, 'volunteers')).toBe('15 osób');
  });
  it('nie domyśla się jednostki ani ilości przy nieznanym lub niepełnym zasobie', () => {
    expect(reservationQuantity(1, 'other')).toBe('1 jednostka zasobu');
    expect(reservationQuantity(undefined, 'accessibleRoom')).toBe('Nie określono liczby jednostek');
    expect(reservationQuantity(1.5, 'devices')).toBe('Nie określono liczby jednostek');
  });
});

describe('Czytelna historia audytu bez zmiany znaczenia operacji', () => {
  it('odróżnia rozpoczęcie publikacji od gotowej publikacji i pojedynczą akceptację od stanu sprawy', () => {
    expect(auditEventLabel('knowledge_publish')).toBe('Rozpoczęcie publikacji materiału');
    expect(auditEventLabel('knowledge_publication_indexed')).toBe('Zakończenie publikacji materiału');
    expect(auditEventLabel('publish_experience')).toBe('Przekazanie doświadczenia do redakcji wiedzy');
    expect(auditEventLabel('approve')).toBe('Zapisanie akceptacji');
    expect(auditEventLabel('quiet')).toBe('Zmiana wyciszenia powiadomień');
    expect(auditEventLabel('attachment_scan')).toBe('Kontrola załącznika');
  });
  it('używa dostępnego rodzaju i wersji, zachowując dane i nie dopisując tytułu', () => {
    const event = { action: 'create', entityId: 'full-private-record-id', details: { kind: 'card', version: 2 } };
    expect(auditObjectLabel(event)).toBe('Karta wdrożenia · wersja 2');
    expect(event).toEqual({ action: 'create', entityId: 'full-private-record-id', details: { kind: 'card', version: 2 } });
    expect(auditObjectLabel({ action: 'approve', entityType: 'pilot' })).toBe('Pilotaż');
    expect(auditObjectLabel({ action: 'create', metadata: { kind: 'idea' } })).toBe('Fiszka pomysłu');
    expect(auditObjectLabel({ action: 'approve' })).toBe('Sprawa w obiegu');
  });
  it('rozróżnia obiekt załącznika, sprawę po jego usunięciu i import wielu materiałów', () => {
    expect(auditObjectLabel({ action: 'attachment_scan' })).toBe('Załącznik');
    expect(auditObjectLabel({ action: 'attachment_delete' })).toBe('Sprawa z usuniętym załącznikiem');
    expect(auditObjectLabel({ action: 'knowledge_import', entityId: 'import:hash', details: { count: 3 } })).toBe('Import materiałów wiedzy');
    expect(auditObjectLabel({ action: 'source_withdraw', details: { version: 2 } })).toBe('Źródło · wersja 2');
    expect(auditObjectLabel({ action: 'privacy_erasure_completed' })).toBe('Zadanie usunięcia prywatnych danych');
  });
  it('dla nieznanej operacji lub metadanych nie zgaduje rodzaju, tytułu ani numeru wersji', () => {
    for (const action of ['future_action', 'toString', '__proto__']) {
      expect(auditEventLabel(action)).toBe('Inna operacja systemowa');
      expect(auditObjectLabel({ action, details: { kind: 'toString', version: -1, title: 'Niepotwierdzony tytuł' } })).toBe('Obiekt zdarzenia');
    }
    expect(auditObjectLabel({ action: 'edit', details: ['card'], metadata: null })).toBe('Sprawa w obiegu');
  });
});

describe('Prezentacja dokładnych wzorców tytułów prób technicznych', () => {
  const stamp = String(Date.parse('2026-10-03T10:00:00.123Z'));
  it('zachowuje temat, oryginał i czytelną datę dla wzorców używanych w pełnym teście', () => {
    for (const base of ['Sala testowa', 'Karta wspólnego spotkania', 'Pilotaż: Karta wspólnego spotkania', 'Doświadczenie: Pilotaż: Karta wspólnego spotkania', 'Konsultacja testowa', 'Spotkania sąsiedzkie E2E']) {
      const original = `${base} ${stamp}`, display = readableDemoTitle(original);
      expect(display.original).toBe(original);
      expect(display.title).toMatch(/03\.10\.2026.*12:00:00$/);
      expect(display.title.startsWith(`${base} · próba `)).toBe(true);
      expect(display.context).toContain('Powtarzalna próba techniczna');
      expect(display.context).toContain('czas w Polsce');
    }
  });
  it('uczciwie zachowuje powtarzalność tematów i różnicę milisekund w oryginałach', () => {
    const first = readableDemoTitle(`Sala testowa ${stamp}`), second = readableDemoTitle(`Sala testowa ${Number(stamp) + 1}`);
    expect(first.title).toBe(second.title);
    expect(first.original).not.toBe(second.original);
    expect(readableDemoTitle(first.original!)).toEqual(first);
  });
  it('obsługuje potwierdzone wzorce kontroli źródeł i ISO, zachowując numer operacji', () => {
    for (const base of ['Kontrola daty źródła', 'Izolowana kontrola źródeł', 'Potrzeba testu źródeł', 'Karta testu źródeł']) {
      const original = `${base} ${stamp}`;
      expect(readableDemoTitle(original).original).toBe(original);
    }
    expect(readableDemoTitle('Test obserwowania 2026-10-03T10:00:00.123Z').title).toMatch(/12:00:00$/);
    expect(readableDemoTitle('Pomiar techniczny komunikacji 2026-10-03T10:00:00.123Z 20').title).toContain('operacja 20');
    expect(readableDemoTitle('Test obserwowania 2026-01-03T10:00:00.123Z').title).toMatch(/11:00:00$/);
  });
  it('pozostawia inne tytuły i niepełne lub niepoprawne wzorce całkowicie identyczne', () => {
    for (const title of [
      'Dostępna sala na 15 osób', 'Sala biblioteki na wspólne spotkania', 'Sąsiedzkie rozmowy w Zielonej Gminie',
      `Sala demonstracyjna ${stamp}`, `Własna karta ${stamp}`, `Sala testowa ${stamp} dodatkowy tekst`,
      ` Sala testowa ${stamp}`, `Sala testowa ${stamp}\n`, `sala testowa ${stamp}`, 'Sala testowa 42',
      'Spotkania sąsiedzkie z czytelnym dojściem 11-10-55', `Doświadczenie: Moja karta ${stamp}`,
      'Test obserwowania 2026-02-30T10:00:00.123Z', 'Test obserwowania 2026-10-03T10:00:00.123Z 1',
      'Pomiar techniczny komunikacji 2026-10-03T10:00:00.123Z', 'Pomiar techniczny komunikacji 2026-10-03T10:00:00.123Z 21',
    ]) expect(readableDemoTitle(title)).toEqual({ title });
  });
});
