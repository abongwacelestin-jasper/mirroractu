-- Device and visit.
--   device, os, browser   broad categories only ("phone", "Android", "Chrome"), worked out in the
--                         reader's browser. No version numbers and no model: not enough to
--                         single anyone out.
--   visit                 a random code made in the reader's browser for one visit (one tab
--                         session). It links the pages of that visit to each other so a
--                         journey can be read. It is not derived from an IP address, is not
--                         kept after the tab closes, and does not link one visit to the next.
-- Sent only by readers who allowed measurement, like every other event.
ALTER TABLE events
  ADD COLUMN device  text,
  ADD COLUMN os      text,
  ADD COLUMN browser text,
  ADD COLUMN visit   text;
CREATE INDEX events_visit ON events (visit, at) WHERE visit IS NOT NULL;
