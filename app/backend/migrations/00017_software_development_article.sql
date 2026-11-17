-- +goose Up
-- Ticket #7: Kurzbeschreibung und Einführung passend zum neuen Artikel, Ansprache „du“. Titel, Label,
-- URL und Beitragszuordnungen bleiben erhalten.
UPDATE topic_translations SET
    summary = 'Wie drei Agententeams mit Fidelity-Tests, Merge Gate und Release Gate Software entwickeln.',
    intro = 'KI schreibt Code, erstellt Tests und setzt Korrekturen um. Hier erfährst du, wie drei Agententeams mit Fidelity-Tests, Merge Gate und Release Gate gemeinsam Software entwickeln.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'de';

UPDATE topic_translations SET
    summary = 'How three teams of agents develop software with Fidelity Tests, a Merge Gate and a Release Gate.',
    intro = 'AI writes code, creates tests and implements fixes. Learn how three teams of agents develop software together with Fidelity Tests, a Merge Gate and a Release Gate.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'en';

-- +goose Down
UPDATE topic_translations SET
    summary = 'Wie Sie mit KI Software entwickeln, Ergebnisse prüfen und die Flut an Änderungen beherrschen.',
    intro = 'KI kann Code schreiben, Tests erstellen und Fehler beheben. Entscheidend sind überprüfbare Ergebnisse und ein klarer Entwicklungsprozess. Hier erfahren Sie, wie drei Agententeams zusammenarbeiten, Guardrails die Arbeit begrenzen und Änderungen gezielt geprüft werden.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'de';

UPDATE topic_translations SET
    summary = 'How to develop software with AI, verify results and manage the flood of changes.',
    intro = 'AI can write code, create tests and fix bugs. Verifiable results and a clear development process are essential. Learn how three teams of agents work together, how guardrails set boundaries and how changes are reviewed effectively.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'en';
