-- OKUDESU ランキング用のテーブル(Cloudflare D1)
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  planes     INTEGER NOT NULL,   -- 消した面の数
  level      INTEGER NOT NULL,
  blocks     INTEGER NOT NULL,   -- 置いたブロックの数
  duration   INTEGER NOT NULL,   -- プレイ時間(ミリ秒、ポーズ中は数えない)
  country    TEXT,
  created_at INTEGER NOT NULL,   -- 登録時刻(ミリ秒)
  ip_hash    TEXT    NOT NULL    -- 連続登録の制限に使う(IPそのものは保存しない)
);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_ip   ON scores (ip_hash, created_at DESC);
