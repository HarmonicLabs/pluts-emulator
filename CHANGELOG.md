# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2025-12-01)

- **Queue Methods**: Added `isEmpty()`, `size()`, and `asArray()` methods to the `Queue` class for better test compatibility
- **Test Helpers**: Created `src/experiments.ts` module with test utility functions:
  - `generateRandomTxHash(index)`: Generates predictable transaction hashes for testing
  - `createInitialUTxO()`: Creates individual UTxOs for the emulator
  - `createRandomInitialUtxos()`: Generates multiple random UTxOs with configurable amounts
- **Emulator API**: Added public accessors and methods:
  - `thisMempool` getter: Provides read access to the mempool queue
  - `printUtxo(utxo, debugLevel)`: Console logging for single UTxO inspection
  - `printUtxos(utxos, debugLevel)`: Console logging for multiple UTxOs inspection
- **Transaction Handling**: Improved oversized transaction detection and handling
  - Transactions larger than max block size are now properly rejected from mempool
  - Added warning message when skipping oversized transactions

### Changed (2025-12-01)

- **getUtxos() Return Type**: Changed from `UTxO[]` to `Map<TxOutRefStr, UTxO>` for consistency with internal storage and test expectations
- **Debug Logging**: Level 0 (errors) now uses `console.warn()` instead of `console.log()` for proper error visibility
- **Error Message**: Updated `awaitBlock()` error message to match "height" terminology (was "blocks")

### Fixed (2025-12-01)

- **Test Suite**: All 37 tests now pass (was 2/10 passing)
  - Fixed async/await handling in transaction submission tests
  - Fixed API mismatches between tests and implementation
  - Improved test mocking strategies for edge cases
- **Transaction Validation**: Added proper size validation during block processing
- **Promise Handling**: Fixed unhandled promise rejections in test suite

### Documentation (2025-12-01)

- Created comprehensive `README.md` with:
  - Project overview and feature list
  - Installation and usage instructions
  - API reference with code examples
  - Clear documentation of limitations vs real Cardano
  - Contributing guidelines
- Created detailed `TODO.md` tracking:
  - 24 prioritized improvement items
  - 6-phase implementation roadmap (20 weeks)
  - Success metrics for becoming "fully respected"
  - Technical debt and missing features

## [0.0.1-dev10] - Previous

### Note
This is the version before the recent test suite fixes. See git history for detailed changes prior to this point.

---

## Statistics

### Test Coverage Progress
- **Before fixes**: 2/10 tests passing (20%)
- **After fixes**: 37/37 tests passing (100%)
- **Test Suites**: 4/4 passing

### Code Changes
- **Files Created**: 2 (experiments.ts, CHANGELOG.md)
- **Files Modified**: 5 (queue.ts, Emulator.ts, emulator.test.ts, README.md, TODO.md)
- **Lines Added**: ~350
- **Issues Resolved**: 8 critical test failures

---

[Unreleased]: https://github.com/HarmonicLabs/pluts-emulator/compare/v0.0.1-dev10...HEAD
[0.0.1-dev10]: https://github.com/HarmonicLabs/pluts-emulator/releases/tag/v0.0.1-dev10
