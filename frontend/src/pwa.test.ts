import indexHtml from '../index.html?raw';
import manifestText from '../public/manifest.webmanifest?raw';

// Files under public/ are served from the site root.
const publicFiles = new Set(
  Object.keys(import.meta.glob('../public/**/*', { query: '?url' })).map((p) =>
    p.replace('../public', ''),
  ),
);

type Manifest = {
  name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; purpose?: string }[];
};

describe('PWA manifest', () => {
  const manifest = JSON.parse(manifestText) as Manifest;

  test('installs as "Tomo Gym", standalone, starting at the app root', () => {
    expect(manifest.name).toBe('Tomo Gym');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  test('has 192px, 512px and maskable icons that exist', () => {
    const sizes = manifest.icons.map(
      (i) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`,
    );
    expect(sizes).toEqual(['192x192', '512x512', '512x512 maskable']);
    for (const icon of manifest.icons) {
      expect(publicFiles, icon.src).toContain(icon.src);
    }
  });

  test('index.html links the manifest, icons and a notch-aware viewport', () => {
    expect(indexHtml).toContain('href="/manifest.webmanifest"');
    expect(indexHtml).toContain('viewport-fit=cover');
    for (const href of indexHtml.matchAll(/<link [^>]*href="(\/[^"]+)"/g)) {
      expect(publicFiles, href[1]).toContain(href[1]);
    }
  });
});
