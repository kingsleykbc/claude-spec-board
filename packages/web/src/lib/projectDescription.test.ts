import { describe, expect, it } from 'vitest';
import { projectDescription } from './projectDescription';

describe('projectDescription', () => {
  it('keeps only the text before the first ## heading', () => {
    expect(projectDescription('A **recipe** app.\n\nSecond line.\n\n## Stack\nReact\n\n## Design\nWarm\n')).toBe('A **recipe** app.\n\nSecond line.');
  });
  it('keeps the whole body without a ## heading, trimmed', () => {
    expect(projectDescription('\n  Just a description.\n\n')).toBe('Just a description.');
  });
  it('is empty when the body starts with a section', () => {
    expect(projectDescription('## Stack\nReact')).toBe('');
  });
  it('does not cut at ### or a # inside text', () => {
    expect(projectDescription('Intro with C# code\n\n### Detail\nmore')).toBe('Intro with C# code\n\n### Detail\nmore');
  });
});
