-- "Trending on the web": what outside sources say is trending, kept apart from the newsroom's
-- own trends. One row per source and country ('' is the worldwide list). The engine in
-- server/src/webtrends/ decides when each row is fetched again.
CREATE TABLE web_trend_feeds (
  source     text NOT NULL,
  country    text NOT NULL DEFAULT '',
  items      jsonb NOT NULL DEFAULT '[]',
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'ok', 'empty', 'unsupported', 'error')),
  mode       text,
  fetched_at timestamptz,
  changed_at timestamptz,
  next_at    timestamptz NOT NULL DEFAULT now(),
  interval_s integer NOT NULL DEFAULT 0,
  fails      integer NOT NULL DEFAULT 0,
  last_error text,
  -- When a reader last asked for this country: feeds people are looking at are refreshed first.
  wanted_at  timestamptz,
  PRIMARY KEY (source, country)
);
CREATE INDEX web_trend_feeds_due ON web_trend_feeds (source, next_at);

-- Per source: whether it is switched on, and how hard the engine is currently holding back.
CREATE TABLE web_trend_sources (
  source         text PRIMARY KEY,
  enabled        boolean NOT NULL DEFAULT true,
  cooldown_until timestamptz,
  cooldown_s     integer NOT NULL DEFAULT 0,
  gap_ms         integer NOT NULL DEFAULT 0
);

-- Requests made per source per day, to stay inside each source's daily allowance.
CREATE TABLE web_trend_usage (
  source   text NOT NULL,
  day      date NOT NULL DEFAULT current_date,
  requests integer NOT NULL DEFAULT 0,
  errors   integer NOT NULL DEFAULT 0,
  limited  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (source, day)
);
