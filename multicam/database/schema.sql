-- MultiCam Music Studio: schema inicial do PostgreSQL (Neon)
-- Os arquivos de vídeo/áudio permanecem no armazenamento local do computador.
-- Este banco guarda somente metadados e caminhos dos arquivos.

CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL DEFAULT 'Gravação',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','recording','processing','completed','failed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC(12,3),
  output_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camera_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  camera_index INTEGER NOT NULL CHECK (camera_index >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('usb','ip','rtsp','mobile','other')),
  display_name TEXT NOT NULL,
  device_ref TEXT,
  local_file_path TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, camera_index)
);

CREATE TABLE IF NOT EXISTS timeline_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  camera_index INTEGER NOT NULL CHECK (camera_index >= 0),
  start_seconds NUMERIC(12,3) NOT NULL CHECK (start_seconds >= 0),
  end_seconds NUMERIC(12,3) NOT NULL CHECK (end_seconds > start_seconds),
  position INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recording_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  camera_index INTEGER,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('camera_video','audio','clip','final_video','thumbnail','other')),
  local_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  duration_seconds NUMERIC(12,3),
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recording_sessions_created_at
  ON recording_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_sources_session
  ON camera_sources(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_segments_session_position
  ON timeline_segments(session_id, position);
CREATE INDEX IF NOT EXISTS idx_recording_files_session
  ON recording_files(session_id);
