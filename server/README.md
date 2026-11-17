# OKUDESU ランキング用サーバー(Cloudflare Workers + D1)

PartlyRainy のランキングサーバーと同じ方式です。

- 公開先: https://okudesu-scores.haradadaisuke.workers.dev
- データベース: D1 `okudesu-scores`
- 上位100人まで、1人1件(ベストスコアだけ)を残します。100位に届かない記録は保存しません。
- 名前は普通の文字なら何でも(日本語なども可)、12文字まで。制御文字・< >・絵文字は取り除きます。

## API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/scores` | 上位100人と、100位の点数(`cutoff`) |
| POST | `/scores` | 登録。`{ name, score, planes, level, blocks, duration }` |

同じ端末からの登録は15秒に1回まで。同じ接続元から載せられる名前は3つまで。

## 変更したとき

```powershell
cd server
npx wrangler deploy
```

`protect.js`(書き換え対策の中身)は `.gitignore` に入れてあり、GitHub には上げません。

## 記録を消す

```powershell
npx wrangler d1 execute okudesu-scores --remote --command "DELETE FROM scores WHERE name = 'NAME'"
```
