import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';
import React from 'react';

// Make React globally available to components that don't import it
(global as any).React = React;

import NeuralPulse from '../../components/NeuralPulse';

test('NeuralPulse component', async (t) => {
  await t.test('renders without crashing', () => {
    const html = renderToString(<NeuralPulse />);
    assert.ok(html, 'Component should render successfully');
  });

  await t.test('renders the component title', () => {
    const html = renderToString(<NeuralPulse />);
    assert.ok(html.includes('Neural Pulse'), 'Should render "Neural Pulse" title');
  });

  await t.test('renders all heartbeat agents', () => {
    const html = renderToString(<NeuralPulse />);

    // Check for all agents defined in the component
    const expectedAgents = ['Atlas', 'System', 'Nova', 'Sovereign', 'Orion'];
    for (const agent of expectedAgents) {
      assert.ok(html.includes(agent), `Should render agent: ${agent}`);
    }
  });

  await t.test('renders expected actions and times', () => {
    const html = renderToString(<NeuralPulse />);

    // Check for a sample of actions and times
    assert.ok(html.includes('Neural Sync Complete'), 'Should render Atlas action');
    assert.ok(html.includes('just now'), 'Should render Atlas time');

    assert.ok(html.includes('Protocol V2.0 Active'), 'Should render Sovereign action');
    assert.ok(html.includes('12m ago'), 'Should render Sovereign time');
  });

  await t.test('applies key CSS classes for styling', () => {
    const html = renderToString(<NeuralPulse />);

    assert.ok(html.includes('glass-medium'), 'Should include glass-medium class for background');
    assert.ok(html.includes('gemigram-neon'), 'Should include gemigram-neon class for text/styling');
    assert.ok(html.includes('aether-carbon'), 'Should include aether-carbon class for heartbeat rows');
  });

  await t.test('renders icons and motion container', () => {
    const html = renderToString(<NeuralPulse />);

    // Lucide icons are rendered as SVGs
    assert.ok(html.includes('<svg'), 'Should render at least one SVG icon');
    assert.ok(html.includes('lucide'), 'Should render lucide icons');
  });

  await t.test('renders exactly 10 heartbeat entries (5 duplicated for infinite scroll)', () => {
    const html = renderToString(<NeuralPulse />);

    // Each beat has a unique agent name; Atlas appears twice (once per set)
    const atlasMatches = [...html.matchAll(/Atlas/g)];
    assert.strictEqual(atlasMatches.length, 2, 'Atlas should appear exactly twice (HEARTBEATS duplicated)');

    const orionMatches = [...html.matchAll(/Orion/g)];
    assert.strictEqual(orionMatches.length, 2, 'Orion should appear exactly twice');
  });

  await t.test('renders aether-carbon class on icon containers', () => {
    const html = renderToString(<NeuralPulse />);
    assert.ok(html.includes('aether-carbon'), 'Icon containers should use aether-carbon class');
  });

  await t.test('renders all 5 agent action strings', () => {
    const html = renderToString(<NeuralPulse />);

    const expectedActions = [
      'Neural Sync Complete',
      'gws: Gmail Indexing',
      'Memory Consolidation',
      'Protocol V2.0 Active',
      'Grounding: Google Search',
    ];

    for (const action of expectedActions) {
      assert.ok(html.includes(action), `Should render action: ${action}`);
    }
  });

  await t.test('renders all 5 time stamps', () => {
    const html = renderToString(<NeuralPulse />);

    const expectedTimes = ['just now', '2m ago', '5m ago', '12m ago', '15m ago'];
    for (const time of expectedTimes) {
      assert.ok(html.includes(time), `Should render time: ${time}`);
    }
  });

  await t.test('renders shading gradient overlays for fade effect', () => {
    const html = renderToString(<NeuralPulse />);

    // Top overlay
    assert.ok(html.includes('from-aether-carbon/80'), 'Should include top fade gradient');
    // Bottom overlay also uses from-aether-carbon/80 (with to-transparent)
    assert.ok(html.includes('to-transparent'), 'Should include fade-to-transparent class');
  });

  await t.test('renders overflow-hidden on the outer container', () => {
    const html = renderToString(<NeuralPulse />);
    assert.ok(html.includes('overflow-hidden'), 'Outer container should have overflow-hidden to clip animation');
  });

  await t.test('contains border styling for glass effect', () => {
    const html = renderToString(<NeuralPulse />);
    assert.ok(html.includes('border-white/10'), 'Component should include border-white/10 for glass styling');
  });
});
