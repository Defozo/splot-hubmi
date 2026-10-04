"""Prepare authorized Polish narration requests. No network calls or secrets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "output/_video_work"
texts = [
    "Starsi mieszkańcy gminy chcą regularnych spotkań. Instytucja potrzebuje sposobu, żeby je uruchomić. W Splocie opisuje potrzebę i od razu szuka rozwiązania.",
    "Splot pokazuje pasujące innowacje i materiały ze źródłami. Dopytuje o zasoby, które decydują o wdrożeniu. Brakuje zasobu? Widzimy ten warunek przy konkretnej propozycji. Wiemy, co trzeba uzgodnić przed pierwszym spotkaniem.",
    "Z wybranego rozwiązania powstaje Karta wdrożenia. Instytucja określa cel, działania i terminy. Potrzebuje sali? Wybiera ofertę partnera i wysyła zaproszenie z konkretnym zakresem współpracy.",
    "Partner potwierdza udział i termin. Sala ma rezerwację, a instytucja widzi uzgodniony zakres współpracy.",
    "Własny pomysł też ma miejsce w Splocie. Fiszka porządkuje problem i odbiorców. Canwa prowadzi do planu małego testu: co zrobimy, dla kogo i po czym poznamy efekt.",
    "Treści z fiszki przechodzą do formularza wybranego naboru. Uzupełniamy plan, uczestników i budżet. Przeglądamy wniosek, składamy go w HubMI i otrzymujemy numer przyjęcia. Cała sprawa pozostaje dostępna w jednym miejscu.",
    "Autorka pyta opiekuna o kolejny krok. Rozmowa zostaje połączona z jej sprawą.",
    "Opiekun odpowiada ze swojego konta. Uzgodnienie od razu wraca do autorki.",
    "Autorka akceptuje plan. Następnie zatwierdza go opiekun.",
    "Z zaakceptowanej Karty powstaje pilotaż. Koordynator otwiera zapisy i ustala liczbę miejsc.",
    "Mieszkanka zgłasza chęć udziału. Koordynator przyjmuje ją do testu.",
    "Warunki są potwierdzone, sala zarezerwowana. Koordynator rozpoczyna test usługi.",
    "Po spotkaniu uczestniczka wskazuje barierę: trudno znaleźć dostępne wejście. Proponuje czytelną instrukcję dojścia i kontakt do koordynatora.",
    "Opiekun widzi opinię przy testowanej usłudze. Zapisuje wniosek: kolejne zaproszenie powinno zawierać plan dojścia. Zatwierdza opis doświadczenia.",
    "ROPS publikuje doświadczenie w zasobniku. Kolejna instytucja może sięgnąć po ten materiał, a historia wersji pokazuje, co zostało zmienione.",
    "Splot wraca do obserwowanej potrzeby. Powiadomienie wskazuje nową wiedzę, więc autorka może ponownie sprawdzić rozwiązania.",
    "Każda rekomendacja potrzebuje podstaw. Przy innym problemie Splot proponuje konsultację i zapis potrzeby.",
    "Otwórz demo Splotu. Wybierz rolę i przejdź od potrzeby do wspólnie przygotowanego pilotażu.",
]
capture = json.loads((WORK / "manifests/capture.json").read_text(encoding="utf-8"))
assert len(texts) == len(capture["scenes"])
requests = WORK / "audio-requests"
requests.mkdir(parents=True, exist_ok=True)
segments = []
offset = 0
durations = [12, 18, 15, 8, 13, 17, 7, 6, 5, 8, 6, 7, 11, 11, 10, 9, 8, 8]
for scene, text, duration in zip(capture["scenes"], texts, durations):
    name = "pitch-" + scene["id"]
    request = {
        "schema_version": 1, "operation": "voiceover", "name": name,
        "voice_id": "hpp4J3VqNfWAUOO0d1Us", "model_id": "eleven_v4",
        "text": text, "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.18, "speed": 1.04},
        "license": "ElevenLabs premade voice, output generated under authenticated paid payg account. Commercial publication per linked terms. No user voice clone.",
        "rights_reference": "https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform",
        "account_tier": "payg", "intended_use": "Polish narration for the Splot dla HubMI HackYeah demonstration and public submission film.",
    }
    path = requests / f"{name}.json"
    path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding="utf-8")
    segments.append({"id": scene["id"], "start": offset, "duration": duration, "text": text, "request": str(path)})
    offset += duration
(WORK / "audio-script.json").write_text(json.dumps({"language": "pl", "duration": offset, "segments": segments}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"segments": len(segments), "characters": sum(len(t) for t in texts), "words": sum(len(t.split()) for t in texts), "duration": offset}))

