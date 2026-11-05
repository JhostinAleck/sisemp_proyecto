CREATE TABLE IF NOT EXISTS command_requests (
  request_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  summary TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_id)
);
CREATE INDEX IF NOT EXISTS command_requests_created ON command_requests(created_at);
