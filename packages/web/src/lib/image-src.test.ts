import { describe, expect, it } from 'vitest';
import { dirOf, imageSrc, specImageDir } from './image-src';

describe('imageSrc', () => {
  it('lets web images load as they are', () => {
    expect(imageSrc('p', 'https://x/y.png')).toEqual({ kind: 'img', url: 'https://x/y.png' });
    expect(imageSrc('p', 'http://x/y.png', 'd')).toEqual({ kind: 'img', url: 'http://x/y.png' });
  });

  it('sends a relative path through the image route', () => {
    expect(imageSrc('p', 'images/a.png', '.specboard/specs/T-001-x')).toEqual({
      kind: 'img',
      url: '/api/projects/p/image?path=.specboard%2Fspecs%2FT-001-x%2Fimages%2Fa.png',
    });
  });

  it('decodes the path once, then encodes it', () => {
    expect(imageSrc('p', 'images/my%20shot.png', 'd')).toEqual({ kind: 'img', url: '/api/projects/p/image?path=d%2Fimages%2Fmy%20shot.png' });
    expect(imageSrc('p', 'images/my shot.png', 'd')).toEqual({ kind: 'img', url: '/api/projects/p/image?path=d%2Fimages%2Fmy%20shot.png' });
    expect(imageSrc('p', 'a%2520b.png', 'd').url).toBe('/api/projects/p/image?path=d%2Fa%2520b.png');
  });

  it('resolves ../ against the folder of a reference', () => {
    expect(imageSrc('p', '../img/a.png', 'docs/sub')).toEqual({ kind: 'img', url: '/api/projects/p/image?path=docs%2Fimg%2Fa.png' });
    expect(imageSrc('p', './a.png', 'docs')).toEqual({ kind: 'img', url: '/api/projects/p/image?path=docs%2Fa.png' });
  });

  it('stays a link when the path leaves the project', () => {
    expect(imageSrc('p', '../../../x.png', 'docs')).toEqual({ kind: 'link', url: '../../../x.png' });
  });

  it('stays a link with no folder to resolve against', () => {
    expect(imageSrc('p', 'images/a.png')).toEqual({ kind: 'link', url: 'images/a.png' });
  });

  it.each(['', 'data:image/png;base64,AA', 'file:///etc/x.png', 'javascript:alert(1)', 'C:/x.png', '/abs/x.png', '//host/x.png', '%E0%A4%A.png'])(
    'stays a link for %j',
    (src) => {
      expect(imageSrc('p', src, 'd')).toEqual({ kind: 'link', url: src });
    },
  );
});

describe('specImageDir', () => {
  it('cuts an absolute or relative spec folder down to its project-relative form', () => {
    expect(specImageDir(['C:', 'Users', 'k', 'proj', '.specboard', 'specs', 'T-001-x'].join(String.fromCharCode(92)))).toBe('.specboard/specs/T-001-x');
    expect(specImageDir('/home/k/proj/.specboard/archive/T-100-old/')).toBe('.specboard/archive/T-100-old');
    expect(specImageDir('examples/recipe-box/.specboard/specs/T-101-a')).toBe('.specboard/specs/T-101-a');
    expect(specImageDir('somewhere/else')).toBeUndefined();
  });
});

describe('dirOf', () => {
  it('gives the folder of a project-relative file', () => {
    expect(dirOf('docs/sub/x.md')).toBe('docs/sub');
    expect(dirOf('README.md')).toBe('');
  });
});
