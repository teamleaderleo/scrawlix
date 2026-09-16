# Scrawlix extension icon

The first-store mark is the approved compact-slash design: a warm cream rounded tile, black censor bar, and compact red diagonal slash.

Production PNGs are generated during `pnpm --filter scrawlix-extension build` by `scripts/generate-icons.mjs` from normalized geometry in `scripts/icon-contract.mjs`. The contract pins the exact SHA-256 for the approved 16, 32, 48, and 128 px rasters; build validation and store-package verification reject artwork drift.

Do not replace the generated files with screenshots or resampled mockup crops. To revise the mark, change the normalized source geometry/colors deliberately, regenerate all sizes, review the real 16 px raster, and update the approved hashes together.
