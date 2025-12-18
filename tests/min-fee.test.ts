import { describe, it, expect, beforeEach } from '@jest/globals';
import { Tx,
    TxBody,
    TxIn,
    TxOut,
    Value,
    UTxO,
    defaultMainnetGenesisInfos, defaultProtocolParameters } from "@harmoniclabs/buildooor";
import { Emulator } from "../src/Emulator";
import { experimentFunctions } from "../src/experiment";

// ==================== TEST HELPERS ====================

/**
 * Helper to create empty transaction witnesses
 */
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

/**
 * Helper to create a transaction
 */
function createTx(txBody: TxBody): Tx {
    return new Tx({
        body: txBody,
        witnesses: createEmptyWitnesses()
    });
}

/**
 * Helper to format lovelaces as ADA
 */
function toAda(lovelaces: bigint): number {
    return Number(lovelaces) / 1_000_000;
}

/**
 * Helper to calculate minimum fee for a transaction
 */
function calculateMinFee(tx: Tx): bigint {
    const txSize = tx.toCbor().toString().length / 2; // Convert hex to bytes
    const minFee = (
        BigInt(defaultProtocolParameters.txFeePerByte) * BigInt(txSize) + 
        BigInt(defaultProtocolParameters.txFeeFixed)
    );
    return minFee;
}

/**
 * Helper to assert transaction rejection
 */
async function expectTransactionRejection(
    emulator: Emulator,
    tx: Tx,
    errorPattern: RegExp,
    testName: string
) {
    try {
        const txHash = await emulator.submitTx(tx);
        console.log(`❌ VULNERABILITY: Transaction was ACCEPTED with hash: ${txHash}`);
        fail(`${testName}: Expected transaction to be rejected, but it was accepted`);
    } catch (error) {
        console.log(`✅ SUCCESS: Transaction was REJECTED`);
        console.log(`Error: ${error}\n`);
        expect(String(error)).toMatch(errorPattern);
    }
}

/**
 * Helper to assert transaction acceptance
 */
async function expectTransactionAcceptance(
    emulator: Emulator,
    tx: Tx,
    testName: string
) {
    try {
        const txHash = await emulator.submitTx(tx);
        console.log(`✅ Transaction accepted (as expected)`);
        console.log(`Transaction hash: ${txHash}\n`);
        expect(txHash).toBe(tx.hash.toString());
    } catch (error) {
        console.log(`❌ BUG: Transaction was REJECTED: ${error}`);
        fail(`${testName}: Expected transaction to be accepted, but it was rejected: ${error}`);
    }
}

describe("Minimum Fee Validation Tests - Emulator Level", () => {
    let emulator: Emulator;
    let utxo: UTxO;

    beforeEach(() => {
        const utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
        utxo = emulator.getUtxos().values().next().value!;
    });

    describe("Fee < minFee rejection", () => {
        it("should reject transaction with zero fee", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            console.log(`\n=== Zero Fee Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Fee: 0 lovelaces (INVALID)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue) // No fee deducted
                })],
                fee: 0n
            });

            const tx = createTx(txBody);
            const minFee = calculateMinFee(tx);

            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: 0 lovelaces`);
            console.log(`Attempting to submit transaction with zero fee...\n`);

            await expectTransactionRejection(
                emulator,
                tx,
                /Insufficient fee|failed phase-1 validation/,
                "Zero fee test"
            );
        });

        it("should reject transaction with fee = 1 lovelace (insufficient)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 1n;

            console.log(`\n=== Insufficient Fee Test (1 lovelace) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Fee: ${fee} lovelace\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - fee)
                })],
                fee: fee
            });

            const tx = createTx(txBody);
            const minFee = calculateMinFee(tx);

            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${fee} lovelace`);
            console.log(`Deficit: ${minFee - fee} lovelaces\n`);

            await expectTransactionRejection(
                emulator,
                tx,
                /Insufficient fee|failed phase-1 validation/,
                "1 lovelace fee test"
            );
        });

        it("should reject transaction with fee = minFee - 1", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            // First create a reference transaction to calculate the size
            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n) // Placeholder
                })],
                fee: 200_000n // Placeholder
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);
            const insufficientFee = minFee - 1n;

            console.log(`\n=== MinFee - 1 Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${insufficientFee} lovelaces (${toAda(insufficientFee)} ADA)`);
            console.log(`Deficit: 1 lovelace\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - insufficientFee)
                })],
                fee: insufficientFee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /Insufficient fee|failed phase-1 validation/,
                "MinFee - 1 test"
            );
        });

        it("should reject transaction with fee = 50% of minFee", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);
            const halfFee = minFee / 2n;

            console.log(`\n=== 50% MinFee Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${halfFee} lovelaces (${toAda(halfFee)} ADA - 50%)`);
            console.log(`Deficit: ${minFee - halfFee} lovelaces\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - halfFee)
                })],
                fee: halfFee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /Insufficient fee|failed phase-1 validation/,
                "50% fee test"
            );
        });
    });

    describe("Edge cases - fee validation", () => {
        it("should accept transaction with fee = minFee (exact minimum)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);

            console.log(`\n=== Exact MinFee Test (Valid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${minFee} lovelaces (exactly minimum)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - minFee)
                })],
                fee: minFee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "Exact minFee test");
        });

        it("should accept transaction with fee = minFee + 1", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);
            const generousFee = minFee + 1n;

            console.log(`\n=== MinFee + 1 Test (Valid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${generousFee} lovelaces (${toAda(generousFee)} ADA)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - generousFee)
                })],
                fee: generousFee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "MinFee + 1 test");
        });

        it("should accept transaction with generous fee (2x minFee)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);
            const generousFee = minFee * 2n;

            console.log(`\n=== Generous Fee Test (2x MinFee) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum fee: ${minFee} lovelaces (${toAda(minFee)} ADA)`);
            console.log(`Actual fee: ${generousFee} lovelaces (${toAda(generousFee)} ADA - 2x)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - generousFee)
                })],
                fee: generousFee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "Generous fee test");
        });
    });

    describe("Fee calculation scales with transaction size", () => {
        it("should require higher fee for transaction with multiple outputs", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            console.log(`\n=== Multi-Output Transaction Fee Test ===`);

            // Simple transaction (1 output)
            const simpleTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(10_000_000n)
                })],
                fee: 200_000n
            });

            const simpleTx = createTx(simpleTxBody);
            const simpleMinFee = calculateMinFee(simpleTx);

            console.log(`Simple transaction (1 output):`);
            console.log(`  Size: ${simpleTx.toCbor().toString().length / 2} bytes`);
            console.log(`  MinFee: ${simpleMinFee} lovelaces (${toAda(simpleMinFee)} ADA)\n`);

            // Complex transaction (5 outputs) - needs new emulator with fresh UTxO
            const utxosInit2 = experimentFunctions.createRandomInitialUtxos(1);
            const emulator2 = new Emulator(utxosInit2, defaultMainnetGenesisInfos, defaultProtocolParameters);
            const utxo2 = emulator2.getUtxos().values().next().value!;

            const complexTxBody = new TxBody({
                inputs: [new TxIn(utxo2)],
                outputs: [
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                ],
                fee: 200_000n
            });

            const complexTx = createTx(complexTxBody);
            const complexMinFee = calculateMinFee(complexTx);

            console.log(`Complex transaction (5 outputs):`);
            console.log(`  Size: ${complexTx.toCbor().toString().length / 2} bytes`);
            console.log(`  MinFee: ${complexMinFee} lovelaces (${toAda(complexMinFee)} ADA)\n`);

            // Verify complex tx requires more fee
            expect(complexMinFee).toBeGreaterThan(simpleMinFee);
            console.log(`✅ Complex transaction requires ${complexMinFee - simpleMinFee} more lovelaces in fees\n`);

            // Test that using simple fee on complex tx gets rejected
            const insufficientComplexTxBody = new TxBody({
                inputs: [new TxIn(utxo2)],
                outputs: [
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                    new TxOut({ address: utxo2.resolved.address, value: Value.lovelaces(2_000_000n) }),
                ],
                fee: simpleMinFee // Using simple tx's fee (too low)
            });

            const insufficientTx = createTx(insufficientComplexTxBody);

            console.log(`Attempting complex transaction with insufficient fee (${simpleMinFee} lovelaces)...\n`);

            await expectTransactionRejection(
                emulator2,
                insufficientTx,
                /Insufficient fee|failed phase-1 validation/,
                "Complex tx with simple fee test"
            );
        });

        it("should verify fee formula: minFee = (txFeePerByte * txSize) + txFeeFixed", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            console.log(`\n=== Fee Formula Verification Test ===`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const tx = createTx(txBody);
            const txSize = tx.toCbor().toString().length / 2;
            const txFeePerByte = BigInt(defaultProtocolParameters.txFeePerByte);
            const txFeeFixed = BigInt(defaultProtocolParameters.txFeeFixed);
            
            const calculatedMinFee = (txFeePerByte * BigInt(txSize)) + txFeeFixed;

            console.log(`Transaction size: ${txSize} bytes`);
            console.log(`Protocol parameters:`);
            console.log(`  txFeePerByte: ${txFeePerByte}`);
            console.log(`  txFeeFixed: ${txFeeFixed}`);
            console.log(`\nFee calculation:`);
            console.log(`  minFee = (${txFeePerByte} * ${txSize}) + ${txFeeFixed}`);
            console.log(`  minFee = ${calculatedMinFee} lovelaces (${toAda(calculatedMinFee)} ADA)\n`);

            // Test with calculated minimum
            const validTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - calculatedMinFee)
                })],
                fee: calculatedMinFee
            });

            const validTx = createTx(validTxBody);

            await expectTransactionAcceptance(emulator, validTx, "Fee formula test");
        });
    });

    describe("Integration test - fee validation with block processing", () => {
        it("should process transaction with valid fee and update ledger", async () => {
            const inputValue = utxo.resolved.value.lovelaces;

            console.log(`\n=== Fee Validation Integration Test ===`);

            const referenceTxBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - 200_000n)
                })],
                fee: 200_000n
            });

            const referenceTx = createTx(referenceTxBody);
            const minFee = calculateMinFee(referenceTx);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(inputValue - minFee)
                })],
                fee: minFee
            });

            const tx = createTx(txBody);

            console.log(`Submitting transaction with valid fee: ${minFee} lovelaces`);

            await expectTransactionAcceptance(emulator, tx, "Integration test");

            // Advance block to process transaction
            emulator.awaitBlock(1);

            console.log(`✅ Transaction processed and ledger updated successfully\n`);
        });
    });
});