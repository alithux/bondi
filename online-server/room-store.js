'use strict';
// Render Postgres-backed durable snapshots. This module is loaded only when
// DATABASE_URL is configured; ordinary tests do not require node-postgres.
class PostgresRoomStore {
  constructor({connectionString,Pool}={}){
    if(!connectionString)throw Error('DATABASE_URL is required for persistent BONDI rooms.');
    const Driver=Pool||require('pg').Pool;
    this.pool=new Driver({connectionString,max:3,connectionTimeoutMillis:6000,
      idleTimeoutMillis:20000});
  }
  async initialize(){
    await this.pool.query(`CREATE TABLE IF NOT EXISTS bondi_room_snapshots (
      room_code VARCHAR(6) PRIMARY KEY,
      revision BIGINT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }
  async loadAll(){
    const {rows}=await this.pool.query('SELECT room_code, payload FROM bondi_room_snapshots ORDER BY updated_at DESC LIMIT 200');
    return rows.map(row=>({code:row.room_code,payload:row.payload}));
  }
  async save(code,payload){
    await this.pool.query(`INSERT INTO bondi_room_snapshots(room_code, revision, payload, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (room_code) DO UPDATE SET revision=EXCLUDED.revision,
        payload=EXCLUDED.payload, updated_at=NOW()
      WHERE bondi_room_snapshots.revision <= EXCLUDED.revision`,
      [code,payload.revision,JSON.stringify(payload)]);
  }
  async remove(code){
    await this.pool.query('DELETE FROM bondi_room_snapshots WHERE room_code=$1',[code]);
  }
  async close(){await this.pool.end();}
}
module.exports={PostgresRoomStore};
