# TODO: Improvements for Pluts Emulator

This document tracks improvements needed to make Pluts Emulator a fully respected Cardano blockchain emulator.

## Status Overview

- **Current State**: Basic UTxO testing for simple scripts - Test suite now fully functional ✅
- **Test Coverage**: 100% tests passing (37/37 tests pass, 4/4 test suites)
- **Ledger Rules**: ~5 of 50+ implemented
- **Production Ready**: No

---

## Recently Completed (2025-12-01)

### ✅ Phase 1: Test Suite Fixes
**Status**: COMPLETED

Fixed all broken tests and API mismatches:
- Created missing `src/experiments.ts` with test helper functions
- Added missing Queue methods: `isEmpty()`, `size()`, `asArray()`
- Added `thisMempool` getter to expose mempool in Emulator
- Added `printUtxo()` and `printUtxos()` console logging methods
- Fixed `getUtxos()` to return Map instead of array
- Fixed `debug()` method to use `console.warn()` for errors
- Added proper handling for oversized transactions
- Fixed all async/await issues in tests
- Improved test robustness with proper mocking

**Files Modified:**
- `src/queue.ts` - Added isEmpty(), size(), asArray()
- `src/experiments.ts` - Created new file with generateRandomTxHash(), createInitialUTxO(), createRandomInitialUtxos()
- `src/Emulator.ts` - Added thisMempool getter, printUtxo/printUtxos methods, fixed getUtxos(), improved debug logging
- `tests/emulator.test.ts` - Fixed async/await, improved mocking, fixed API calls

**Result**: All 37 tests now pass ✅

---

## Critical Issues (Fix Immediately)

### 1. ✅ Fix Broken Test Suite - COMPLETED

**Priority**: 🔴 CRITICAL → ✅ DONE

**Issues:** (ALL RESOLVED)
- ~~Missing file: `src/experiments.ts`~~ ✅ Created
- ~~`Queue` class missing methods~~ ✅ Added isEmpty(), size(), asArray()
- ~~API mismatches in tests~~ ✅ Added thisMempool, printUtxo(), printUtxos()
- ~~`getUtxos()` returns wrong type~~ ✅ Now returns Map
- ~~Async/await issues~~ ✅ Fixed all promise handling

**Result**: All 37 tests passing ✅

**Action Items:**
- [x] Create `src/experiments.ts` with test helper functions
- [x] Add missing methods to `Queue` class in `src/queue.ts`
- [x] Fix test API calls to match actual implementation
- [x] Ensure all tests pass
- [x] Fix async/await issues in tests
- [x] Improve error handling and logging

**Files Affected:**
- `src/queue.ts` ✅
- `src/experiments.ts` ✅
- `src/Emulator.ts` ✅
- `tests/emulator.test.ts` ✅

---

### 2. Fee Validation Not Enforced

**Priority**: 🔴 CRITICAL
**Location**: `src/Emulator.ts:409-429`

**Issue:**
The `calculateMinFee()` method exists but is **NEVER CALLED**. Transactions can be submitted with zero fees, which would never work on real Cardano.

```typescript
private calculateMinFee(tx: Tx): bigint {
    // Implementation exists but unused!
}
```

**Action Items:**
- [ ] Call `calculateMinFee()` in transaction validation
- [ ] Reject transactions with `fee < minFee`
- [ ] Add test cases for minimum fee validation
- [ ] Test edge cases (0 fee, insufficient fee, exact fee)

**Files Affected:**
- `src/Emulator.ts:409-429` (use the method)
- `src/Emulator.ts:~600` (add validation in `submitTx`)

---

### 3. Missing Value Preservation Check

**Priority**: 🔴 CRITICAL

**Issue:**
The fundamental blockchain rule is missing:
```
inputs_value = outputs_value + fee + minted - burned
```

Without this, the emulator accepts transactions that create or destroy ADA out of thin air.

**Action Items:**
- [ ] Implement `validateValuePreservation()` method
- [ ] Sum all input values
- [ ] Sum all output values
- [ ] Account for minting (add to outputs)
- [ ] Account for burning (add to inputs)
- [ ] Verify: `inputs + minted = outputs + burned + fee`
- [ ] Add comprehensive test cases
- [ ] Test with token minting/burning

**Files Affected:**
- `src/Emulator.ts` (new validation method)

---

### 4. Fix Incorrect Slot Calculation

**Priority**: 🔴 CRITICAL
**Location**: `src/Emulator.ts:590, 623`

**Issue:**
```typescript
this.slot += blocks * (this.genesisInfos.slotLengthMs * 20 / 1000);
// Comment: "Not sure where to compute the 20 from"
```

Magic number "20" indicates incorrect slot/time calculation. In Cardano:
- 1 slot = 1 second (Shelley onwards)
- 1 epoch = ~432,000 slots (5 days)
- This appears to confuse slots with something else

**Action Items:**
- [ ] Research correct Cardano slot/epoch/time formulas
- [ ] Remove magic number "20"
- [ ] Implement correct slot advancement
- [ ] Add epoch tracking
- [ ] Test slot-to-time conversions
- [ ] Verify against Cardano mainnet behavior

**Files Affected:**
- `src/Emulator.ts:590, 623`

---

### 5. Add Documentation

**Priority**: 🔴 CRITICAL

**Issue:**
No user-facing documentation exists. Developers cannot understand how to use the emulator.

**Action Items:**
- [x] Create `README.md` with:
  - [x] Project overview
  - [x] Installation instructions
  - [x] Usage examples
  - [x] API reference
  - [x] Limitations vs real Cardano
  - [x] Contributing guide
- [x] Create `TODO.md` (this file)
- [ ] Add JSDoc comments to all public methods
- [ ] Create examples directory with:
  - [ ] Simple UTxO transaction
  - [ ] Plutus script execution
  - [ ] Multi-input transaction
  - [ ] Datum handling
- [ ] Architecture documentation

---

## Major Missing Features

### 6. Transaction Validation Rules

**Priority**: 🟠 HIGH

Currently only **5 validation rules** are implemented. Real Cardano has **50+**. Missing:

#### Missing Input/Output Validation
- [ ] **Minimum Ada per UTxO**: Calculate and enforce based on output size
  - Formula: `minUTxO = (utxoEntrySizeWithoutVal + size(Value)) × coinsPerUTxOByte`
  - Reject outputs below minimum
  - Test with various output sizes

- [ ] **Asset Policy Validation**: Check minting/burning policies
  - Verify policy scripts execute successfully
  - Check policy signatures
  - Enforce one-time minting policies

- [ ] **Reference Input Validation**: Validate read-only inputs
  - Check reference inputs exist
  - Ensure reference inputs not spent
  - Verify reference scripts available
  - **Note**: Structure exists (TODO at line 897)

#### Missing Time/Validity Validation
- [ ] **Validity Interval Checks**: Enforce transaction timeouts
  - Check `validityIntervalStart <= currentSlot`
  - Check `currentSlot <= ttl` (time-to-live)
  - Reject expired transactions
  - Test boundary conditions

- [ ] **Timeout Handling**: Remove expired transactions from mempool
  - Periodic cleanup of stale transactions
  - Return expired transactions to user

#### Missing Script Validation
- [ ] **Redeemer Presence**: Ensure all script inputs have redeemers
- [ ] **Script Data Hash Validation**: Verify integrity
- [ ] **Required Signers**: Check all required signatures present
  - Extract from script context
  - Verify against transaction witnesses

- [ ] **Native Script Support**: Implement native script types
  - Multisig (M-of-N)
  - Timelock (before/after slot)
  - Combined native scripts
  - Test all combinations

#### Missing Minting/Burning
- [ ] **Token Minting Validation**
  - Execute minting policy scripts
  - Verify policy witnesses
  - Update value preservation calculation

- [ ] **Token Burning Validation**
  - Verify burned tokens exist in inputs
  - Update value preservation calculation
  - Test with various token types

#### Missing Metadata
- [ ] **Transaction Metadata Support**
  - Store metadata in processed transactions
  - Validate metadata hash
  - Provide metadata query API
  - Test with various metadata sizes

#### Missing Witness Validation
- [ ] **Signature Verification** (VKey witnesses)
  - Extract required signers from inputs
  - Verify signatures against witnesses
  - Check payment key signatures
  - Check stake key signatures

- [ ] **Bootstrap Witnesses**: Support Byron-era addresses
- [ ] **Script Witnesses Completeness**: Ensure all scripts present

#### Missing Fee Validation
- [x] Minimum fee check (see #2 above)
- [ ] **Execution Unit Limits**
  - Track memory usage during script execution
  - Track CPU steps during script execution
  - Enforce protocol parameter limits
  - Calculate accurate fees based on execution units

- [ ] **Script Execution Cost Accounting**
  - Sum costs across all script executions
  - Include in fee calculation
  - Test with expensive scripts

**Files Affected:**
- `src/Emulator.ts` (new validation methods)
- `src/validation/` (new directory recommended)

---

### 7. Certificate Support

**Priority**: 🟠 HIGH
**Location**: `src/Emulator.ts:326, 776`

**Status**: "Not implemented yet. TODO"

**Action Items:**
- [ ] Implement certificate validation
- [ ] Process certificate effects on ledger:
  - [ ] Stake key registration
  - [ ] Stake key deregistration
  - [ ] Stake delegation
  - [ ] Pool registration
  - [ ] Pool retirement
  - [ ] Genesis delegation
- [ ] Track registered stake keys
- [ ] Track active stake pools
- [ ] Update pretty print to show certificates
- [ ] Add comprehensive certificate tests

**Files Affected:**
- `src/Emulator.ts:326` (pretty print)
- `src/Emulator.ts:776` (processing)
- `src/types/StakeAddressInfos.ts` (expand)

---

### 8. Staking & Delegation

**Priority**: 🟠 HIGH
**Location**: `src/Emulator.ts:763`

**Status**: "We're not really putting rewards in the accounts so far"

**Action Items:**
- [ ] Implement reward calculation
  - [ ] Per-epoch reward distribution
  - [ ] Pool margin and costs
  - [ ] Stake pool performance

- [ ] Stake pool registration
  - [ ] Pool metadata
  - [ ] Pool costs and margin
  - [ ] Pool operator rewards

- [ ] Delegation tracking
  - [ ] Map stake keys to pools
  - [ ] Track delegation certificates
  - [ ] Update on certificate processing

- [ ] Reward withdrawal verification
  - [ ] Check withdrawal amounts against earned rewards
  - [ ] Update reward accounts on withdrawal

- [ ] Test complete staking lifecycle
  - [ ] Register stake key
  - [ ] Register pool
  - [ ] Delegate to pool
  - [ ] Earn rewards
  - [ ] Withdraw rewards
  - [ ] Deregister

**Files Affected:**
- `src/Emulator.ts:763` (reward distribution)
- `src/types/StakeAddressInfos.ts` (expand structure)

---

### 9. Reference Scripts

**Priority**: 🟡 MEDIUM
**Location**: `src/Emulator.ts:897`

**Status**: "TODO: Check on an example with refScript"

**Action Items:**
- [ ] Complete reference script support
- [ ] Validate reference scripts in inputs
- [ ] Allow script execution from reference UTxOs
- [ ] Test with actual reference script examples
- [ ] Document reference script usage

**Files Affected:**
- `src/Emulator.ts:897` (validation logic)

---

### 10. Governance Features

**Priority**: 🟡 MEDIUM

**Issue**: No Conway-era governance support

**Action Items:**
- [ ] CIP-1694 governance actions
  - [ ] Proposal submission
  - [ ] Voting mechanism
  - [ ] Voting power calculation

- [ ] Governance voting
  - [ ] SPO votes
  - [ ] DRep votes
  - [ ] Constitutional committee votes

- [ ] Treasury management
  - [ ] Treasury withdrawals
  - [ ] Treasury donations

- [ ] Protocol parameter updates
  - [ ] Proposal mechanism
  - [ ] Voting and ratification
  - [ ] Parameter updates on epoch boundary

**Files Affected:**
- `src/Emulator.ts` (new governance logic)
- New files in `src/governance/`

---

### 11. Multi-Era Support

**Priority**: 🟡 MEDIUM

**Issue**: Single protocol parameter set, no era-specific logic

**Action Items:**
- [ ] Implement era tracking (Byron, Shelley, Allegra, Mary, Alonzo, Babbage, Conway)
- [ ] Era-specific validation rules
- [ ] Hard fork simulation
  - [ ] Epoch-based era transitions
  - [ ] Protocol parameter updates
  - [ ] Feature activation

- [ ] Era-specific transaction formats
- [ ] Backward compatibility tests
- [ ] Test transactions across era boundaries

**Files Affected:**
- `src/Emulator.ts` (era state)
- New files in `src/eras/`

---

## Performance & Reliability Issues

### 12. Memory Management

**Priority**: 🟠 HIGH

**Issues:**
- Datum table grows unbounded
- No UTxO pruning
- Addresses map never cleaned
- Mempool can grow infinitely

**Action Items:**
- [ ] Implement datum table size limit
- [ ] Add UTxO pruning strategy
  - [ ] Remove spent UTxOs older than N blocks
  - [ ] Configurable retention period

- [ ] Add mempool size limit
  - [ ] Configurable max transactions
  - [ ] Eviction policy (FIFO, fee-based)

- [ ] Implement garbage collection
  - [ ] Periodic cleanup of stale data
  - [ ] Memory usage tracking

- [ ] Add memory usage tests
- [ ] Benchmark memory growth

**Files Affected:**
- `src/Emulator.ts` (add cleanup methods)

---

### 13. Error Handling & Rollback

**Priority**: 🟠 HIGH

**Issues:**
- No transaction rollback on partial failures
- Silent failures in error handling
- Weak type checking (`typeof a == undefined` instead of `===`)

**Action Items:**
- [ ] Implement transaction rollback
  - [ ] Save ledger state before processing
  - [ ] Restore on validation failure
  - [ ] Ensure atomicity

- [ ] Create custom exception types
  - [ ] `ValidationError`
  - [ ] `InsufficientFundsError`
  - [ ] `ScriptExecutionError`
  - [ ] `InvalidTransactionError`

- [ ] Improve error messages
  - [ ] Include transaction hash in errors
  - [ ] Detailed validation failure reasons
  - [ ] Suggest fixes when possible

- [ ] Fix type checking issues
  - [ ] Replace `==` with `===` (line 414)
  - [ ] Use proper undefined checks

- [ ] Add error recovery tests

**Files Affected:**
- `src/Emulator.ts:414` (fix type check)
- `src/Emulator.ts` (add rollback logic)
- New file: `src/errors.ts`

---

### 14. State Persistence

**Priority**: 🟡 MEDIUM

**Issue**: No save/load functionality, all state in memory

**Action Items:**
- [ ] Implement state serialization
  - [ ] Serialize ledger state
  - [ ] Serialize mempool
  - [ ] Serialize datum table
  - [ ] Serialize block info

- [ ] Add save/load methods
  - [ ] `saveState(filepath: string): Promise<void>`
  - [ ] `loadState(filepath: string): Promise<void>`

- [ ] Support state snapshots
  - [ ] Create checkpoint at any time
  - [ ] Restore from checkpoint
  - [ ] Multiple named snapshots

- [ ] Enable test replay
  - [ ] Record all transactions
  - [ ] Replay from saved state

- [ ] Add persistence tests

**Files Affected:**
- `src/Emulator.ts` (add serialization)
- New file: `src/persistence.ts`

---

### 15. Performance Optimization

**Priority**: 🟡 MEDIUM

**Issues:**
- Validates same transaction multiple times
- Recalculates transaction hashes repeatedly
- No result caching
- Single-threaded processing

**Action Items:**
- [ ] Add transaction result caching
  - [ ] Cache validation results
  - [ ] Cache transaction hashes
  - [ ] Cache script execution results

- [ ] Optimize mempool operations
  - [ ] Use priority queue for fee-based ordering
  - [ ] Index transactions by input references
  - [ ] Fast duplicate detection

- [ ] Optimize UTxO lookups
  - [ ] Additional indices (by token, by script hash)
  - [ ] Bloom filters for existence checks

- [ ] Consider parallel validation
  - [ ] Validate independent transactions in parallel
  - [ ] Worker threads for script execution

- [ ] Add performance benchmarks
- [ ] Profile hot paths
- [ ] Set performance targets

**Files Affected:**
- `src/Emulator.ts` (optimize methods)
- `src/queue.ts` (upgrade to priority queue)

---

### 16. Concurrency & Thread Safety

**Priority**: 🟡 MEDIUM

**Issue**: Not thread-safe, no concurrency control

**Action Items:**
- [ ] Add locking mechanism
  - [ ] Mutex for ledger state modifications
  - [ ] Read-write locks for queries

- [ ] Document thread-safety guarantees
- [ ] Add concurrency tests
  - [ ] Parallel transaction submission
  - [ ] Concurrent queries
  - [ ] Race condition tests

- [ ] Consider immutable state design
  - [ ] Return new state instead of mutation
  - [ ] Persistent data structures

**Files Affected:**
- `src/Emulator.ts` (add locking)
- New file: `src/concurrency.ts`

---

## Code Quality Improvements

### 17. Test Coverage

**Priority**: 🟠 HIGH

**Current**: 2/10 tests passing, many features untested

**Action Items:**
- [ ] Fix existing tests (see #1)
- [ ] Add unit tests for:
  - [ ] All validation rules
  - [ ] Collateral slashing
  - [ ] Datum resolution
  - [ ] Withdrawal processing
  - [ ] Block processing
  - [ ] Edge cases

- [ ] Add integration tests:
  - [ ] Complete transaction lifecycle
  - [ ] Multi-input transactions
  - [ ] Script execution scenarios
  - [ ] Token minting/burning

- [ ] Add property-based tests:
  - [ ] Ledger invariants
  - [ ] Value preservation
  - [ ] UTxO set consistency

- [ ] Add regression tests:
  - [ ] Known bug scenarios
  - [ ] Edge cases from real Cardano

- [ ] Aim for 90%+ coverage
- [ ] Add coverage reporting to CI

**Files Affected:**
- `__tests__/` (expand all test files)

---

### 18. Code Organization

**Priority**: 🟡 MEDIUM

**Issue**: Everything in one 1062-line `Emulator.ts` file

**Action Items:**
- [ ] Split into modules:
  ```
  src/
  ├── Emulator.ts              # Main class (orchestration only)
  ├── ledger/
  │   ├── UtxoLedger.ts        # UTxO state management
  │   ├── DatumTable.ts        # Datum storage
  │   └── StakeState.ts        # Staking state
  ├── validation/
  │   ├── phase1.ts            # Structural validation
  │   ├── phase2.ts            # Script execution
  │   ├── fees.ts              # Fee calculation
  │   ├── value.ts             # Value preservation
  │   └── validators.ts        # Individual validators
  ├── mempool/
  │   ├── Mempool.ts           # Transaction pool
  │   └── PriorityQueue.ts     # Fee-based ordering
  ├── time/
  │   ├── TimeManager.ts       # Slot/epoch/time
  │   └── BlockProduction.ts   # Block creation
  └── types/                   # Type definitions
  ```

- [ ] Extract interfaces to separate files
- [ ] Move helper functions to utilities
- [ ] Create clear module boundaries
- [ ] Update imports

**Files Affected:**
- Entire `src/` directory (reorganization)

---

### 19. API Consistency

**Priority**: 🟡 MEDIUM

**Issues:**
- Inconsistent naming (`thisMempool` vs `mempool`)
- Method naming mismatch (`printUtxo` vs `prettyPrintUtxo`)

**Action Items:**
- [ ] Standardize naming conventions
  - [ ] Decide on `prettyPrint*` or `print*`
  - [ ] Private members with `_` prefix or without?

- [ ] Create public accessors for state
  - [ ] `getMempool()`: readonly view
  - [ ] `getLedger()`: readonly view
  - [ ] `getBlockHeight()`, `getSlot()`, etc.

- [ ] Document all public methods with JSDoc
- [ ] Version API for compatibility
- [ ] Add deprecation warnings for old API

**Files Affected:**
- `src/Emulator.ts` (rename methods, add accessors)

---

### 20. Remove TODOs and FIXMEs

**Priority**: 🟡 MEDIUM

**Found in code:**

1. **Line 168**: `TOFIX:` - Address truncation in pretty print commented out
2. **Line 326**: `TODO` - Certificate information in mempool printing
3. **Line 729-731**: `TODO: Add collateral slashing` (implemented but comment remains)
4. **Line 763**: `TODO` - Reward distribution
5. **Line 776**: `TODO` - Certificate processing
6. **Line 897**: `TODO: Check on an example with refScript`
7. **Line 61-62**: `TO CHECK:` - Block information handling
8. **Line 64-65**: `TO CHECK:` - Datum table handling

**Action Items:**
- [ ] Fix or remove TOFIX at line 168
- [ ] Implement or remove TODO at line 326
- [ ] Remove outdated TODO at line 729-731
- [ ] Implement reward distribution (line 763)
- [ ] Implement certificate processing (line 776)
- [ ] Complete reference script support (line 897)
- [ ] Resolve uncertainties at lines 61-62, 64-65
- [ ] Remove all TODO comments once addressed

**Files Affected:**
- `src/Emulator.ts` (various lines)

---

## Network & Protocol Features

### 21. Block Production Simulation

**Priority**: 🔵 LOW

**Issue**: Fake slot leader (always "emulator"), no realistic block production

**Action Items:**
- [ ] Simulate slot leader selection
  - [ ] VRF-based selection (simplified)
  - [ ] Stake-weighted probability

- [ ] Add variable block times
  - [ ] Some slots empty (no leader)
  - [ ] Configurable density

- [ ] Orphaned blocks
  - [ ] Simulate competing blocks
  - [ ] Chain selection rules

**Files Affected:**
- `src/Emulator.ts` (block production)
- New file: `src/consensus.ts`

---

### 22. Network Simulation

**Priority**: 🔵 LOW

**Issue**: No network layer, no peers, no forks

**Action Items:**
- [ ] Multiple emulator instances
  - [ ] Peer-to-peer communication
  - [ ] Block propagation
  - [ ] Transaction propagation

- [ ] Network delays
  - [ ] Configurable latency
  - [ ] Packet loss simulation

- [ ] Fork resolution
  - [ ] Chain reorganization
  - [ ] Rollback support
  - [ ] Longest chain rule

**Files Affected:**
- New files in `src/network/`

---

## Documentation

### 23. Usage Examples

**Priority**: 🟠 HIGH

**Action Items:**
- [ ] Create `examples/` directory
- [ ] Add examples:
  - [ ] `01-simple-transaction.ts` - Basic UTxO transfer
  - [ ] `02-plutus-script.ts` - Script validation
  - [ ] `03-multi-input.ts` - Multiple inputs
  - [ ] `04-token-minting.ts` - Native tokens
  - [ ] `05-datum-handling.ts` - Datum usage
  - [ ] `06-time-based.ts` - Validity intervals
  - [ ] `07-collateral.ts` - Collateral handling
  - [ ] `08-reference-scripts.ts` - Reference scripts

- [ ] Add README in examples directory
- [ ] Ensure examples run successfully

**Files Affected:**
- New directory: `examples/`

---

### 24. API Documentation

**Priority**: 🟡 MEDIUM

**Action Items:**
- [ ] Generate TypeDoc documentation
- [ ] Add JSDoc to all public methods
- [ ] Document return types and exceptions
- [ ] Create architecture diagram
- [ ] Document design decisions
- [ ] Add troubleshooting guide

**Files Affected:**
- All source files (add JSDoc)
- New directory: `docs/`

---

## Recommended Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2) - IN PROGRESS
**Goal**: Working test suite and critical fixes

- [x] #1: Fix broken test suite ✅ **COMPLETED 2025-12-01**
- [ ] #2: Enforce fee validation
- [ ] #3: Implement value preservation
- [ ] #4: Fix slot calculation
- [x] #5: Add documentation (README.md, TODO.md) ✅

**Success Criteria**: All tests pass ✅, basic validation works (partial - needs #2, #3)

**Progress**: 2/5 items complete (40%)

---

### Phase 2: Core Validation (Weeks 3-6)
**Goal**: Implement essential Cardano validation rules

- [ ] #6: Transaction validation rules (minimum Ada, validity intervals, witnesses)
- [ ] #12: Memory management basics
- [ ] #13: Error handling & rollback
- [ ] #17: Expand test coverage to 60%+

**Success Criteria**: Can test realistic smart contracts

---

### Phase 3: Advanced Features (Weeks 7-10)
**Goal**: Support complex transactions

- [ ] #7: Certificate support
- [ ] #9: Complete reference scripts
- [ ] #6: Token minting/burning validation
- [ ] #6: Native script support
- [ ] #17: Test coverage to 80%+

**Success Criteria**: Can test complex dApps

---

### Phase 4: Staking & Governance (Weeks 11-14)
**Goal**: Full protocol coverage

- [ ] #8: Staking & delegation
- [ ] #10: Governance features
- [ ] #11: Multi-era support (basic)
- [ ] #17: Test coverage to 90%+

**Success Criteria**: Can test staking protocols

---

### Phase 5: Production Hardening (Weeks 15-18)
**Goal**: Production-grade emulator

- [ ] #14: State persistence
- [ ] #15: Performance optimization
- [ ] #16: Concurrency & thread safety
- [ ] #18: Code organization refactor
- [ ] #19: API consistency
- [ ] #20: Remove all TODOs

**Success Criteria**: Ready for production use

---

### Phase 6: Polish (Weeks 19-20)
**Goal**: Complete and documented

- [ ] #23: Usage examples
- [ ] #24: API documentation
- [ ] #21: Block production simulation (optional)
- [ ] #22: Network simulation (optional)
- [ ] Final testing and bug fixes

**Success Criteria**: Fully documented, production-ready

---

## Success Metrics

To be considered a "fully respected" Cardano emulator:

- [ ] **Test Coverage**: 90%+ line coverage
- [ ] **Ledger Rules**: 50+ validation rules implemented
- [ ] **Documentation**: Comprehensive README, API docs, examples
- [ ] **Performance**: Process 1000 tx/s in tests
- [ ] **Reliability**: No memory leaks, stable under load
- [ ] **Compatibility**: Passes differential tests vs cardano-node
- [ ] **Community**: 100+ GitHub stars, active issues/PRs
- [ ] **Production Use**: 5+ projects using in their CI/CD

---

## Notes

- Prioritize based on user needs - gather feedback on most important features
- Consider compatibility with existing Plutus testing tools
- Benchmark against other emulators (plutus-apps, cardano-wallet)
- Keep API stable once v1.0.0 is reached
- Consider formal verification for critical validation logic

---

**Last Updated**: 2025-12-01
**Status**: Early development (v0.0.1-dev10)
