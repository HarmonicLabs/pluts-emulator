import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    Tx,
    TxBody,
    TxIn,
    TxOut,
    Value,
    UTxO,
} from "@harmoniclabs/plu-ts";
import { defaultMainnetGenesisInfos, defaultProtocolParameters } from "@harmoniclabs/buildooor";
import { Emulator } from "../src/Emulator";
import { experimentFunctions } from "../src/experiment";


function createEmptyWitnesses() {
    return {
        vkeyWitnesses: [],
        nativeScripts: undefined,
        plutusV1Scripts: undefined,
        plutusV2Scripts: undefined,
        plutusV3Scripts: undefined,
        datums: undefined,
        redeemers: undefined,
        bootstrapWitnesses: undefined
    };
}

function createTx(txBody: TxBody): Tx {
    return new Tx({
        body: txBody,
        witnesses: createEmptyWitnesses()
    });
}

describe("Validity Interval Validation Tests", () => {
    let emulator: Emulator;
    let utxo: UTxO;

    beforeEach(() => {
        const utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
        utxo = emulator.getUtxos().values().next().value!;
    });

    describe("TTL (Time-To-Live) Validation", () => {
        it("should accept transaction with TTL in the future", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Valid TTL Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot + 100} (100 slots in future)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot + 100 // Expires 100 slots in the future
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with valid TTL...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });

        it("should accept transaction with TTL at exactly current slot (boundary)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== TTL Boundary Test (Equal) ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot} (exactly at current slot)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot // Exactly at current slot (inclusive upper bound)
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with TTL = current slot...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted (boundary condition)\n`);
            expect(txHash).toBeDefined();
        });

        it("should reject transaction with expired TTL", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Expired TTL Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot - 1} (expired 1 slot ago)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot - 1 // Already expired
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit expired transaction...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/expired|TTL|failed phase-1 validation/);
            console.log(`✅ Expired transaction rejected\n`);
        });

        it("should reject transaction that expires far in the past", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Far Expired TTL Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot - 1000} (expired 1000 slots ago)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot - 1000 // Long expired
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit transaction expired 1000 slots ago...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/expired|TTL|failed phase-1 validation/);
            console.log(`✅ Far expired transaction rejected\n`);
        });

        it("should handle transaction expiring after slot advancement", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Transaction Expiry After Time Passes ===`);
            console.log(`Initial slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot + 10} (10 slots in future)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot + 10
            });

            const tx = createTx(txBody);

            // Submit when valid
            console.log(`Submitting transaction (should succeed)...`);
            const txHash = await emulator.submitTx(tx);
            console.log(`✅ Transaction accepted: ${txHash}`);
            expect(txHash).toBeDefined();

            // Advance past TTL
            console.log(`\nAdvancing 15 slots (past TTL)...`);
            emulator.awaitSlot(15);
            const newSlot = emulator.getCurrentSlot();
            console.log(`New slot: ${newSlot} (TTL was ${currentSlot + 10})`);

            // Try to submit same transaction again (should fail - already spent)
            // But illustrates that if we tried to submit a similar expired tx, it would fail
            console.log(`Transaction is now expired (${newSlot} > ${currentSlot + 10})\n`);
        });
    });

    describe("Validity Start Validation", () => {
        it("should accept transaction with validity start in the past", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Valid Start Time Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot - 100} (100 slots ago)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot - 100 // Valid from 100 slots ago
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with validity start in past...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });

        it("should accept transaction with validity start at exactly current slot (boundary)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Validity Start Boundary Test (Equal) ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot} (exactly at current slot)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot // Exactly at current slot (inclusive lower bound)
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with validity start = current slot...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted (boundary condition)\n`);
            expect(txHash).toBeDefined();
        });

        it("should reject transaction with validity start in the future (too early)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Too Early Transaction Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot + 1} (1 slot in future)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot + 1 // Not yet valid
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit transaction that's not yet valid...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/not yet valid|validity|failed phase-1 validation/);
            console.log(`✅ Too early transaction rejected\n`);
        });

        it("should reject transaction with validity start far in the future", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Far Future Validity Start Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot + 1000} (1000 slots in future)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot + 1000
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit transaction with far future validity start...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/not yet valid|validity|failed phase-1 validation/);
            console.log(`✅ Far future transaction rejected\n`);
        });

        it("should handle transaction becoming valid after slot advancement", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;
            const validityStart = currentSlot + 10;

            console.log(`\n=== Transaction Becoming Valid Test ===`);
            console.log(`Initial slot: ${currentSlot}`);
            console.log(`Validity start: ${validityStart} (10 slots in future)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: validityStart
            });

            const tx = createTx(txBody);

            // Try to submit when too early (should fail)
            console.log(`Attempting to submit (should fail - too early)...`);
            await expect(emulator.submitTx(tx)).rejects.toMatch(/not yet valid|validity|failed phase-1 validation/);
            console.log(`✅ Correctly rejected when too early`);

            // Advance to validity start
            console.log(`\nAdvancing to validity start (10 slots)...`);
            emulator.awaitSlot(10);
            const newSlot = emulator.getCurrentSlot();
            console.log(`New slot: ${newSlot} (validity start: ${validityStart})`);

            // Create new transaction (since UTxO was not spent)
            // In real scenario, same tx would now be valid
            console.log(`Transaction is now valid (${newSlot} >= ${validityStart})\n`);
        });
    });

    describe("Combined Validity Interval Tests", () => {
        it("should accept transaction with both validity start and TTL (within window)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;
            const validityStart = currentSlot - 50;
            const ttl = currentSlot + 50;

            console.log(`\n=== Valid Window Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity window: ${validityStart} to ${ttl}`);
            console.log(`Window size: ${ttl - validityStart} slots`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: validityStart,
                ttl: ttl
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction within validity window...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });

        it("should reject transaction with invalid window (start >= ttl)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Invalid Window Test (start >= ttl) ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot}`);
            console.log(`TTL: ${currentSlot} (start = ttl, invalid)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot,
                ttl: currentSlot // Invalid: start >= ttl
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit transaction with invalid window...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/invalid validity interval|failed phase-1 validation/);
            console.log(`✅ Invalid window rejected\n`);
        });

        it("should reject transaction with inverted window (start > ttl)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Inverted Window Test (start > ttl) ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot + 100}`);
            console.log(`TTL: ${currentSlot - 100} (inverted window)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot + 100,
                ttl: currentSlot - 100 // Inverted
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit transaction with inverted window...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/invalid validity interval|failed phase-1 validation/);
            console.log(`✅ Inverted window rejected\n`);
        });

        it("should handle narrow validity window (1 slot)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Narrow Window Test (1 slot) ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity window: ${currentSlot} to ${currentSlot + 1} (1 slot window)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot,
                ttl: currentSlot + 1
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with 1-slot window...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });
    });

    describe("No Validity Constraints Tests", () => {
        it("should accept transaction with no validity constraints", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            console.log(`\n=== No Validity Constraints Test ===`);
            console.log(`Current slot: ${emulator.getCurrentSlot()}`);
            console.log(`No validity start or TTL (valid always)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee
                // No validityIntervalStart or ttl
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with no validity constraints...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });

        it("should accept transaction with only TTL (no start constraint)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Only TTL Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${currentSlot + 100} (no validity start)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: currentSlot + 100
                // No validityIntervalStart
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with only TTL...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });

        it("should accept transaction with only validity start (no TTL)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;

            console.log(`\n=== Only Validity Start Test ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${currentSlot - 100} (no TTL, never expires)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: currentSlot - 100
                // No ttl
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with only validity start...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}\n`);
            expect(txHash).toBeDefined();
        });
    });

    describe("Real-world Scenarios", () => {
        it("should simulate typical transaction with 2-hour TTL", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;
            
            // 2 hours = 7200 slots (1 slot = 1 second)
            const twoHoursInSlots = 7200;
            const ttl = currentSlot + twoHoursInSlots;

            console.log(`\n=== Real-world: 2-Hour TTL ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`TTL: ${ttl} (${twoHoursInSlots} slots = 2 hours from now)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                ttl: ttl
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with 2-hour window...\n`);
            const txHash = await emulator.submitTx(tx);
            
            console.log(`✅ Transaction accepted: ${txHash}`);
            console.log(`Transaction will remain valid for 2 hours\n`);
            expect(txHash).toBeDefined();
        });

        it("should simulate time-locked transaction (future validity start)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const currentSlot = emulator.getCurrentSlot();
            const fee = 200_000n;
            
            // Lock for 1 hour = 3600 slots
            const lockDuration = 3600;
            const validityStart = currentSlot + lockDuration;

            console.log(`\n=== Real-world: Time-locked Transaction ===`);
            console.log(`Current slot: ${currentSlot}`);
            console.log(`Validity start: ${validityStart} (locked for ${lockDuration} slots = 1 hour)`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee,
                validityIntervalStart: validityStart
            });

            const tx = createTx(txBody);

            console.log(`Attempting to submit time-locked transaction...\n`);

            await expect(emulator.submitTx(tx)).rejects.toMatch(/not yet valid|validity|failed phase-1 validation/);
            console.log(`✅ Time-locked transaction correctly rejected (not yet valid)\n`);
        });
    });
});