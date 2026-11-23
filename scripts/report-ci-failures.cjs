'use strict';
// Report only the *names* of failed public tests on the commit status;
// never transmit the complete test log or environment variables.
const fs=require('node:fs');
(async()=>{
 const token=process.env.GH_TOKEN,repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA;
 if(!token||!repo||!sha||!/^[\w.-]+\/[\w.-]+$/.test(repo))return;
 let body='';
 try{body=fs.readFileSync('/tmp/portfolio-test-output.log','utf8')}catch{}
 const fails=[...body.matchAll(/^not ok\s+\d+\s+-\s+([^\r\n]+)/gm)].map(m=>m[1].trim());
 const description=(fails.length?fails.slice(0,4).join(' | '):'Test suite failed; inspect Actions output').slice(0,139);
 const response=await fetch('https://api.github.com/repos/'+repo+'/statuses/'+sha,{
  method:'POST',
  headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
  body:JSON.stringify({state:'failure',context:'ci/test-failure-diagnostics',description})
 });
 console.log(response.ok?'Failure names attached to commit status.':'Could not attach failure names ('+response.status+').');
})().catch(e=>{console.error('Diagnostic reporting unavailable:',e.message)});
