import { describe, expect, it, beforeEach } from '@jest/globals';
import {
    Address,
    Tx,
    TxBody,
    TxIn,
    TxOut,
    Value,
    UTxO,
    IUTxO,
    Hash28,
    forceTxOutRefStr
} from "@harmoniclabs/plu-ts";
import { defaultMainnetGenesisInfos } from "@harmoniclabs/buildooor";
import { defaultProtocolParameters } from "@harmoniclabs/plu-ts";

import { Emulator } from "../src/Emulator";
import { experimentFunctions } from "../src/experiments";

// ==================== TEST CONSTANTS ====================

const STANDARD_FEE = 1_000_000n;
const STANDARD_ADA_AMOUNT = 100_000_000n;

// ==================== TEST HELPERS ====================

/**
 * Helper to create a policy ID by repeating a character
 */
function createPolicyId(char: string): string {
    return char.repeat(56);
}

/**
 * Helper to create a token name from a string
 */
function createTokenName(name: string): Uint8Array {
    return Uint8Array.from(Buffer.from(name));
}

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
 * Helper to create a UTxO with native tokens
 */
function createUtxoWithTokens(
    address: Address,
    txHash: string,
    adaAmount: bigint,
    tokens: Array<{ policyId: string; tokenName: Uint8Array; amount: bigint }>
): IUTxO {
    let value = Value.lovelaces(adaAmount);
    for (const token of tokens) {
        value = Value.add(
            value,
            Value.singleAsset(new Hash28(token.policyId), token.tokenName, token.amount)
        );
    }

    return {
        utxoRef: { id: txHash, index: 0 },
        resolved: {
            address,
            value,
            datum: undefined,
            refScript: undefined
        }
    };
}

/**
 * Helper to format lovelaces as ADA
 */
function toAda(lovelaces: bigint): number {
    return Number(lovelaces) / 1_000_000;
}

/**
 * Helper to log UTxO value information
 */
function logUtxoValue(inputValue: bigint, label: string = "Input UTxO value") {
    console.log(`${label}: ${inputValue} lovelaces (${toAda(inputValue)} ADA)`);
}

/**
 * Helper to log fee and output value
 */
function logFeeAndOutput(fee: bigint, outputValue: bigint) {
    console.log(`Fee: ${fee} lovelaces (${toAda(fee)} ADA)`);
    console.log(`Output value: ${outputValue} lovelaces (${toAda(outputValue)} ADA)`);
}

/**
 * Helper to log value preservation equation
 */
function logValuePreservation(inputValue: bigint, outputValue: bigint, fee: bigint, valid: boolean = true) {
    console.log(`\nValue preserved: inputs (${inputValue}) = outputs (${outputValue}) + fee (${fee})`);
    console.log(`Verification: ${inputValue} ${valid ? '=' : '≠'} ${outputValue + fee} ${valid ? '✓' : '✗'}\n`);
}

/**
 * Helper to log value violation
 */
function logValueViolation(
    type: 'creating' | 'destroying',
    amount: bigint,
    inputValue: bigint,
    outputValue: bigint,
    fee: bigint,
    assetType: 'ADA' | 'tokens' = 'ADA'
) {
    const amountFormatted = assetType === 'ADA' ? `${toAda(amount)} ADA` : `${amount} tokens`;
    console.log(`\nViolation: ${type === 'creating' ? 'Creating' : 'Destroying'} ${amount} lovelaces (${amountFormatted}) ${type === 'creating' ? 'out of thin air' : ''}!`);
    console.log(`Expected equation: inputs (${inputValue}) = outputs (${outputValue}) + fee (${fee})`);
    console.log(`Actual: ${inputValue} ≠ ${outputValue + fee}`);
    const difference = type === 'creating' ? (outputValue + fee) - inputValue : inputValue - (outputValue + fee);
    console.log(`Difference: ${difference} lovelaces ${type === 'creating' ? 'stolen' : 'destroyed'}!\n`);
}

/**
 * Helper to assert transaction rejection with proper error checking
 */
async function expectTransactionRejection(
    emulator: Emulator,
    tx: Tx,
    errorPattern: RegExp,
    testName: string
) {
    try {
        const txHash = await emulator.submitTx(tx);
        console.log(`❌ VULNERABILITY: Transaction was ACCEPTED!`);
        console.log(`Transaction hash: ${txHash}\n`);
        fail(`${testName}: Expected transaction to be rejected, but it was accepted with hash: ${txHash}`);
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
        console.log(`❌ BUG: Transaction was REJECTED`);
        console.log(`Error: ${error}\n`);
        fail(`${testName}: Expected transaction to be accepted, but it was rejected: ${error}`);
    }
}

describe("Value Preservation Vulnerability Tests", () => {
    let emulator: Emulator;
    let utxosInit: IUTxO[];

    beforeEach(() => {
        utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
    });

    it("should REJECT transaction that creates ADA out of thin air (value preservation check)", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Value Preservation Vulnerability Test ===`);
        logUtxoValue(inputValue);

        const stolenAda = 50_000_000n;
        const fee = STANDARD_FEE;
        const outputValue = inputValue + stolenAda;

        logFeeAndOutput(fee, outputValue);
        logValueViolation('creating', stolenAda, inputValue, outputValue, fee);

        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(outputValue)
        });

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [output],
            fee: fee
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);
        console.log(`Attempting to submit transaction that creates ADA from nothing...\n`);

        await expectTransactionRejection(
            emulator,
            maliciousTx,
            /value|preservation|creating/i,
            "ADA creation test"
        );
        console.log(`Value preservation validation is working correctly.\n`);
    });

    it("should REJECT transaction that destroys ADA (value preservation check)", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== ADA Destruction Vulnerability Test ===`);
        logUtxoValue(inputValue);

        const destroyedAda = 59_000_000n;
        const fee = STANDARD_FEE;
        const outputValue = inputValue - destroyedAda - fee;

        logFeeAndOutput(fee, outputValue);
        logValueViolation('destroying', destroyedAda, inputValue, outputValue, fee);

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(outputValue)
            })],
            fee: fee
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);
        console.log(`Attempting to submit transaction that destroys ADA...\n`);

        await expectTransactionRejection(
            emulator,
            maliciousTx,
            /value|preservation|destroying/i,
            "ADA destruction test"
        );
        console.log(`Value preservation validation is working correctly.\n`);
    });

    it("should ACCEPT valid transaction with correct value preservation", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Valid Transaction Test (Control) ===`);
        logUtxoValue(inputValue);

        const fee = STANDARD_FEE;
        const outputValue = inputValue - fee;

        logFeeAndOutput(fee, outputValue);
        logValuePreservation(inputValue, outputValue, fee, true);

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(outputValue)
            })],
            fee: fee
        });

        const validTx = createTx(txBody);

        console.log(`Valid transaction hash: ${validTx.hash.toString()}`);
        console.log(`Submitting valid transaction...\n`);

        await expectTransactionAcceptance(emulator, validTx, "Valid transaction test");
    });

    it("should demonstrate TxBuilder automatically balances transactions", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== TxBuilder Test (Automatic Balancing) ===`);
        logUtxoValue(inputValue);

        const sendAmount = 50_000_000n;
        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(sendAmount)
        });

        console.log(`Sending: ${sendAmount} lovelaces (${toAda(sendAmount)} ADA)`);
        console.log(`TxBuilder will automatically calculate fee and create change output\n`);

        // Build the transaction - this will automatically balance it
        const tx = emulator.txBuilder.buildSync({
            inputs: [utxo],
            outputs: [output],
            changeAddress: utxo.resolved.address
        });

        console.log(`Transaction built successfully`);
        console.log(`Transaction hash: ${tx.hash.toString()}`);
        console.log(`Number of inputs: ${tx.body.inputs.length}`);
        console.log(`Number of outputs: ${tx.body.outputs.length}`);
        console.log(`Fee: ${tx.body.fee} lovelaces (${toAda(tx.body.fee)} ADA)`);

        // Calculate actual value preservation
        let totalInputValue = 0n;
        for (const input of tx.body.inputs) {
            const inputRef = input.utxoRef.toString();
            const inputUtxo = emulator.getUtxos().get(inputRef);
            if (inputUtxo) {
                totalInputValue += inputUtxo.resolved.value.lovelaces;
            }
        }

        let totalOutputValue = 0n;
        for (const output of tx.body.outputs) {
            totalOutputValue += output.value.lovelaces;
            console.log(`  Output: ${output.value.lovelaces} lovelaces (${toAda(output.value.lovelaces)} ADA)`);
        }

        console.log(`\nValue preservation check:`);
        console.log(`  Total inputs: ${totalInputValue} lovelaces (${toAda(totalInputValue)} ADA)`);
        console.log(`  Total outputs: ${totalOutputValue} lovelaces (${toAda(totalOutputValue)} ADA)`);
        console.log(`  Fee: ${tx.body.fee} lovelaces (${toAda(tx.body.fee)} ADA)`);
        console.log(`  Verification: ${totalInputValue} = ${totalOutputValue + tx.body.fee} ✓\n`);

        await expectTransactionAcceptance(emulator, tx, "TxBuilder test");

        // Verify value preservation manually
        expect(totalInputValue).toBe(totalOutputValue + tx.body.fee);
    });

    // ==================== NATIVE TOKEN TESTS ====================

    it("should REJECT transaction that creates native tokens without minting", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Native Token Creation Without Minting Test ===`);
        logUtxoValue(inputValue);

        const fakePolicyId = createPolicyId("a");
        const fakeTokenName = createTokenName("MyToken");
        const stolenTokens = 1000n;

        console.log(`Attempting to create ${stolenTokens} tokens without minting`);
        console.log(`Policy: ${fakePolicyId}`);
        console.log(`Token: ${fakeTokenName.toString()}\n`);

        const fee = STANDARD_FEE;

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(inputValue - fee),
                    Value.singleAsset(new Hash28(fakePolicyId), fakeTokenName, stolenTokens)
                )
            })],
            fee: fee
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);
        console.log(`Attempting to submit transaction that creates tokens without minting...\n`);

        await expectTransactionRejection(
            emulator,
            maliciousTx,
            /value|preservation|creating|token/i,
            "Token creation test"
        );
        console.log(`Value preservation validation is working correctly for native tokens.\n`);
    });

    it("should REJECT transaction that destroys native tokens without burning", async () => {
        console.log(`\n=== Native Token Destruction Without Burning Test ===`);

        const policyId = createPolicyId("b");
        const tokenName = createTokenName("TestToken");
        const tokenAmount = 500n;
        const adaAmount = STANDARD_ADA_AMOUNT;

        const address = emulator.getUtxos().values().next().value!.resolved.address;

        const utxoWithTokens = createUtxoWithTokens(
            address,
            "c".repeat(64),
            adaAmount,
            [{ policyId, tokenName, amount: tokenAmount }]
        );

        const newEmulator = new Emulator([utxoWithTokens], defaultMainnetGenesisInfos, defaultProtocolParameters);
        const utxo = newEmulator.getUtxos().values().next().value!;

        console.log(`Input UTxO value: ${adaAmount} lovelaces + ${tokenAmount} tokens`);
        console.log(`Policy: ${policyId}`);
        console.log(`Token: ${tokenName.toString()}`);

        const fee = STANDARD_FEE;
        const destroyedTokens = 200n;

        console.log(`\nAttempting to destroy ${destroyedTokens} tokens without burning field\n`);

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(adaAmount - fee),
                    Value.singleAsset(new Hash28(policyId), tokenName, tokenAmount - destroyedTokens)
                )
            })],
            fee: fee
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);

        await expectTransactionRejection(
            newEmulator,
            maliciousTx,
            /value|preservation|destroying|token/i,
            "Token destruction test"
        );
        console.log(`Value preservation validation is working correctly.\n`);
    });

    it("should ACCEPT transaction that properly mints native tokens", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Native Token Minting Test (Valid) ===`);
        logUtxoValue(inputValue);

        const policyId = createPolicyId("d");
        const tokenName = createTokenName("NewToken");
        const mintAmount = 1000n;

        console.log(`Minting ${mintAmount} tokens`);
        console.log(`Policy: ${policyId}`);
        console.log(`Token: ${tokenName.toString()}\n`);

        const fee = STANDARD_FEE;

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(inputValue - fee),
                    Value.singleAsset(new Hash28(policyId), tokenName, mintAmount)
                )
            })],
            fee: fee,
            mint: Value.singleAsset(new Hash28(policyId), tokenName, mintAmount)
        });

        const validTx = createTx(txBody);

        console.log(`Valid minting transaction hash: ${validTx.hash.toString()}`);
        console.log(`Submitting valid minting transaction...\n`);

        await expectTransactionAcceptance(emulator, validTx, "Token minting test");
        console.log(`Value preservation: inputs (0 tokens) + minted (${mintAmount} tokens) = outputs (${mintAmount} tokens) ✓\n`);
    });

    it("should ACCEPT transaction that properly burns native tokens", async () => {
        console.log(`\n=== Native Token Burning Test (Valid) ===`);

        const policyId = createPolicyId("e");
        const tokenName = createTokenName("BurnToken");
        const initialTokens = 500n;
        const burnAmount = 200n;
        const adaAmount = STANDARD_ADA_AMOUNT;

        const address = emulator.getUtxos().values().next().value!.resolved.address;

        const utxoWithTokens = createUtxoWithTokens(
            address,
            "f".repeat(64),
            adaAmount,
            [{ policyId, tokenName, amount: initialTokens }]
        );

        const newEmulator = new Emulator([utxoWithTokens], defaultMainnetGenesisInfos, defaultProtocolParameters);
        const utxo = newEmulator.getUtxos().values().next().value!;

        console.log(`Input UTxO value: ${adaAmount} lovelaces + ${initialTokens} tokens`);
        console.log(`Policy: ${policyId}`);
        console.log(`Token: ${tokenName.toString()}`);
        console.log(`Burning ${burnAmount} tokens\n`);

        const fee = STANDARD_FEE;
        const remainingTokens = initialTokens - burnAmount;

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.lovelaces(adaAmount - fee),
                    Value.singleAsset(new Hash28(policyId), tokenName, remainingTokens)
                )
            })],
            fee: fee,
            mint: Value.singleAsset(new Hash28(policyId), tokenName, -burnAmount)
        });

        const validTx = createTx(txBody);

        console.log(`Valid burning transaction hash: ${validTx.hash.toString()}`);
        console.log(`Submitting valid burning transaction...\n`);

        await expectTransactionAcceptance(newEmulator, validTx, "Token burning test");
        console.log(`Value preservation: inputs (${initialTokens}) + burned (-${burnAmount}) = outputs (${remainingTokens}) ✓\n`);
    });

    it("should REJECT transaction attempting to mint ADA", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== ADA Minting Test (Should Fail) ===`);
        logUtxoValue(inputValue);

        const fee = STANDARD_FEE;
        const mintedAda = 50_000_000n;

        console.log(`Attempting to mint ${toAda(mintedAda)} ADA (should be rejected)\n`);

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(inputValue - fee + mintedAda)
            })],
            fee: fee,
            mint: Value.lovelaces(mintedAda)
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);

        await expectTransactionRejection(
            emulator,
            maliciousTx,
            /cannot mint|burn|lovelaces|ada/i,
            "ADA minting test"
        );
        console.log(`Properly rejected attempt to mint ADA.\n`);
    });

    it("should REJECT transaction attempting to burn ADA", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== ADA Burning Test (Should Fail) ===`);
        logUtxoValue(inputValue);

        const fee = STANDARD_FEE;
        const burnedAda = 30_000_000n;

        console.log(`Attempting to burn ${toAda(burnedAda)} ADA via mint field (should be rejected)\n`);

        // Use empty policy ID to represent ADA in mint field (this simulates the attack)
        const emptyPolicy = createPolicyId("0");
        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.lovelaces(inputValue - fee - burnedAda)
            })],
            fee: fee,
            mint: Value.singleAsset(new Hash28(emptyPolicy), new Uint8Array(), -burnedAda)
        });

        const maliciousTx = createTx(txBody);

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);

        await expectTransactionRejection(
            emulator,
            maliciousTx,
            /cannot mint|burn|lovelaces|ada/i,
            "ADA burning test"
        );
        console.log(`Properly rejected attempt to burn ADA.\n`);
    });

    it("should handle multiple native tokens in same transaction", async () => {
        console.log(`\n=== Multiple Native Tokens Test ===`);

        const policy1 = createPolicyId("1");
        const policy2 = createPolicyId("2");
        const token1Name = createTokenName("Token1");
        const token2Name = createTokenName("Token2");
        const token1Amount = 100n;
        const token2Amount = 200n;
        const adaAmount = STANDARD_ADA_AMOUNT;

        const address = emulator.getUtxos().values().next().value!.resolved.address;

        const utxoWithMultipleTokens = createUtxoWithTokens(
            address,
            "9".repeat(64),
            adaAmount,
            [
                { policyId: policy1, tokenName: token1Name, amount: token1Amount },
                { policyId: policy2, tokenName: token2Name, amount: token2Amount }
            ]
        );

        const newEmulator = new Emulator([utxoWithMultipleTokens], defaultMainnetGenesisInfos, defaultProtocolParameters);
        const utxo = newEmulator.getUtxos().values().next().value!;

        console.log(`Input UTxO value: ${adaAmount} lovelaces + ${token1Amount} Token1 + ${token2Amount} Token2`);

        const fee = STANDARD_FEE;
        const mintToken1 = 50n;
        const burnToken2 = 50n;

        console.log(`Minting ${mintToken1} Token1, Burning ${burnToken2} Token2\n`);

        const txBody = new TxBody({
            inputs: [new TxIn(utxo)],
            outputs: [new TxOut({
                address: utxo.resolved.address,
                value: Value.add(
                    Value.add(
                        Value.lovelaces(adaAmount - fee),
                        Value.singleAsset(new Hash28(policy1), token1Name, token1Amount + mintToken1)
                    ),
                    Value.singleAsset(new Hash28(policy2), token2Name, token2Amount - burnToken2)
                )
            })],
            fee: fee,
            mint: Value.add(
                Value.singleAsset(new Hash28(policy1), token1Name, mintToken1),
                Value.singleAsset(new Hash28(policy2), token2Name, -burnToken2)
            )
        });

        const validTx = createTx(txBody);

        console.log(`Valid multi-token transaction hash: ${validTx.hash.toString()}`);

        await expectTransactionAcceptance(newEmulator, validTx, "Multi-token test");
        console.log(`Value preservation maintained for all assets ✓\n`);
    });

    it("should handle multiple inputs with different tokens", async () => {
        console.log(`\n=== Multiple Inputs with Tokens Test ===`);

        const policy1 = createPolicyId("a");
        const policy2 = createPolicyId("b");
        const token1Name = createTokenName("TokenA");
        const token2Name = createTokenName("TokenB");
        const token1Amount = 100n;
        const token2Amount = 200n;
        const adaAmount1 = 50_000_000n;
        const adaAmount2 = 50_000_000n;

        const address = emulator.getUtxos().values().next().value!.resolved.address;

        const utxo1 = createUtxoWithTokens(
            address,
            "1".repeat(64),
            adaAmount1,
            [{ policyId: policy1, tokenName: token1Name, amount: token1Amount }]
        );

        const utxo2 = createUtxoWithTokens(
            address,
            "2".repeat(64),
            adaAmount2,
            [{ policyId: policy2, tokenName: token2Name, amount: token2Amount }]
        );

        const newEmulator = new Emulator([utxo1, utxo2], defaultMainnetGenesisInfos, defaultProtocolParameters);
        const utxos = Array.from(newEmulator.getUtxos().values());

        console.log(`Input 1: ${adaAmount1} lovelaces + ${token1Amount} TokenA`);
        console.log(`Input 2: ${adaAmount2} lovelaces + ${token2Amount} TokenB`);

        const fee = STANDARD_FEE;
        const totalAda = adaAmount1 + adaAmount2;

        const txBody = new TxBody({
            inputs: [new TxIn(utxos[0]), new TxIn(utxos[1])],
            outputs: [new TxOut({
                address: address,
                value: Value.add(
                    Value.add(
                        Value.lovelaces(totalAda - fee),
                        Value.singleAsset(new Hash28(policy1), token1Name, token1Amount)
                    ),
                    Value.singleAsset(new Hash28(policy2), token2Name, token2Amount)
                )
            })],
            fee: fee
        });

        const validTx = createTx(txBody);

        console.log(`Valid multi-input transaction hash: ${validTx.hash.toString()}`);

        await expectTransactionAcceptance(newEmulator, validTx, "Multi-input test");
        console.log(`Value preservation maintained across multiple inputs ✓\n`);
    });
});
