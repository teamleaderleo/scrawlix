# Extension icon source

The first-store extension mark is the approved compact-slash design: a warm cream rounded tile, black censor bar, and compact red diagonal slash.

The production PNGs are generated during `pnpm --filter scrawlix-extension build` by `generate-icons.mjs` from normalized geometry in `icon-contract.mjs`. The contract also pins the exact SHA-256 for the approved 16, 32, 48, and 128 px rasters; both build validation and store-package verification reject artwork drift.

Do not replace the generated files with screenshots or resampled mockup crops. To revise the mark, change the normalized source geometry/colors deliberately, regenerate all sizes, review the real 16 px raster, then update the approved hashes together.
