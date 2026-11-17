-- +goose Up
-- KIPerspektiven#4 (REQ-4): Die Themen „KI in Data Analytics“ (00002/00007) und „Modelle und Kosten“ (00009)
-- werden nicht mehr angeboten. Die bestehenden Migrationen bleiben unverändert; diese Migration entfernt die
-- Themen in bestehenden Datenbanken und bei Neuinstallationen.
--
-- Gelöscht werden nur die Themen. Ihre Sprachfassungen und die Zuordnungen in post_topics entfernt die
-- Datenbank per ON DELETE CASCADE. Beiträge, Entwürfe und ihre übrigen Themenzuordnungen bleiben erhalten.
DELETE FROM topics WHERE slug IN ('data-analytics', 'modelle-und-kosten');

-- +goose Down
-- Stellt die Metadaten aus 00007 und 00009 wieder her. Frühere Beitragszuordnungen lassen sich nicht
-- wiederherstellen. Migration 00002 löscht beim Rollback die feste ID 3; deshalb muss sie erhalten bleiben.
-- Ist sie inzwischen anderweitig belegt, schlägt das Rollback fehl, statt fremde Daten zu überschreiben.
INSERT INTO topics (id, slug, sort_order) VALUES (3, 'data-analytics', 3);
-- IDs 4 und 5 stellt das Rollback von 00010 fest wieder her; Modelle und Kosten erhält deshalb eine höhere ID.
INSERT INTO topics (id, slug, sort_order) SELECT MAX(COALESCE(MAX(id), 0), 5) + 1, 'modelle-und-kosten', 6 FROM topics;

INSERT INTO topic_translations (topic_id, lang, title, label, summary, intro) VALUES
    (3, 'de', 'KI in Data Analytics', 'Data Analytics',
    'Wie aus einer schnellen KI-Antwort eine belastbare Analyse wird: Kennzahlen klären, Ergebnisse prüfen.',
    'KI beantwortet Datenfragen in Alltagssprache, schreibt Analysecode und unterstützt Prognosen. Belastbar werden die Ergebnisse erst, wenn Kennzahlen eindeutig definiert sind und Antworten mit den Quelldaten abgeglichen werden. Diese Seite zeigt Einsatzfelder, Grenzen und einen Pilot.'),
    (3, 'en', 'AI in Data Analytics', 'Data Analytics',
    'How a quick AI answer becomes a reliable analysis: clarify metrics, check results.',
    'AI answers data questions in everyday language, writes analysis code and supports forecasts. The results only become reliable once metrics are clearly defined and answers are checked against the source data. This page covers use cases, limits and a pilot.');

INSERT INTO topic_translations (topic_id, lang, title, label, summary, intro)
SELECT id, 'de', 'Modelle und Kosten: Wie finde ich das beste Preis-/Leistungsverhältnis?', 'Modelle und Kosten',
    'Warum das günstigste Modell nicht automatisch die beste Wahl ist und wie Sie Preis und Leistung selbst vergleichen.',
    'Ein niedriger Preis je Token sagt wenig darüber aus, was ein brauchbares Ergebnis kostet. Diese Seite zeigt, welche Kosten in die Rechnung gehören, was öffentliche Vergleiche leisten und wie Sie mit eigenen Testaufgaben das passende Modell finden.'
FROM topics WHERE slug = 'modelle-und-kosten';

INSERT INTO topic_translations (topic_id, lang, title, label, summary, intro)
SELECT id, 'en', 'Models and Costs: How do I find the best price-performance ratio?', 'Models and Costs',
    'Why the cheapest model is not automatically the best choice and how to compare price and performance yourself.',
    'A low price per token says little about what a usable result costs. This page shows which costs belong in the calculation, what public comparisons can and cannot do, and how to find the right model with your own test tasks.'
FROM topics WHERE slug = 'modelle-und-kosten';
