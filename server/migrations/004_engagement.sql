-- Engagement: page views, clicks and searches join story views in the `events` table.
-- Still only for readers who allowed measurement, and still with no IP address.
--   type   'view'   a story was opened (unchanged; trends are built on these)
--          'page'   any page was opened; `ref` is the site the reader arrived from, if any
--          'click'  something was pressed; `label` says what ("out:example.com", "ad:akagera-air")
--          'search' a search was run; `label` is the words, `value` how many results came back
ALTER TABLE events
  ADD COLUMN label text,
  ADD COLUMN ref   text,
  ADD COLUMN value integer;
CREATE INDEX events_type_at ON events (type, at DESC);
