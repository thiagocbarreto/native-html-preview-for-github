import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

interface BrandColor {
  base: string;
  dark: string;
  light: string;
  name: string;
}

interface BrandDefinition {
  colors: {
    brand: Record<string, BrandColor>;
    standard: { version: number };
  };
  logo: { source: string };
  source: { standardPaletteVersion: number };
}

const root = new URL('../../', import.meta.url);
const brand = JSON.parse(
  await readFile(new URL('brand.json', root), 'utf8')
) as BrandDefinition;

function pngDimensions(data: Buffer): { height: number; width: number } {
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

test('brand defines two colors with three shades each', () => {
  assert.deepEqual(Object.keys(brand.colors.brand).sort(), [
    'primary',
    'secondary',
  ]);
  for (const color of Object.values(brand.colors.brand)) {
    assert.deepEqual(Object.keys(color).sort(), [
      'base',
      'dark',
      'light',
      'name',
    ]);
    for (const shade of [color.light, color.base, color.dark]) {
      assert.match(shade, /^#[0-9A-F]{6}$/);
    }
  }
  assert.equal(
    brand.source.standardPaletteVersion,
    brand.colors.standard.version
  );
});

test('brand assets use the selected colors', async () => {
  const assets = await Promise.all(
    [
      'assets/icon.svg',
      'assets/store/promo-small.svg',
      'sidepanel/sidepanel.css',
    ].map((path) => readFile(new URL(path, root), 'utf8'))
  );
  for (const source of assets) {
    for (const color of Object.values(brand.colors.brand)) {
      assert.ok(source.toUpperCase().includes(color.base));
    }
  }

  const logo = await readFile(new URL(brand.logo.source, root), 'utf8');
  for (const role of ['background', 'primary', 'secondary']) {
    assert.match(logo, new RegExp(`data-brand-role="${role}"`));
  }
});

test('manifest icons match their declared pixel sizes', async () => {
  for (const size of [16, 32, 48, 128]) {
    const path = new URL(`assets/icons/icon-${size}.png`, root);
    await access(path);
    assert.deepEqual(pngDimensions(await readFile(path)), {
      width: size,
      height: size,
    });
  }
});
