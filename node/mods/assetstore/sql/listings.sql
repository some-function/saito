CREATE TABLE IF NOT EXISTS listings (
  id INTEGER DEFAULT '',
  nft_sig TEXT DEFAULT '',		// sig of the tx that listed the NFT for sale
  nft_id TEXT DEFAULT '',		// slip1 + slip3
  seller TEXT DEFAULT '',
  status INTEGER DEFAULT 0 , 		// 0 = unlisted
					// 1 = listed, waiting for NFT transfer
					// 2 = listed and active
					// 3 = payment received, transfer not completed
					// 4 = payment received, transfer completed
  UNIQUE(nft_sig) ,
  PRIMARY KEY(id ASC)
);

