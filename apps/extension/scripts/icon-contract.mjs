export const ICON_SIZES = [16, 32, 48, 128];

export const ICON_FILES = Object.freeze(
  Object.fromEntries(ICON_SIZES.map(size => [String(size), `icons/icon${size}.png`]))
);

export const APPROVED_ICON_SHA256 = Object.freeze({
  'icons/icon16.png': '81273f607d2f7e08eafabde5a7a32bc12878f2725447236904bf5111e2fac6fd',
  'icons/icon32.png': '035e9c2790796fe01fa55c113b06fc83b700fe7570ddf69a18c57881179519cd',
  'icons/icon48.png': '8254c8276b149edf149aa77fdada8faaba7943ca76d487b6e5904fabbea95b10',
  'icons/icon128.png': 'e16262c6683943354d6f7d007e9ab41c1942c925988ef280c1a852b91ce32ae0',
});

// Approved first-store "compact slash" mark. Geometry is normalized to the
// square canvas so every raster size comes from the same source of truth.
export const ICON_DESIGN = Object.freeze({
  colors: Object.freeze({
    cream: Object.freeze([244, 237, 223, 255]),
    ink: Object.freeze([19, 18, 15, 255]),
    red: Object.freeze([230, 55, 43, 255]),
    transparent: Object.freeze([0, 0, 0, 0]),
  }),
  tile: Object.freeze({
    left: 0.078,
    top: 0.078,
    width: 0.844,
    height: 0.844,
    radius: 0.205,
  }),
  bar: Object.freeze({
    left: 0.211,
    top: 0.414,
    width: 0.578,
    height: 0.18,
    radius: 0.055,
  }),
  slash: Object.freeze([
    Object.freeze([0.6, 0.29]),
    Object.freeze([0.64, 0.27]),
    Object.freeze([0.68, 0.34]),
    Object.freeze([0.65, 0.365]),
    Object.freeze([0.43, 0.72]),
    Object.freeze([0.38, 0.75]),
    Object.freeze([0.34, 0.68]),
    Object.freeze([0.37, 0.655]),
  ]),
});
