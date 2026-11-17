// OKUDESU ランキング API(Cloudflare Workers + D1)  ※ PartlyRainy のサーバーと同じ方式
//   GET  /scores  → 上位100人(1人1件)と、100位の点数(cutoff)
//   POST /scores  → スコアを登録({ name, score, planes, level, blocks, duration })
// 名前: 普通の文字なら何でも(12文字まで)。
// 方針: 1人1件(ベストのみ)・上位100人だけを残す。100位以下の記録は保存しない。
// 不正対策は「簡易なもの」です(ブラウザから送る値は完全には信用できません)。
// 書き換え対策の細かい中身は、別ファイル protect.js に分けてある(非公開)。
import { extraValidate, ipLimit, insertStatement } from './protect.js';

const MAX_NAME = 12;               // 名前の最大文字数
const MIN_INTERVAL_MS = 15000;     // 同じ端末からの登録間隔の下限
const MAX_SCORE = 9999999;
const MAX_LIST = 100;              // ランキングに出す最大の件数(100位まで)

const TOP_SQL = `
  SELECT name, score, planes, level, created_at FROM scores
  ORDER BY score DESC, created_at ASC LIMIT ${MAX_LIST}`;

// 一覧と100位の点数は、しばらく使い回す(D1 の読み取りを減らすため)
const LIST_TTL_MS = 60000;
let listCache = null;   // { t, body }   body = { scores, cutoff }

const cutoffOf = scores => (scores.length >= MAX_LIST ? scores[MAX_LIST - 1].score : 0);

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes('*')) h['Access-Control-Allow-Origin'] = '*';
  else if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function reply(request, env, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env), ...extra },
  });
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 名前: 普通の文字なら何でもよい(日本語なども可)。全角英数を半角に寄せ、制御文字・見えない文字・< >・絵文字を取り除き、
// 連続する空白を1つにし、前後の空白を削って 12 文字まで(ゲーム側の cleanPlayerName と同じ規則)
function cleanName(v) {
  const s = String(v ?? '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u20E3]/gu, '')
    .replace(/\s+/g, ' ').trim();
  return [...s].slice(0, MAX_NAME).join('').trim();
}

const isInt = v => typeof v === 'number' && Number.isInteger(v) && v >= 0;

// 値のチェック。ゲーム側の規則(3面ごとにレベルが1上がる)から、ありえない組み合わせを弾く
function validate(b) {
  if (!b || typeof b !== 'object') return { error: 'bad_request' };
  const name = cleanName(b.name);
  if (!name) return { error: 'bad_name' };
  const { score, planes, level, blocks, duration } = b;
  if (![score, planes, level, blocks, duration].every(isInt)) return { error: 'bad_values' };
  if (blocks < 1 || blocks > 100000) return { error: 'bad_values' };
  if (score < 1 || score > MAX_SCORE) return { error: 'bad_score' };
  if (level !== Math.floor(planes / 3) + 1) return { error: 'bad_values' };
  const bad = extraValidate(b);   // ゲームの規則に合わない値を弾く(中身は protect.js)
  if (bad) return { error: bad };
  return { value: { name, score, planes, level, blocks, duration } };
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) { return reply(request, env, { error: 'unavailable' }, 503, { 'Cache-Control': 'no-store' }); }
  },
};

async function readTop(env) {
  const { results } = await env.DB.prepare(TOP_SQL).all();
  const body = { scores: results, cutoff: cutoffOf(results) };
  listCache = { t: Date.now(), body };
  return body;
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (url.pathname !== '/scores') return reply(request, env, { error: 'not_found' }, 404);

  // ---- 上位のスコア ----
  if (request.method === 'GET') {
    const hit = listCache;
    if (hit && Date.now() - hit.t < LIST_TTL_MS) return reply(request, env, hit.body, 200, { 'Cache-Control': 'public, max-age=30' });
    try {
      return reply(request, env, await readTop(env), 200, { 'Cache-Control': 'public, max-age=30' });
    } catch (e) {
      if (hit) return reply(request, env, hit.body, 200, { 'Cache-Control': 'no-store' });
      return reply(request, env, { error: 'unavailable' }, 503, { 'Cache-Control': 'no-store' });
    }
  }

  // ---- 登録 ----
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > 2000) return reply(request, env, { error: 'too_large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return reply(request, env, { error: 'bad_request' }, 400); }
    const v = validate(body);
    if (v.error) return reply(request, env, { error: v.error }, 400);
    const s = v.value;

    // 覚えている100位の点数以下なら、データベースを読まずに断る
    const known = listCache;
    if (known && Date.now() - known.t < LIST_TTL_MS && known.body.cutoff > 0 && s.score <= known.body.cutoff) {
      return reply(request, env, { error: 'below_cutoff', cutoff: known.body.cutoff }, 422);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await sha256((env.SALT || '') + ip);
    const now = Date.now();
    const last = await env.DB
      .prepare('SELECT created_at FROM scores WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1')
      .bind(ipHash).first();
    if (last && now - last.created_at < MIN_INTERVAL_MS) return reply(request, env, { error: 'too_fast' }, 429);
    const limited = await ipLimit(env.DB, ipHash, s.name);   // 接続元ごとの制限(中身は protect.js)
    if (limited) return reply(request, env, { error: limited }, 403);

    const { results: top } = await env.DB.prepare(TOP_SQL).all();
    const cutoff = cutoffOf(top);
    const mine = top.find(r => r.name.toLowerCase() === s.name.toLowerCase());
    let best = s.score, updated = false;
    if (mine && s.score <= mine.score) {
      best = mine.score;    // ベストを超えていない: 何も書かない
    } else if (!mine && cutoff > 0 && s.score <= cutoff) {
      listCache = { t: now, body: { scores: top, cutoff } };
      return reply(request, env, { error: 'below_cutoff', cutoff }, 422);
    } else {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM scores WHERE lower(name) = lower(?)').bind(s.name),
        insertStatement(env.DB, s, now, ipHash, request),
        env.DB.prepare(`DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, created_at ASC LIMIT ${MAX_LIST})`),
      ]);
      updated = true;
      listCache = null;
    }
    const rank = top.filter(r => r.score > best).length + 1;
    let newCutoff = cutoff;
    if (updated) newCutoff = (await readTop(env)).cutoff;
    return reply(request, env, { ok: true, rank, name: s.name, best, updated, cutoff: newCutoff });
  }

  return reply(request, env, { error: 'method_not_allowed' }, 405);
}
