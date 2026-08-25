-- ============================================================
-- SISMOVIGÍA · Schema PostgreSQL + TimescaleDB
-- Extensión: capa IoT (stations + telemetry)
-- Se aplica automáticamente al primer arranque del contenedor db.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- respaldo para gen_random_uuid()

-- ------------------------------------------------------------------
-- 1. Lecturas crudas: una fila por cada vez que UNA fuente reporta UN sismo
-- ------------------------------------------------------------------
CREATE TABLE raw_events (
    id            BIGSERIAL,
    source        TEXT NOT NULL,               -- 'usgs' | 'ssn'
    external_id   TEXT NOT NULL,               -- id nativo de la fuente, o hash si no lo da
    occurred_at   TIMESTAMPTZ NOT NULL,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    depth_km      DOUBLE PRECISION,
    magnitude     DOUBLE PRECISION NOT NULL,
    mag_type      TEXT,
    region_text   TEXT,
    raw_payload   JSONB,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at),
    UNIQUE (source, external_id, occurred_at)
);
SELECT create_hypertable('raw_events', 'occurred_at');
CREATE INDEX ON raw_events (source, occurred_at DESC);

-- ------------------------------------------------------------------
-- 2. Eventos canónicos (deduplicados): lo que consume el frontend
-- ------------------------------------------------------------------
CREATE TABLE canonical_events (
    id              UUID DEFAULT gen_random_uuid(),
    occurred_at     TIMESTAMPTZ NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    depth_km        DOUBLE PRECISION,
    magnitude       DOUBLE PRECISION NOT NULL,
    region_text     TEXT,
    primary_source  TEXT NOT NULL,              -- fuente que "gana" al mostrar el evento
    alert_level     TEXT NOT NULL,              -- 'normal' | 'precaucion' | 'alerta'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at)
);
SELECT create_hypertable('canonical_events', 'occurred_at');
CREATE INDEX ON canonical_events (occurred_at DESC);
CREATE INDEX ON canonical_events (magnitude DESC);

-- Relación N:1 entre lecturas crudas y evento canónico
-- (sin FK estricta hacia las hypertables — limitación conocida de TimescaleDB;
--  la integridad referencial se garantiza a nivel de aplicación)
CREATE TABLE event_sources (
    canonical_id   UUID NOT NULL,
    raw_event_id   BIGINT NOT NULL,
    linked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (canonical_id, raw_event_id)
);

-- ------------------------------------------------------------------
-- 3. Boletín / noticias (incluye avisos de SASMEX, que NO son eventos)
-- ------------------------------------------------------------------
CREATE TABLE news_items (
    id            BIGSERIAL PRIMARY KEY,
    source        TEXT NOT NULL,
    tag           TEXT,
    title         TEXT NOT NULL,
    body          TEXT,
    url           TEXT,
    published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    external_id   TEXT UNIQUE          -- id determinista de la fuente (idempotencia)
);

-- ------------------------------------------------------------------
-- 4. Observabilidad: salud de cada worker
-- ------------------------------------------------------------------
CREATE TABLE ingestion_runs (
    id             BIGSERIAL PRIMARY KEY,
    source         TEXT NOT NULL,
    started_at     TIMESTAMPTZ NOT NULL,
    finished_at    TIMESTAMPTZ,
    status         TEXT NOT NULL,              -- 'ok' | 'error'
    events_found   INT DEFAULT 0,
    error_message  TEXT
);

-- ------------------------------------------------------------------
-- 5. Agregado continuo — métricas en vivo sin recalcular todo
-- Reemplaza al renderMetrics() del mockup (SPEC-002 §5.2)
-- ------------------------------------------------------------------
CREATE MATERIALIZED VIEW metrics_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', occurred_at) AS bucket,
  count(*)              AS event_count,
  max(magnitude)        AS max_magnitude,
  avg(depth_km)         AS avg_depth
FROM canonical_events
GROUP BY bucket;

SELECT add_continuous_aggregate_policy('metrics_5min',
  start_offset      => INTERVAL '1 day',
  end_offset        => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

-- ------------------------------------------------------------------
-- 6. Compresión y retención
-- ------------------------------------------------------------------
ALTER TABLE raw_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source'
);
SELECT add_compression_policy('raw_events', INTERVAL '7 days');

-- canonical_events: conservar 90 días (catálogo limpio), comprimir después de 30 días
SELECT add_retention_policy('canonical_events', INTERVAL '90 days');
ALTER TABLE canonical_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'primary_source'
);
SELECT add_compression_policy('canonical_events', INTERVAL '30 days');

-- ------------------------------------------------------------------
-- 7. Capa IoT — estaciones y telemetría (extensión del proyecto)
-- ------------------------------------------------------------------
CREATE TABLE stations (
    id          TEXT PRIMARY KEY,              -- ej. 'SX-001'
    name        TEXT NOT NULL,                 -- ej. 'JUBA'
    location    TEXT,                          -- 'Juchitán, OAX'
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    firmware    TEXT,
    status      TEXT NOT NULL DEFAULT 'online', -- 'online' | 'offline' | 'degraded'
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telemetry (
    id          BIGSERIAL,
    station_id  TEXT NOT NULL REFERENCES stations(id),
    accel_x     DOUBLE PRECISION NOT NULL,     -- g
    accel_y     DOUBLE PRECISION NOT NULL,     -- g
    accel_z     DOUBLE PRECISION NOT NULL,     -- g
    temperature DOUBLE PRECISION,              -- °C
    rssi        INTEGER,                       -- dBm
    battery_v   DOUBLE PRECISION,              -- voltios
    sampled_at  TIMESTAMPTZ NOT NULL,          -- reloj del sensor
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, sampled_at)
);
SELECT create_hypertable('telemetry', 'sampled_at');
CREATE INDEX ON telemetry (station_id, sampled_at DESC);
-- Idempotencia MQTT: una lectura por (estación, marca de tiempo)
CREATE UNIQUE INDEX ON telemetry (station_id, sampled_at);
-- Retención: la telemetría es efímera (serie de tiempo de alta frecuencia)
SELECT add_retention_policy('telemetry', INTERVAL '7 days');

-- ------------------------------------------------------------------
-- 8. Suscripciones push (Firebase Cloud Messaging)
-- ------------------------------------------------------------------
CREATE TABLE push_subscriptions (
    id            BIGSERIAL PRIMARY KEY,
    fcm_token     TEXT NOT NULL UNIQUE,
    alert_levels  TEXT[] NOT NULL DEFAULT ARRAY['alerta', 'precaucion'],
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON push_subscriptions (fcm_token);

-- Estaciones de demostración (idempotente; el simulador IoT las usa)
INSERT INTO stations (id, name, location, latitude, longitude, firmware, status) VALUES
  ('SX-001', 'JUBA', 'Juchitán, OAX',    16.44, -95.02, '2.1.4', 'online'),
  ('SX-002', 'CACX', 'CDMX · Roma',      19.42, -99.16, '2.1.4', 'online'),
  ('SX-003', 'CIGE', 'Coyuca, GRO',      16.96, -100.08,'2.1.3', 'online'),
  ('SX-004', 'OXXM', 'Oaxaca centro',    17.06, -96.72, '2.1.4', 'online'),
  ('SX-005', 'TPNX', 'Tepic, NAY',       21.51, -104.89,'2.1.2', 'online'),
  ('SX-006', 'MXRL', 'Mérida, YUC',      20.97, -89.62, '2.0.9', 'degraded')
ON CONFLICT (id) DO NOTHING;