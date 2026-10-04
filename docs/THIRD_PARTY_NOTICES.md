# Biblioteki i narzędzia

Projekt: Splot dla HubMI. Zespół: DEFOZO SOFTWARE HOUSE. Autor: Michał Kiełtyka.

Rejestr odczytano z package-lock.json i metadanych zainstalowanych pakietów. Dokładne pliki LICENSE pozostają w dystrybucjach bibliotek. Pełna lista zależności przechodnich: [DEPENDENCIES.json](DEPENDENCIES.json).

| Pakiet bezpośredni | Wersja | Licencja | Zakres |
| --- | --- | --- | --- |
| @auth/core | 0.41.3 | ISC | aplikacja |
| @axe-core/playwright | 4.13.0 | MPL-2.0 | narzędzie developerskie |
| @cfworker/json-schema | 4.1.1 | MIT | aplikacja |
| @convex-dev/auth | 0.0.96 | Apache-2.0 | aplikacja |
| @edge-runtime/vm | 5.0.0 | MIT | narzędzie developerskie |
| @hookform/resolvers | 5.9.1 | MIT | aplikacja |
| @oslojs/crypto | 1.0.1 | MIT | aplikacja |
| @playwright/test | 1.63.0 | Apache-2.0 | narzędzie developerskie |
| @radix-ui/react-dialog | 1.1.23 | MIT | aplikacja |
| @radix-ui/react-tabs | 1.1.21 | MIT | aplikacja |
| @radix-ui/react-tooltip | 1.2.16 | MIT | aplikacja |
| @rjsf/core | 6.11.0 | Apache-2.0 | aplikacja |
| @rjsf/utils | 6.11.0 | Apache-2.0 | aplikacja |
| @rjsf/validator-ajv8 | 6.11.0 | Apache-2.0 | aplikacja |
| @types/node | 26.6.4 | MIT | narzędzie developerskie |
| @types/papaparse | 5.5.2 | MIT | narzędzie developerskie |
| @types/react | 19.3.0 | MIT | aplikacja |
| @types/react-dom | 19.3.0 | MIT | aplikacja |
| @vitejs/plugin-react | 6.1.1 | MIT | narzędzie developerskie |
| ajv | 8.20.0 | MIT | aplikacja |
| ajv-formats | 2.1.1 | MIT | aplikacja |
| convex | 1.46.0 | Apache-2.0 | aplikacja |
| convex-test | 0.0.60 | Apache-2.0 | narzędzie developerskie |
| jose | 5.10.0 | MIT | aplikacja |
| jose | 6.2.12 | MIT | aplikacja |
| lucide-react | 1.51.0 | ISC | aplikacja |
| papaparse | 5.7.0 | MIT | aplikacja |
| pdfjs-dist | 6.3.289 | Apache-2.0 | aplikacja |
| react | 19.3.0 | MIT | aplikacja |
| react-dom | 19.3.0 | MIT | aplikacja |
| react-hook-form | 7.89.0 | MIT | aplikacja |
| tsx | 4.23.15 | MIT | narzędzie developerskie |
| typescript | 7.0.2 | Apache-2.0 | narzędzie developerskie |
| vite | 8.3.2 | MIT | narzędzie developerskie |
| vitest | 5.0.3 | MIT | narzędzie developerskie |
| zod | 3.25.76 | MIT | aplikacja |

## Pozostałe narzędzia i usługi

- Node.js, npm, TypeScript, Vite, Vitest, Playwright, axe-core: uruchomienie i weryfikacja. Wersje określa lockfile.
- Convex i Convex Auth: backend, sesje, pliki, indeksy i serwowanie skompilowanej aplikacji. Usługa zewnętrzna, kod integracji jest w projekcie.
- Groq GPT-OSS 120B: interpretacja i propozycje tekstowe. OpenAI text-embedding-3-small: embeddingi. Dane i modele dostawców nie są częścią przekazywanego kodu.
- Codex: narzędzie wspomagające opracowanie kodu, dokumentacji i testów. Użycie narzędzia nie zmienia listy członków zespołu.
- DM Sans i Manrope: fonty SIL Open Font License 1.1, dostarczane lokalnie w public/fonts wraz z tekstami licencji.
- OpenAI GPT-6 Luna: opcjonalny OCR PDF po zgodzie, osobno raportowane zużycie.
- FFmpeg: montaż rzeczywistego nagrania przeglądarki. ReportLab i Poppler: przygotowanie i kontrola PDF. Artifact Tool: edytowalna prezentacja.
- ElevenLabs: polski lektor filmu, gotowy głos Bella - Professional, Bright, Warm, model `eleven_v4`. Nagrania wygenerowano 3 października 2026 na uwierzytelnionym płatnym koncie payg, bez klonowania głosu użytkownika. [Zasady publikacji dostawcy](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform).
- „Splot: spotkania”: oryginalny podkład instrumentalny zsyntetyzowany lokalnie przez `scripts/compose-demo-music.py`, bez zewnętrznych nagrań i sampli.
- psst: wstrzykiwanie sekretów w procesy. Żaden klucz dostawcy nie wchodzi do paczki.

Kod własny, korpus demonstracyjny i dokumentacja są rozdzielone od zależności i materiałów organizatora. Rejestr nie zastępuje analizy i podpisania wymaganych oświadczeń o prawach przez autora.
