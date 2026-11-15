-- MirrorActu database, version 1.

-- Staff who can sign in to the dashboard.
CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'editor')),
  password_hash text NOT NULL,
  disabled      boolean NOT NULL DEFAULT false,
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Sign-in sessions. Only a hash of the session token is stored, never the token.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Stories. `data` holds the story exactly as the site reads it; the columns beside it are for querying.
CREATE TABLE stories (
  id         text PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  data       jsonb NOT NULL,
  cats       text[] NOT NULL,
  tier       text NOT NULL CHECK (tier IN ('low', 'medium', 'high')),
  story_date date NOT NULL,
  published  boolean NOT NULL DEFAULT true,
  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX stories_date ON stories(story_date DESC);

-- Other site content, one row per kind: categories, agenda, graphics, trend topics and so on.
CREATE TABLE content (
  key        text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The live wire.
CREATE TABLE wire_items (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  desk       text NOT NULL,
  cat        text NOT NULL,
  text       text NOT NULL,
  story_id   text,
  kind       text NOT NULL CHECK (kind IN ('update', 'confirmed', 'result', 'data')),
  created_by bigint REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX wire_at ON wire_items(at DESC);

-- Morning email sign-ups.
CREATE TABLE subscribers (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Corrections reported by readers.
CREATE TABLE corrections (
  id          bigserial PRIMARY KEY,
  story_title text,
  message     text NOT NULL,
  email       text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checking', 'corrected', 'no_change')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  handled_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  handled_at  timestamptz
);

-- Enquiries about advertiser offers.
CREATE TABLE enquiries (
  id            bigserial PRIMARY KEY,
  advertiser_id text NOT NULL,
  offer_id      text NOT NULL,
  email         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Readership events. Recorded only for readers who allowed measurement.
-- No IP address is stored: `visitor` is a hash that changes every day and cannot be reversed.
CREATE TABLE events (
  id       bigserial PRIMARY KEY,
  at       timestamptz NOT NULL DEFAULT now(),
  type     text NOT NULL,
  story_id text,
  path     text,
  country  text,
  lang     text,
  visitor  text
);
CREATE INDEX events_at ON events(at DESC);
CREATE INDEX events_story ON events(story_id, at DESC);

-- Who changed what in the dashboard.
CREATE TABLE audit_log (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  action  text NOT NULL,
  target  text,
  detail  jsonb
);
CREATE INDEX audit_at ON audit_log(at DESC);
