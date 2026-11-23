'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Blunder dark mode never relies on off-white page text for pale product controls',()=>{
 const css=read('blunder/theme-layout-fixes.css');
 for(const target of ['.add-button','.quantity','.product-label','.product-card',
   '.category-card','.button-dark','.bag-trigger','.brand-ribbon',
   '.location-search-form input'])assert.ok(css.includes(target),target);
 assert.match(css,/html\[data-theme="dark"\] \.add-button,/);
 assert.match(css,/background: #eff5e8;\s*color: #17321f;/);
 assert.match(css,/html\[data-theme="dark"\] \.brand-ribbon span/);
});

test('Blunder mobile keeps both Portfolio and Search and all header actions accessible',()=>{
 const html=read('blunder/index.html');
 const css=read('blunder/theme-layout-fixes.css');
 assert.match(html,/class="blunder-back-link"/);
 assert.match(html,/class="search" role="search"/);
 assert.match(html,/theme-layout-fixes\.css\?v=/);
 assert.ok(html.indexOf('style.css')<html.indexOf('theme-layout-fixes.css'));
 assert.match(css,/grid-template-areas:\s*"brand actions"\s*"portfolio search"/);
 assert.match(css,/display: inline-flex !important/);
 assert.match(css,/@media \(max-width:370px\)/);
 assert.match(css,/"brand brand"\s*"actions actions"\s*"portfolio search"/);
 assert.match(css,/\.account-launcher-label,/);
});
