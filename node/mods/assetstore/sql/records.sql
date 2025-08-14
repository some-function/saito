CREATE TABLE IF NOT EXISTS records (
  id INTEGER DEFAULT '',
  nft_id TEXT DEFAULT '',
  nft_tx TEXT DEFAULT '',
  seller TEXT DEFAULT '',
  lc INTEGER DEFAULT 0,
  bsh TEXT DEFAULT '' ,
  bid INTEGER DEFAULT 0,
  tid TEXT DEFAULT '' ,
  lock_block INTEGER DEFAULT 0,
  UNIQUE (nft_id),
  PRIMARY KEY(id ASC)
);

