# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2025-12-01)

- **Value Preservation Validation**: Implemented fundamental blockchain rule enforcement
  - Created modular validation system in `src/validation/` directory
  - `ValidationResult` interface for consistent error handling across validation rules
  - `validateValuePreservation()` function checks the equation: `inputs + minted = outputs + fee + burned`
  - Detailed error messages showing exactly how much value is being created/destroyed
  - Prevents both ADA creation and destruction attacks
  - Added comprehensive test suite in `tests/value-preservation.test.ts` (4 tests)
    - Manual transaction construction tests for edge cases (creating/destroying ADA)
    - TxBuilder test demonstrating automatic balancing and value preservation
- **Validation Architecture**: Structured validation system for future rules
  - `src/validation/types.ts`: Common validation types and helpers
  - `src/validation/valuePreservation.ts`: Value preservation implementation
  - `src/validation/index.ts`: Central export point for validation modules

### Added (2025-12-01 - Previous)

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

- **Validation System Refactoring**: Improved error reporting and validation flow
  - `validateTx()` now returns `ValidationResult` instead of boolean for detailed error messages
  - `submitTx()` now returns specific validation error messages instead of generic "failed phase-1 validation"
  - Made `validateTx()`, `processTx()`, `updateLedger()`, `awaitBlock()`, and `awaitSlot()` async for proper validation flow
  - All phase-1 validation checks now return detailed error messages through `ValidationResult`

### Changed (2025-12-01 - Previous)

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
- **After test suite fixes**: 37/37 tests passing (100%)
- **After value preservation**: 41/41 tests passing (100%)
- **Test Suites**: 5/5 passing

### Code Changes
- **Files Created**: 6 (experiments.ts, CHANGELOG.md, validation/types.ts, validation/valuePreservation.ts, validation/index.ts, value-preservation.test.ts)
- **Files Modified**: 6 (queue.ts, Emulator.ts, emulator.test.ts, README.md, TODO.md, CHANGELOG.md)
- **Lines Added**: ~650
- **Issues Resolved**: 9 critical issues (8 test failures + 1 security vulnerability)

---

[Unreleased]: https://github.com/HarmonicLabs/pluts-emulator/compare/v0.0.1-dev10...HEAD
[0.0.1-dev10]: https://github.com/HarmonicLabs/pluts-emulator/releases/tag/v0.0.1-dev10
