import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceViewFromHash, WORKSPACE_VIEWS } from './workspaceNavigation';
test('Globe is the landing destination for initial, invalid and retired navigation', () => {
  for (const hash of ['', '#', '#unknown', '#prediction-markets', '#quantphysics']) assert.equal(workspaceViewFromHash(hash),'globe');
});
test('Each supported workspace has a stable deep link for browser back and forward', () => {
  for (const view of WORKSPACE_VIEWS) assert.equal(workspaceViewFromHash(`#${view}`),view);
});
