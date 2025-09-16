CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nft_id TEXT DEFAULT '' ,			// NFT ID common to all NFTs (slip1 + slip3)
  nft_tx_sig TEXT DEFAULT '' ,			// NFT SHARD ID unique to this transferred
  status INTEGER DEFAULT 0 ,			// 0 => nft created, but not-active
						// 1 => nft received, active
						// 2 => nft sold, inactive
						// 3 => nft transferred, inactive
						// 4 => nft delisted, inactive
  seller TEXT DEFAULT '' ,
  buyer TEXT DEFAULT '' ,
  created_at INTEGER DEFAULT 0 ,
  reserve_price INTEGER DEFAULT 0
);

