-- Time on page. A new kind of event, 'time': when a reader leaves a page, the browser reports
-- how many seconds that page was actually on screen (`value`). Like every other event it is
-- sent only with consent and carries no IP address. It is not a request, so it is left out
-- of request counts. No schema change is needed: this file records the meaning and adds an index.
CREATE INDEX events_time ON events (path) WHERE type = 'time';
