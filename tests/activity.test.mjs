import test from 'node:test';
import assert from 'node:assert/strict';
import {activityContext,captureHealth,summarizeActivity} from '../shared/activity.mjs';
import {emptyState,observeActivity} from '../shared/core.mjs';

test('YouTube is recognized without treating arbitrary titles containing code as programming',()=>{
  assert.equal(activityContext('chrome','Da Vinci Code - YouTube').label,'YouTube');
  assert.equal(activityContext('chrome','Da Vinci Code - YouTube').category,'entertainment');
  assert.equal(activityContext('chrome','Code breaking news').category,'unknown');
  assert.equal(activityContext('Code','auth.ts').category,'coding');
});
test('actual games are distinguished from launchers and generic Java processes',()=>{
  for(const app of ['VALORANT-Win64-Shipping','cs2','dota2','RobloxPlayerBeta'])assert.equal(activityContext(app).detail,'Game');
  assert.equal(activityContext('steam').detail,'Game launcher');
  assert.equal(activityContext('javaw','Java application').detail,'Application');
  assert.equal(activityContext('javaw','Minecraft 1.21').detail,'Game');
});
test('capture status requires recent samples and respects pause, exclusions, lock, and stale data',()=>{
  const settings={activityEnabled:true};const now=100000;
  assert.equal(captureHealth(settings,{},now).state,'starting');
  assert.equal(captureHealth(settings,{lastSampleAt:now-2000,lastSample:{}},now).state,'active');
  assert.equal(captureHealth(settings,{lastSampleAt:now-20000},now).state,'error');
  assert.equal(captureHealth(settings,{lastSampleAt:now,lastSample:{excluded:true}},now).state,'excluded');
  assert.equal(captureHealth({...settings,paused:true},{lastSampleAt:now},now).state,'paused');
  assert.equal(captureHealth(settings,{suspended:true},now).state,'away');
});
test('daily summary groups browser sessions by site and clips midnight and future timestamps',()=>{
  const sessions=[{app:'chrome',title:'One - YouTube',start:'2026-09-07T23:50:00',end:'2026-09-08T00:10:00'},
    {app:'chrome',title:'Two - YouTube',start:'2026-09-08T00:10:00',end:'2026-09-08T00:20:00'},
    {app:'Code',title:'work',start:'2026-09-08T00:20:00',end:'2026-09-08T01:00:00'}];
  const summary=summarizeActivity(sessions,'2026-09-08',new Date('2026-09-08T00:25:00'));
  assert.equal(summary.totalSeconds,1500);assert.equal(summary.apps[0].label,'YouTube');assert.equal(summary.apps[0].seconds,1200);
});
test('title opt-out does not persist a site label inferred from the hidden title',()=>{
  const state=emptyState();state.settings.activityEnabled=true;
  observeActivity(state,{app:'chrome',title:'Private video - YouTube',idleSeconds:0});
  assert.equal(state.sessions[0].title,'');assert.equal(state.sessions[0].label,'chrome');
});
