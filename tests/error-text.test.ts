import { describe, expect, it } from 'vitest';
import { ConvexError } from 'convex/values';
import { errorText } from '../src/ui';

describe('Public production errors', () => {
  it('uses the explicit public ConvexError payload rather than its redacted production message', () => {
    const error = new ConvexError('Źródło wycofano. Przygotuj nową Kartę.');
    error.message = '[CONVEX M(hub:transition)] [Request ID: test] Server Error Called by client';
    expect(errorText(error)).toBe('Źródło wycofano. Przygotuj nową Kartę.');
  });
  it('gives a Polish fallback without serializing arbitrary server data', () => {
    const error = new ConvexError({ internal: 'never expose this object' });
    error.message = '[Request ID: test] Server Error';
    expect(errorText(error)).toBe('Nie udało się wykonać działania. Szkic został zachowany. Spróbuj ponownie.');
  });
});
