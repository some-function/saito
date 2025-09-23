CREATE TABLE IF NOT EXISTS payment_requests (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  address_id           INTEGER NOT NULL,       -- <— the link
  -- (keep copies for fast filters / late payments without join)
  address              TEXT NOT NULL,
  asset_id             TEXT NOT NULL,
  chain_id             TEXT NOT NULL,

  public_key           TEXT NOT NULL,
  expected_amount      TEXT NOT NULL,
  minutes              INTEGER NOT NULL,
  expires_at           INTEGER NOT NULL,
  tx_json              TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (
                        status IN ('reserved','funded','confirmed','executed',
                                   'expired','late_paid','failed','refunded')
                      ),
  deposit_tx_hash      TEXT,
  deposit_amount       TEXT,
  deposit_seen_at      INTEGER,
  confirmations        INTEGER DEFAULT 0,
  confirmations_req    INTEGER DEFAULT 1,
  saito_tx_id          TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,

  FOREIGN KEY (address_id) REFERENCES payment_address(id) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payaddr_status  ON payment_address (status);
CREATE INDEX IF NOT EXISTS idx_payaddr_asset   ON payment_address (asset_id, chain_id, status);
CREATE INDEX IF NOT EXISTS idx_preq_status     ON payment_requests (status);
CREATE INDEX IF NOT EXISTS idx_preq_address    ON payment_requests (asset_id, chain_id, address);
CREATE INDEX IF NOT EXISTS idx_preq_expires    ON payment_requests (expires_at);