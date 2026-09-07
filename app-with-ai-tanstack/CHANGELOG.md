# Changelog

## [5.1.1] - 2026-05-13

### Fixed
- TanStack Start HTTP 500 error on application startup
  - Added `getRouter()` function export required by SSR initialization
  - Pinned TanStack package versions to prevent dependency version conflicts
  - Resolves "TypeError: entries.routerEntry.getRouter is not a function"

## [5.1.0] - 2026-05-10

### Added
- Initial release with AI-powered code generation
