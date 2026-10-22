import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './tsModule.mjs';

const { MAIN_ROUTES, createRoutePreparation } = await loadTsModule('lib/routePreparation.ts');

test('route budget covers main tabs once, skips current route, never crawls lessons', () => {
  const preparation = createRoutePreparation(), calls = [];
  for (let i = 0; i < 20; i++) {
    const route = preparation.next('/');
    if (route) preparation.prepare(route, href => calls.push(href));
  }
  assert.deepEqual(calls, ['/settings/', '/learn/', '/dictionary/', '/translator/']);
  assert.equal(MAIN_ROUTES.length, 5);
  preparation.prepare('/settings', href => calls.push(href));
  assert.equal(calls.length, 4);
});

test('a failed speculative attempt is not retried, and navigation during warmup skips the new page', () => {
  const preparation = createRoutePreparation();
  preparation.prepare(preparation.next('/'), () => { throw new Error('WebKit aborted'); });
  assert.equal(preparation.next('/learn/'), '/dictionary/');
  preparation.prepare('/dictionary/', () => {});
  preparation.prepare('/translator/', () => {});
  assert.equal(preparation.next('/'), undefined);
});

test('a deep-link launch still prepares Home with a bounded budget', () => {
  const preparation = createRoutePreparation(), calls = [];
  let route;
  while ((route = preparation.next('/settings/preferences/'))) preparation.prepare(route, href => calls.push(href));
  assert.deepEqual(calls, MAIN_ROUTES);
});
