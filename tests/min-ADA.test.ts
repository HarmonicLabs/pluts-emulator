import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    DataI,
    DataB,
    DataList,
} from "@harmoniclabs/plu-ts";
import { Address,
    Tx,
    TxBody,
    TxIn,
    TxOut,
    Value,
    UTxO,
    Hash28,
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
 * Helper to get minimum ADA for an output
 */
function getMinimumOutputLovelaces(emulator: Emulator, output: TxOut): bigint {
    return emulator.txBuilder.getMinimumOutputLovelaces(output);
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

describe("Minimum ADA Requirement Validation Tests - Emulator Level", () => {
    let emulator: Emulator;
    let utxo: UTxO;

    beforeEach(() => {
        const utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
        utxo = emulator.getUtxos().values().next().value!;
    });

    describe("Reject outputs below minimum ADA", () => {
        it("should reject output with 0 lovelaces", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            console.log(`\n=== Zero ADA Output Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Output: 0 lovelaces (INVALID)`);
            console.log(`Fee: ${fee} lovelaces\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(0n)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Zero ADA test"
            );
        });

        it("should reject output with 1 lovelace", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const outputValue = 1n;
            const fee = 200_000n;

            console.log(`\n=== 1 Lovelace Output Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Output: ${outputValue} lovelace (INVALID)`);
            console.log(`Fee: ${fee} lovelaces\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(outputValue)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "1 lovelace test"
            );
        });

        it("should reject output with 1000 lovelaces (below minimum)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const outputValue = 1_000n;
            const fee = 200_000n;

            console.log(`\n=== 1000 Lovelaces Output Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Output: ${outputValue} lovelaces (INVALID)`);
            console.log(`Fee: ${fee} lovelaces\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(outputValue)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "1000 lovelaces test"
            );
        });

        it("should reject output with minAda - 1 lovelace", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            // Calculate minimum for simple output
            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);
            const insufficientAda = minAda - 1n;

            console.log(`\n=== MinAda - 1 Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Output: ${insufficientAda} lovelaces (${toAda(insufficientAda)} ADA)`);
            console.log(`Deficit: 1 lovelace\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(insufficientAda)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "MinAda - 1 test"
            );
        });

        it("should accept output with exactly minimum ADA", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);

            console.log(`\n=== Exact MinAda Test (Valid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Output: ${minAda} lovelaces (exactly minimum)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(minAda)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "Exact minAda test");
        });

        it("should accept output with minAda + 1 lovelace", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);
            const generousAda = minAda + 1n;

            console.log(`\n=== MinAda + 1 Test (Valid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Output: ${generousAda} lovelaces (${toAda(generousAda)} ADA)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(generousAda)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "MinAda + 1 test");
        });
    });

    describe("Test with various output sizes", () => {
        it("should reject simple output with insufficient ADA", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);
            const insufficientAda = minAda / 2n;

            console.log(`\n=== Simple Output with Insufficient ADA ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Required minimum: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Output: ${insufficientAda} lovelaces (${toAda(insufficientAda)} ADA - 50%)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(insufficientAda)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Simple output insufficient ADA test"
            );
        });

        it("should require more ADA for output with small inline datum", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const simpleOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });

            const outputWithDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: new DataI(42)
            });

            const minAdaSimple = getMinimumOutputLovelaces(emulator, simpleOutput);
            const minAdaWithDatum = getMinimumOutputLovelaces(emulator, outputWithDatum);

            console.log(`\n=== Output with Datum Requires More ADA ===`);
            console.log(`Simple output minimum: ${minAdaSimple} lovelaces (${toAda(minAdaSimple)} ADA)`);
            console.log(`Output with datum minimum: ${minAdaWithDatum} lovelaces (${toAda(minAdaWithDatum)} ADA)`);
            console.log(`Difference: ${minAdaWithDatum - minAdaSimple} lovelaces\n`);

            expect(minAdaWithDatum).toBeGreaterThan(minAdaSimple);

            // Test rejection with simple minimum (insufficient for datum)
            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(minAdaSimple),
                    datum: new DataI(42)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            console.log(`Attempting output with datum but only simple output ADA (${minAdaSimple})...\n`);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Datum output insufficient ADA test"
            );
        });

        it("should require more ADA for output with large inline datum", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const smallDatum = new DataI(42);
            const largeDatum = new DataList(
                Array.from({ length: 100 }, (_, i) => new DataI(i))
            );

            const outputWithSmallDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: smallDatum
            });

            const outputWithLargeDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: largeDatum
            });

            const minAdaSmall = getMinimumOutputLovelaces(emulator, outputWithSmallDatum);
            const minAdaLarge = getMinimumOutputLovelaces(emulator, outputWithLargeDatum);

            console.log(`\n=== Large Datum Requires More ADA ===`);
            console.log(`Small datum (integer) minimum: ${minAdaSmall} lovelaces (${toAda(minAdaSmall)} ADA)`);
            console.log(`Large datum (100 integers) minimum: ${minAdaLarge} lovelaces (${toAda(minAdaLarge)} ADA)`);
            console.log(`Difference: ${minAdaLarge - minAdaSmall} lovelaces\n`);

            expect(minAdaLarge).toBeGreaterThan(minAdaSmall);

            // Test rejection with small datum minimum (insufficient for large datum)
            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(minAdaSmall),
                    datum: largeDatum
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            console.log(`Attempting large datum output with small datum ADA (${minAdaSmall})...\n`);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Large datum insufficient ADA test"
            );
        });

        it("should require more ADA for output with native assets", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;
            const policyId = "a".repeat(56);
            const tokenName = Uint8Array.from(Buffer.from("Token1"));

            const simpleOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });

            const outputWithAsset = new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(1_000_000n),
                    Value.singleAsset(new Hash28(policyId), tokenName, 100n)
                )
            });

            const minAdaSimple = getMinimumOutputLovelaces(emulator, simpleOutput);
            const minAdaWithAsset = getMinimumOutputLovelaces(emulator, outputWithAsset);

            console.log(`\n=== Native Asset Output Requires More ADA ===`);
            console.log(`Simple output minimum: ${minAdaSimple} lovelaces (${toAda(minAdaSimple)} ADA)`);
            console.log(`Output with asset minimum: ${minAdaWithAsset} lovelaces (${toAda(minAdaWithAsset)} ADA)`);
            console.log(`Difference: ${minAdaWithAsset - minAdaSimple} lovelaces\n`);

            expect(minAdaWithAsset).toBeGreaterThan(minAdaSimple);

            // Test rejection with simple minimum (insufficient for asset)
            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.add(
                        Value.lovelaces(minAdaSimple),
                        Value.singleAsset(new Hash28(policyId), tokenName, 100n)
                    )
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            console.log(`Attempting asset output with simple output ADA (${minAdaSimple})...\n`);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Asset output insufficient ADA test"
            );
        });

        it("should require more ADA for output with multiple native assets", async () => {
            const policyId = "b".repeat(56);
            const token1Name = Uint8Array.from(Buffer.from("Token1"));
            const token2Name = Uint8Array.from(Buffer.from("Token2"));
            const token3Name = Uint8Array.from(Buffer.from("Token3"));

            const outputWithOneAsset = new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(1_000_000n),
                    Value.singleAsset(new Hash28(policyId), token1Name, 100n)
                )
            });

            const outputWithMultipleAssets = new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.add(
                        Value.add(
                            Value.lovelaces(1_000_000n),
                            Value.singleAsset(new Hash28(policyId), token1Name, 100n)
                        ),
                        Value.singleAsset(new Hash28(policyId), token2Name, 200n)
                    ),
                    Value.singleAsset(new Hash28(policyId), token3Name, 300n)
                )
            });

            const minAdaSingle = getMinimumOutputLovelaces(emulator, outputWithOneAsset);
            const minAdaMultiple = getMinimumOutputLovelaces(emulator, outputWithMultipleAssets);

            console.log(`\n=== Multiple Assets Require More ADA ===`);
            console.log(`One asset minimum: ${minAdaSingle} lovelaces (${toAda(minAdaSingle)} ADA)`);
            console.log(`Three assets minimum: ${minAdaMultiple} lovelaces (${toAda(minAdaMultiple)} ADA)`);
            console.log(`Difference: ${minAdaMultiple - minAdaSingle} lovelaces\n`);

            expect(minAdaMultiple).toBeGreaterThan(minAdaSingle);
        });

        it("should require more ADA for output with both native assets and datum", async () => {
            const policyId = "c".repeat(56);
            const tokenName = Uint8Array.from(Buffer.from("Token1"));

            const outputOnlyAsset = new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(1_000_000n),
                    Value.singleAsset(new Hash28(policyId), tokenName, 100n)
                )
            });

            const outputOnlyDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: new DataI(42)
            });

            const outputBoth = new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(1_000_000n),
                    Value.singleAsset(new Hash28(policyId), tokenName, 100n)
                ),
                datum: new DataI(42)
            });

            const minAdaAsset = getMinimumOutputLovelaces(emulator, outputOnlyAsset);
            const minAdaDatum = getMinimumOutputLovelaces(emulator, outputOnlyDatum);
            const minAdaBoth = getMinimumOutputLovelaces(emulator, outputBoth);

            console.log(`\n=== Combined Asset + Datum Requires Most ADA ===`);
            console.log(`Asset only minimum: ${minAdaAsset} lovelaces (${toAda(minAdaAsset)} ADA)`);
            console.log(`Datum only minimum: ${minAdaDatum} lovelaces (${toAda(minAdaDatum)} ADA)`);
            console.log(`Both minimum: ${minAdaBoth} lovelaces (${toAda(minAdaBoth)} ADA)\n`);

            expect(minAdaBoth).toBeGreaterThan(minAdaAsset);
            expect(minAdaBoth).toBeGreaterThan(minAdaDatum);
        });

        it("should validate minimum ADA for complex datum structure", async () => {
            const simpleDatum = new DataI(2);
            const complexDatum = new DataB(Uint8Array.from(Buffer.from("dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size dummy test for longer byte size")))

            const outputWithSimpleDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: simpleDatum
            });

            const outputWithComplexDatum = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n),
                datum: complexDatum
            });

            const minAdaSimple = getMinimumOutputLovelaces(emulator, outputWithSimpleDatum);
            const minAdaComplex = getMinimumOutputLovelaces(emulator, outputWithComplexDatum);

            console.log(`\n=== Complex Datum Requires More ADA ===`);
            console.log(`Simple datum minimum: ${minAdaSimple} lovelaces (${toAda(minAdaSimple)} ADA)`);
            console.log(`Complex datum minimum: ${minAdaComplex} lovelaces (${toAda(minAdaComplex)} ADA)`);
            console.log(`Difference: ${minAdaComplex - minAdaSimple} lovelaces\n`);

            expect(minAdaComplex).toBeGreaterThan(minAdaSimple);
        });

        it("should reject when ANY output has insufficient ADA (multi-output)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);

            console.log(`\n=== Multi-Output Test (One Invalid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Minimum per output: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Creating 3 outputs: two valid, one with only 1 lovelace\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(minAda + 100_000n) }),
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(1n) }), // Invalid
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(minAda + 100_000n) }),
                ],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionRejection(
                emulator,
                tx,
                /insufficient ADA|failed phase-1 validation/,
                "Multi-output with one invalid test"
            );
        });

        it("should accept when ALL outputs meet minimum ADA (multi-output)", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);

            console.log(`\n=== Multi-Output Test (All Valid) ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Minimum per output: ${minAda} lovelaces (${toAda(minAda)} ADA)`);
            console.log(`Creating 3 valid outputs\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(minAda) }),
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(minAda + 100_000n) }),
                    new TxOut({ address: utxo.resolved.address, value: Value.lovelaces(minAda + 200_000n) }),
                ],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "Multi-output all valid test");
        });
    });

    describe("Integration test - minimum ADA with block processing", () => {
        it("should process valid transaction and update ledger", async () => {
            const inputValue = utxo.resolved.value.lovelaces;
            const fee = 200_000n;

            const testOutput = new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(1_000_000n)
            });
            const minAda = getMinimumOutputLovelaces(emulator, testOutput);

            console.log(`\n=== Minimum ADA Integration Test ===`);
            console.log(`Input: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
            console.log(`Output: ${minAda + 1_000_000n} lovelaces (minimum + 1 ADA)\n`);

            const txBody = new TxBody({
                inputs: [new TxIn(utxo)],
                outputs: [new TxOut({
                    address: utxo.resolved.address,
                    value: Value.lovelaces(minAda + 1_000_000n)
                })],
                fee: fee
            });

            const tx = createTx(txBody);

            await expectTransactionAcceptance(emulator, tx, "Integration test");

            // Advance block to process transaction
            emulator.awaitBlock(1);

            console.log(`✅ Transaction processed and ledger updated successfully\n`);
        });
    });
});