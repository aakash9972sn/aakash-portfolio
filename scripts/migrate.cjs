'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {database,close}=require('../src/db');
(async()=>{
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required to migrate.');
 const sql=database();
 const schema=fs.readFileSync(path.join(__dirname,'../src/db/schema.sql'),'utf8');
 await sql.unsafe(schema,[],{prepare:false});
 console.log('Portable SQL migrations applied.');
})().catch(e=>{console.error('Migration failed:',e.message);process.exitCode=1}).finally(()=>close());
