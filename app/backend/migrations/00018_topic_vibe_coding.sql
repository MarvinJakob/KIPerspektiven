-- +goose Up
-- #29: A new topic with both translations, for existing databases and fresh installations.
INSERT INTO topics (slug, sort_order) VALUES ('vibe-coding', 7);

INSERT INTO topic_translations (topic_id, lang, title, label, summary, intro)
SELECT id, 'de', 'Vibe Coding', 'Vibe Coding',
    'Warum schneller Code allein nicht reicht und wie fünf Engineering-Perspektiven helfen, Verantwortung für das Ergebnis zu übernehmen.',
    'Du beschreibst, was du möchtest und die KI schreibt den Code. Fünf Engineering-Perspektiven helfen dir, aus schnellen Prototypen verlässliche und sinnvolle Software zu entwickeln.'
FROM topics WHERE slug = 'vibe-coding';

INSERT INTO topic_translations (topic_id, lang, title, label, summary, intro)
SELECT id, 'en', 'Vibe Coding', 'Vibe Coding',
    'Why fast code alone is not enough and how five engineering perspectives help you take responsibility for the result.',
    'You describe what you want and AI writes the code. Five engineering perspectives help you turn quick prototypes into reliable, useful software.'
FROM topics WHERE slug = 'vibe-coding';

-- +goose Down
DELETE FROM topics WHERE slug = 'vibe-coding';
