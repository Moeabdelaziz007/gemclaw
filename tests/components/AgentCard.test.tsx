import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React from 'react';

// Setup JSDOM globally
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost'
});
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// FIX React is not defined: Add React to global object
global.React = React;

import { render, fireEvent, cleanup } from '@testing-library/react';
import { AgentCard } from '../components/ui/AgentCard';

test('AgentCard component', async (t) => {
  t.afterEach(() => {
    cleanup();
  });

  await t.test('renders with default props', () => {
    const { getByText, container } = render(<AgentCard name="Nexus" status="sleeping" />);
    assert.ok(getByText('Nexus'));
    assert.ok(getByText('General Intelligence'));
    assert.ok(getByText('sleeping'));

    // Check color map (cyan gradient by default)
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-cyan-500'));

    // Check status color map
    const statusDotElement = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
    assert.ok(statusDotElement?.className.includes('bg-slate-500'));
  });

  await t.test('renders custom role and status', () => {
    const { getByText, container } = render(
      <AgentCard
        name="Atlas"
        status="working"
        role="Data Analyst"
        color="purple"
      />
    );
    assert.ok(getByText('Atlas'));
    assert.ok(getByText('Data Analyst'));
    assert.ok(getByText('working'));

    // Check custom color map
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-purple-500'));

    // Check working status dot and pulse animation
    const statusDotElement = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
    assert.ok(statusDotElement?.className.includes('bg-amber-500'));
    assert.ok(statusDotElement?.className.includes('animate-pulse'));

    // Verify waveform visualization is present since it's "working"
    const waveformContainer = container.querySelector('.absolute.-bottom-6');
    assert.ok(waveformContainer !== null);
  });

  await t.test('renders connected status with emerald color', () => {
    const { getByText, container } = render(
      <AgentCard
        name="Zephyr"
        status="connected"
        role="Network Operations"
        color="emerald"
      />
    );
    assert.ok(getByText('Zephyr'));
    assert.ok(getByText('Network Operations'));
    assert.ok(getByText('connected'));

    // Check custom color map
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-emerald-500'));

    // Check connected status dot (no pulse)
    const statusDotElement = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
    assert.ok(statusDotElement?.className.includes('bg-emerald-500'));
    assert.strictEqual(statusDotElement?.className.includes('animate-pulse'), false);

    // Verify waveform visualization is present since it's "connected"
    const waveformContainer = container.querySelector('.absolute.-bottom-6');
    assert.ok(waveformContainer !== null);
  });

  await t.test('calls onClick handler', () => {
    let clicked = false;
    const { container } = render(
      <AgentCard
        name="Nexus"
        status="sleeping"
        onClick={() => { clicked = true; }}
      />
    );

    const card = container.querySelector('.group');
    if (card) {
      fireEvent.click(card);
    }
    assert.strictEqual(clicked, true);
  });

  await t.test('renders without crashing when onClick is not provided', () => {
    // Should not throw when no onClick is given
    const { container } = render(<AgentCard name="Solo" status="sleeping" />);
    const card = container.querySelector('.group');
    assert.ok(card !== null, 'Card should render');
    // Clicking without handler should not throw
    assert.doesNotThrow(() => {
      if (card) fireEvent.click(card);
    });
  });

  await t.test('sleeping status renders no waveform visualization', () => {
    const { container } = render(
      <AgentCard name="Dormant" status="sleeping" />
    );
    const waveformContainer = container.querySelector('.absolute.-bottom-6');
    assert.strictEqual(waveformContainer, null, 'Waveform should not render for sleeping status');
  });

  await t.test('working status has animate-pulse on status dot', () => {
    const { container } = render(
      <AgentCard name="Busy" status="working" />
    );
    const statusDot = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
    assert.ok(statusDot?.className.includes('animate-pulse'), 'Working status dot should animate-pulse');
    assert.ok(statusDot?.className.includes('bg-amber-500'), 'Working status dot should be amber');
  });

  await t.test('connected status renders no animate-pulse on status dot', () => {
    const { container } = render(
      <AgentCard name="Online" status="connected" />
    );
    const statusDot = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
    assert.ok(statusDot?.className.includes('bg-emerald-500'), 'Connected status dot should be emerald');
    assert.strictEqual(statusDot?.className.includes('animate-pulse'), false, 'Connected status dot should not animate-pulse');
  });

  await t.test('cyan color renders from-cyan-500 gradient', () => {
    const { container } = render(
      <AgentCard name="Cyan Agent" status="sleeping" color="cyan" />
    );
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-cyan-500'), 'Cyan color should render from-cyan-500 gradient');
    assert.ok(blurElement?.className.includes('to-blue-600'), 'Cyan color should render to-blue-600 gradient');
  });

  await t.test('purple color renders from-purple-500 gradient', () => {
    const { container } = render(
      <AgentCard name="Purple Agent" status="sleeping" color="purple" />
    );
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-purple-500'), 'Purple color should render from-purple-500 gradient');
  });

  await t.test('emerald color renders from-emerald-500 gradient', () => {
    const { container } = render(
      <AgentCard name="Emerald Agent" status="sleeping" color="emerald" />
    );
    const blurElement = container.querySelector('.bg-gradient-to-br');
    assert.ok(blurElement?.className.includes('from-emerald-500'), 'Emerald color should render from-emerald-500 gradient');
  });

  await t.test('displays custom role when provided', () => {
    const { getByText } = render(
      <AgentCard name="Vector" status="sleeping" role="Security Monitor" />
    );
    assert.ok(getByText('Security Monitor'), 'Custom role should be rendered');
  });

  await t.test('working status shows waveform with 5 bars', () => {
    const { container } = render(
      <AgentCard name="Pulse" status="working" />
    );
    const waveformContainer = container.querySelector('.absolute.-bottom-6');
    assert.ok(waveformContainer !== null, 'Waveform container should exist for working status');
    // Each bar is a motion.div with w-1 class
    const bars = waveformContainer?.querySelectorAll('.w-1.rounded-full');
    assert.strictEqual(bars?.length, 5, 'Waveform should have exactly 5 bars');
  });
});
