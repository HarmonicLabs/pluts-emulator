# Pluts Emulator

A Cardano blockchain emulator for offchain testing, part of the [HarmonicLabs/plu-ts](https://github.com/HarmonicLabs/plu-ts) ecosystem.

## Overview

Pluts Emulator simulates a Cardano blockchain environment locally, enabling developers to test smart contracts and transactions without connecting to a real network. It implements the UTxO model with basic transaction processing and Plutus script execution.

**Current Version:** v0.0.1-dev10 (Early Development)

## Features

### Currently Implemented

#### UTxO Management
- UTxO ledger state management with efficient lookups
- Address-to-UTxO mapping
- UTxO resolution by reference and address
- Blockfrost-compatible API

#### Transaction Processing
- Transaction mempool (FIFO queue)
- Two-phase validation:
  - Phase 1: Structural validation (inputs exist, no duplicates, size limits)
  - Phase 2: Plutus script execution (via TxBuilder)
- Collateral handling with slashing on phase-2 failures
- Transaction size and block size limits

#### Time & Block Management
- Block height tracking
- Slot number tracking
- POSIX time tracking
- Genesis info integration (system start time, slot length)
- `awaitBlock()` - advance by N blocks
- `awaitSlot()` - advance by N slots

#### Validation Rules (Phase 1)
- Transaction well-formedness check
- Input existence validation
- At least one input required
- No duplicate inputs
- Transaction size limit enforcement
- Collateral validation for script transactions
- Collateral percentage calculation

#### Other Features
- Datum management and resolution
- Protocol parameters from mainnet defaults
- Debug logging with verbosity levels
- Pretty printing for UTxOs, mempool, and ledger state
- Provider pattern implementation (ITxRunnerProvider, IResolveUTxOs, etc.)

## Installation

```bash
npm install @harmoniclabs/pluts-emulator
```

## Usage

```typescript
import { Emulator } from "@harmoniclabs/pluts-emulator";

// Create emulator instance with optional genesis info and protocol params
const emulator = new Emulator();

// Initialize with UTxOs
emulator.addUtxo([
    {
        utxoRef: myUtxoRef,
        resolved: {
            address: myAddress,
            value: Value.lovelaces(10_000_000),
            datum: undefined,
            refScript: undefined
        }
    }
]);

// Submit a transaction
await emulator.submitTx(myTx);

// Advance blockchain state
await emulator.awaitBlock(1); // Advance by 1 block

// Query UTxOs
const utxos = await emulator.resolveUtxos([myAddress]);

// Pretty print current state
emulator.prettyPrintUtxos();
```

## API

### Core Methods

#### Transaction Submission
- `submitTx(tx: Tx): Promise<string>` - Submit transaction to mempool

#### Time Advancement
- `awaitBlock(blocks?: number): Promise<void>` - Advance by N blocks (default: 1)
- `awaitSlot(slots?: number): Promise<void>` - Advance by N slots (default: 1)

#### UTxO Management
- `addUtxo(utxos: UTxO[]): void` - Add UTxOs to ledger
- `resolveUtxos(addresses: Address[]): Promise<UTxO[]>` - Get UTxOs by address
- `getUtxo(utxoRef: TxOutRef): UTxO | undefined` - Get specific UTxO

#### State Inspection
- `prettyPrintUtxo(utxo: UTxO): void` - Print single UTxO
- `prettyPrintUtxos(): void` - Print all UTxOs
- `prettyPrintMempool(): void` - Print pending transactions

#### Provider Interface
Implements standard Cardano provider interfaces:
- `IGetGenesisInfos`
- `IGetProtocolParameters`
- `IResolveUTxOs`
- `ISubmitTx`
- `ITxRunnerProvider`

## Architecture

```
src/
├── Emulator.ts           # Main emulator class
├── queue.ts              # FIFO queue for mempool
├── types/
│   ├── EmulatorBlockInfos.ts    # Block metadata
│   └── StakeAddressInfos.ts     # Staking data structures
├── utils/
│   └── helper.ts         # Test utilities
└── index.ts              # Public exports
```

### Design Patterns

- **Provider Pattern**: Drop-in replacement for blockchain providers
- **Immutability**: UTxO cloning for safe state management
- **State Machine**: Clear separation between mempool and ledger
- **Delegation**: Phase 2 validation delegated to TxBuilder

## Limitations

### This is NOT a Full Cardano Node

This emulator is designed for **basic offchain testing** and has significant limitations:

#### Missing Transaction Validation (~45+ rules)
- ✗ Value preservation check (inputs = outputs + fees)
- ✗ Minimum Ada per UTxO validation
- ✗ Validity interval checks (transaction timeouts)
- ✗ Token minting/burning validation
- ✗ Signature verification
- ✗ Native scripts (multisig, timelock)
- ✗ Reference inputs/scripts (partial support)
- ✗ Metadata support
- ✗ Execution unit limits enforcement

#### Missing Protocol Features
- ✗ Staking & delegation (stake pools, rewards, certificates)
- ✗ Governance (CIP-1694, voting, treasury)
- ✗ Multi-era support (no hard fork simulation)
- ✗ Network simulation (no peers, forks, or rollbacks)
- ✗ Block production (fake slot leader only)

#### Technical Limitations
- ✗ No state persistence (memory only)
- ✗ No concurrency control (not thread-safe)
- ✗ No transaction rollback on partial failures
- ✗ Unbounded memory growth (no pruning)
- ✗ Single-threaded processing

### When to Use This Emulator

**Good for:**
- Testing simple UTxO transactions locally
- Basic Plutus script validation
- Quick iteration during development
- Unit testing smart contract logic
- Educational purposes

**NOT suitable for:**
- Production validation
- Complex multi-contract interactions
- Staking/delegation testing
- Performance testing
- Governance testing
- Accurate fee estimation for mainnet

## Development

### Build

```bash
npm install
npm run build
```

### Test

```bash
npm test
```

**Status:** All tests passing ✅ (37/37 tests pass, 4/4 test suites pass)

### Debug Levels

Set debug verbosity in emulator constructor:

```typescript
const emulator = new Emulator(
    genesisInfos,
    protocolParams,
    2 // debug level: 0=errors, 1=warnings, 2=info
);
```

## Contributing

Contributions welcome! See [TODO.md](TODO.md) for priority improvements needed.

### Development Roadmap

1. **Phase 1**: Fix broken tests
2. **Phase 2**: Implement core ledger rules (value preservation, fees)
3. **Phase 3**: Add documentation and examples
4. **Phase 4**: Advanced validation (minting, certificates, native scripts)
5. **Phase 5**: Staking and governance
6. **Phase 6**: Production hardening (persistence, optimization)

## Related Projects

- [plu-ts](https://github.com/HarmonicLabs/plu-ts) - Plutus TypeScript SDK
- [@harmoniclabs/buildooor](https://github.com/HarmonicLabs/buildooor) - Transaction builder
- [@harmoniclabs/uplc](https://github.com/HarmonicLabs/uplc) - Untyped Plutus Core

## License

See [LICENSE](LICENSE) file.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/HarmonicLabs/pluts-emulator/issues)
- HarmonicLabs Discord: [Community support](https://discord.gg/harmoniclabs)

---

**⚠️ Warning:** This is early-stage software (v0.0.1-dev10). API may change. Not recommended for production use.
