'use strict';
// Standard PostgreSQL wire protocol via postgres.js; no vendor-specific connector.
let client;
function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!client) {
    const postgres = require('postgres');
    client = postgres(process.env.DATABASE_URL, {
      max: 3, idle_timeout: 20, connect_timeout: 7,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
      prepare: true
    });
  }
  return client;
}
function isConfigured() { return Boolean(process.env.DATABASE_URL); }
async function close() { if(client) await client.end({timeout:5});client=null; }
async function leaderboard(game='perfect-guess',limit=20) {
  const sql=database();if(!sql)return null;
  return sql.unsafe(
    'SELECT display_name,best_score,source,updated_at FROM public_leaderboard WHERE game=$1 ORDER BY best_score ASC,updated_at ASC LIMIT $2',
    [game, Math.min(100,Math.max(1,limit))]);
}
async function upsertBest({uid,name,score}) {
  const sql=database();if(!sql)return null;
  const rows=await sql.unsafe(
    'INSERT INTO public_leaderboard(game,user_id,display_name,best_score) VALUES ($1,$2,$3,$4) ON CONFLICT(game,user_id) DO UPDATE SET best_score=LEAST(public_leaderboard.best_score,EXCLUDED.best_score),display_name=EXCLUDED.display_name,updated_at=now() RETURNING best_score',
    ['perfect-guess',uid,name,score]);
  return rows[0]?.best_score ?? null;
}
async function upsertAttempt({uid,attemptId,testId,exam,subject,score,total,correct,wrong,skipped,topics}) {
  const sql=database();if(!sql)return null;
  await sql.unsafe(
    'INSERT INTO test_analytics(user_id,attempt_id,test_id,exam,subject,score,possible_score,correct,wrong,skipped,topic_stats) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(user_id,attempt_id) DO UPDATE SET score=EXCLUDED.score,possible_score=EXCLUDED.possible_score,correct=EXCLUDED.correct,wrong=EXCLUDED.wrong,skipped=EXCLUDED.skipped,topic_stats=EXCLUDED.topic_stats',
    [uid,attemptId,testId,exam,subject,score,total,correct,wrong,skipped,JSON.stringify(topics||{})]);
  return true;
}
module.exports={database,isConfigured,leaderboard,upsertBest,upsertAttempt,close};
