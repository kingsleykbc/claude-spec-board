import { describe, expect, it } from 'vitest';
import * as pkg from '@specboard/core';

describe('F11: package entry', () => {
  it('imports from the workspace package name', () => {
    expect(typeof pkg.loadProject).toBe('function');
  });
});
