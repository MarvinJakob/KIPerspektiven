-- +goose Up
-- Ticket #146: Thema und Beitragszuordnungen bleiben erhalten.
UPDATE topic_translations SET
    summary = 'Wie Sie mit KI Software entwickeln, Ergebnisse prüfen und die Flut an Änderungen beherrschen.',
    intro = 'KI kann Code schreiben, Tests erstellen und Fehler beheben. Entscheidend sind überprüfbare Ergebnisse und ein klarer Entwicklungsprozess. Hier erfahren Sie, wie drei Agententeams zusammenarbeiten, Guardrails die Arbeit begrenzen und Änderungen gezielt geprüft werden.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'de';

UPDATE topic_translations SET
    summary = 'How to develop software with AI, verify results and manage the flood of changes.',
    intro = 'AI can write code, create tests and fix bugs. Verifiable results and a clear development process are essential. Learn how three teams of agents work together, how guardrails set boundaries and how changes are reviewed effectively.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'en';

-- +goose Down
UPDATE topic_translations SET
    summary = 'Wie Sie KI-Assistenten mit Markdown-Regeln, Zugriffsrechten, Tests und Reviews anleiten.',
    intro = 'Dateien wie `AGENTS.md` geben KI-Assistenten Ziele, Arbeitsabläufe und Grenzen mit. Das Modell kann solche Regeln aber missverstehen oder übergehen. Hier sehen Sie, wie Sie prüfbare Regeln schreiben, Freigaben an Aktionen binden und Grenzen technisch absichern.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'de';

UPDATE topic_translations SET
    summary = 'How to guide AI assistants with Markdown rules, access permissions, tests and reviews.',
    intro = 'Files such as `AGENTS.md` give AI assistants goals, workflows and boundaries. However, the model can misunderstand or disregard these rules. Here you can learn how to write verifiable rules, tie approvals to actions and enforce boundaries through technical controls.'
WHERE topic_id = (SELECT id FROM topics WHERE slug = 'softwareentwicklung') AND lang = 'en';
