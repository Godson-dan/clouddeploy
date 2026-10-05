CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  repository   TEXT NOT NULL,
  branch       TEXT NOT NULL,
  framework    TEXT NOT NULL,
  region       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('healthy', 'building', 'failed', 'idle')),
  description  TEXT NOT NULL DEFAULT '',
  domain       TEXT NOT NULL,
  custom_domain TEXT NOT NULL DEFAULT '',
  cpu          TEXT NOT NULL,
  memory       TEXT NOT NULL,
  replicas     INTEGER NOT NULL CHECK (replicas > 0),
  manifest     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number               INTEGER NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('success', 'failed', 'building')),
  action               TEXT NOT NULL CHECK (action IN ('deploy', 'redeploy', 'rollback')),
  branch               TEXT NOT NULL,
  commit_sha           TEXT NOT NULL,
  message              TEXT NOT NULL,
  duration             TEXT NOT NULL DEFAULT '—',
  target_deployment_id TEXT REFERENCES deployments(id) ON DELETE SET NULL,
  logs                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);
CREATE INDEX IF NOT EXISTS deployments_project_created_idx ON deployments (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS environment_variables (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  secret     BOOLEAN NOT NULL,
  seq        BIGINT GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (project_id, key)
);
