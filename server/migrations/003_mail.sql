-- Email: double opt-in for the morning email, a log of what was sent, and newsletter editions.

ALTER TABLE subscribers
  ADD COLUMN token           text,
  ADD COLUMN country         text,
  ADD COLUMN lang            text,
  ADD COLUMN confirm_sent_at timestamptz,
  ADD COLUMN confirmed_at    timestamptz,
  ADD COLUMN unsubscribed_at timestamptz;

-- Every subscriber gets a private token: it is what the confirm and unsubscribe links carry.
UPDATE subscribers SET token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE token IS NULL;
ALTER TABLE subscribers ALTER COLUMN token SET NOT NULL;
CREATE UNIQUE INDEX subscribers_token_idx ON subscribers (token);

-- "bounced": the address refused our email, so we stop writing to it.
ALTER TABLE subscribers DROP CONSTRAINT subscribers_status_check;
ALTER TABLE subscribers ADD CONSTRAINT subscribers_status_check CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'bounced'));

-- What was sent, to whom, and whether the email service accepted it. Bodies are not kept.
-- Rows are deleted after EVENTS_RETENTION_DAYS, like readership events.
CREATE TABLE emails (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  kind        text NOT NULL,
  recipient   text NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL CHECK (status IN ('sent', 'failed', 'not_configured')),
  provider_id text,
  error       text
);
CREATE INDEX emails_at_idx ON emails (at DESC);

-- Editions of the morning email sent from the dashboard.
CREATE TABLE newsletters (
  id         bigserial PRIMARY KEY,
  subject    text NOT NULL,
  intro      text,
  story_ids  text[] NOT NULL,
  status     text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  recipients integer NOT NULL DEFAULT 0,
  delivered  integer NOT NULL DEFAULT 0,
  failed     integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_by    bigint REFERENCES users(id) ON DELETE SET NULL
);
