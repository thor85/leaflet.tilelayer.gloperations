# Changelog

## [Unreleased]

## [0.3.0]

### Added

- New options to specify max length of color scale and sentinels:
  - `colorscaleMaxLength` (default: 16)
  - `sentinelMaxLength` (default: 16)
- New option required when using contours: `contourPane` specifies Leaflet pane containing the contour canvas. Necessary addition to fix positioning of canvas when using fractional zoom.

### Changed

- Workaround to remove dependency on 'OES_texture_float' extension.

## [0.2.0]

### Added

- Option to smooth contour input data
  - Set `contourSmoothInput` to enable
  - Set the convolution kernel size with `contourSmoothInputKernel`

### Changed

- `contourSmooth` option changed name to `contourSmoothLines`.

## [0.1.1]

### Added

- Initial release

[unreleased]: https://github.com/equinor/leaflet.tilelayer.gloperations/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/equinor/leaflet.tilelayer.gloperations/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/equinor/leaflet.tilelayer.gloperations/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/equinor/leaflet.tilelayer.gloperations/releases/tag/v0.1.1
