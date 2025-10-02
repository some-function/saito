-- pool of deposit addresses per asset/chain, reusable over time
CREATE TABLE IF NOT EXISTS payment_address (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key       TEXT NOT NULL,
  asset_id         TEXT NOT NULL,
  chain_id         TEXT NOT NULL,
  address          TEXT NOT NULL,
  status           INTEGER NOT NULL DEFAULT 0,  -- 0 unused, 1 reserved, 2 retired
  reserved_at      INTEGER,
  reserved_request INTEGER,                     
  last_used_at     INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  UNIQUE (asset_id, chain_id, address)
);