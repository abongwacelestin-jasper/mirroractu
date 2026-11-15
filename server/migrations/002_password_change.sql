-- Accounts created automatically from environment variables start with a shared first
-- password. This flag makes the dashboard insist on a new one before anything else.
ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
