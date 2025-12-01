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

describe("Value Preservation Vulnerability Tests", () => {
    let emulator: Emulator;
    let utxosInit: IUTxO[];

    beforeEach(() => {
        utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
    });

    it("should REJECT transaction that creates ADA out of thin air (value preservation check)", async () => {
        // Get a UTxO with 100 ADA
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Value Preservation Vulnerability Test ===`);
        console.log(`Input UTxO value: ${inputValue} lovelaces (${Number(inputValue) / 1_000_000} ADA)`);

        // Manually construct a transaction that violates value preservation
        // Inputs: 100 ADA
        // Outputs: 150 ADA (creating 50 ADA out of thin air!)
        // Fee: 1 ADA
        // This should FAIL but will currently PASS

        const stolenAda = 50_000_000n; // 50 ADA we're creating from nothing
        const fee = 1_000_000n; // 1 ADA fee
        const outputValue = inputValue + stolenAda; // More than input!

        console.log(`Fee: ${fee} lovelaces (${Number(fee) / 1_000_000} ADA)`);
        console.log(`Output value: ${outputValue} lovelaces (${Number(outputValue) / 1_000_000} ADA)`);
        console.log(`\nViolation: Creating ${stolenAda} lovelaces (${Number(stolenAda) / 1_000_000} ADA) out of thin air!`);
        console.log(`Expected equation: inputs (${inputValue}) = outputs (${outputValue}) + fee (${fee})`);
        console.log(`Actual: ${inputValue} ≠ ${outputValue + fee}`);
        console.log(`Difference: ${(outputValue + fee) - inputValue} lovelaces stolen!\n`);

        // Create output with MORE value than input
        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(outputValue)
        });

        // Manually construct transaction body with proper TxIn
        const txInput = new TxIn(utxo);

        const txBody = new TxBody({
            inputs: [txInput],
            outputs: [output],
            fee: fee
        });

        // Create the malicious transaction
        const maliciousTx = new Tx({
            body: txBody,
            witnesses: {
                vkeyWitnesses: [], // Empty - we're not signing
                nativeScripts: undefined,
                plutusV1Scripts: undefined,
                plutusV2Scripts: undefined,
                plutusV3Scripts: undefined,
                datums: undefined,
                redeemers: undefined,
                bootstrapWitnesses: undefined
            }
        });

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);
        console.log(`Attempting to submit transaction that creates ADA from nothing...\n`);

        try {
            // This should FAIL with "Value not preserved" error
            const txHash = await emulator.submitTx(maliciousTx);

            // If we get here, the validation is NOT working
            console.log(`❌ VULNERABILITY STILL EXISTS: Transaction was ACCEPTED!`);
            console.log(`Transaction hash: ${txHash}`);
            console.log(`\nThe emulator accepted a transaction that creates ${Number(stolenAda) / 1_000_000} ADA out of thin air.`);

            // This should NOT happen - fail the test
            fail(`Expected transaction to be rejected, but it was accepted with hash: ${txHash}`);

        } catch (error) {
            // This is what SHOULD happen - validation caught it!
            console.log(`✅ SUCCESS: Transaction was REJECTED`);
            console.log(`Error: ${error}`);
            console.log(`\nValue preservation validation is working correctly.\n`);

            // Verify the error message mentions value preservation
            expect(String(error)).toMatch(/value|preservation|creating/i);
        }
    });

    it("should REJECT transaction that destroys ADA (value preservation check)", async () => {
        // Get a UTxO with 100 ADA
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== ADA Destruction Vulnerability Test ===`);
        console.log(`Input UTxO value: ${inputValue} lovelaces (${Number(inputValue) / 1_000_000} ADA)`);

        // Manually construct a transaction that destroys ADA
        // Inputs: 100 ADA
        // Outputs: 40 ADA
        // Fee: 1 ADA
        // Missing: 59 ADA (destroyed)

        const destroyedAda = 59_000_000n; // 59 ADA destroyed
        const fee = 1_000_000n; // 1 ADA fee
        const outputValue = inputValue - destroyedAda - fee; // Much less than input!

        console.log(`Fee: ${fee} lovelaces (${Number(fee) / 1_000_000} ADA)`);
        console.log(`Output value: ${outputValue} lovelaces (${Number(outputValue) / 1_000_000} ADA)`);
        console.log(`\nViolation: Destroying ${destroyedAda} lovelaces (${Number(destroyedAda) / 1_000_000} ADA)!`);
        console.log(`Expected equation: inputs (${inputValue}) = outputs (${outputValue}) + fee (${fee})`);
        console.log(`Actual: ${inputValue} ≠ ${outputValue + fee}`);
        console.log(`Difference: ${inputValue - (outputValue + fee)} lovelaces destroyed!\n`);

        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(outputValue)
        });

        const txInput = new TxIn(utxo);

        const txBody = new TxBody({
            inputs: [txInput],
            outputs: [output],
            fee: fee
        });

        const maliciousTx = new Tx({
            body: txBody,
            witnesses: {
                vkeyWitnesses: [],
                nativeScripts: undefined,
                plutusV1Scripts: undefined,
                plutusV2Scripts: undefined,
                plutusV3Scripts: undefined,
                datums: undefined,
                redeemers: undefined,
                bootstrapWitnesses: undefined
            }
        });

        console.log(`Malicious transaction hash: ${maliciousTx.hash.toString()}`);
        console.log(`Attempting to submit transaction that destroys ADA...\n`);

        try {
            const txHash = await emulator.submitTx(maliciousTx);

            // If we get here, the validation is NOT working
            console.log(`❌ VULNERABILITY STILL EXISTS: Transaction was ACCEPTED!`);
            console.log(`Transaction hash: ${txHash}`);
            console.log(`\nThe emulator accepted a transaction that destroys ${Number(destroyedAda) / 1_000_000} ADA.\n`);

            // This should NOT happen - fail the test
            fail(`Expected transaction to be rejected, but it was accepted with hash: ${txHash}`);

        } catch (error) {
            // This is what SHOULD happen - validation caught it!
            console.log(`✅ SUCCESS: Transaction was REJECTED`);
            console.log(`Error: ${error}`);
            console.log(`\nValue preservation validation is working correctly.\n`);

            // Verify the error message mentions value preservation
            expect(String(error)).toMatch(/value|preservation|destroying/i);
        }
    });

    it("should ACCEPT valid transaction with correct value preservation", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== Valid Transaction Test (Control) ===`);
        console.log(`Input UTxO value: ${inputValue} lovelaces (${Number(inputValue) / 1_000_000} ADA)`);

        // This one should work - proper value preservation
        const fee = 1_000_000n; // 1 ADA fee
        const outputValue = inputValue - fee; // Exactly input minus fee

        console.log(`Fee: ${fee} lovelaces (${Number(fee) / 1_000_000} ADA)`);
        console.log(`Output value: ${outputValue} lovelaces (${Number(outputValue) / 1_000_000} ADA)`);
        console.log(`\nValue preserved: inputs (${inputValue}) = outputs (${outputValue}) + fee (${fee})`);
        console.log(`Verification: ${inputValue} = ${outputValue + fee} ✓\n`);

        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(outputValue)
        });

        const txInput = new TxIn(utxo);

        const txBody = new TxBody({
            inputs: [txInput],
            outputs: [output],
            fee: fee
        });

        const validTx = new Tx({
            body: txBody,
            witnesses: {
                vkeyWitnesses: [],
                nativeScripts: undefined,
                plutusV1Scripts: undefined,
                plutusV2Scripts: undefined,
                plutusV3Scripts: undefined,
                datums: undefined,
                redeemers: undefined,
                bootstrapWitnesses: undefined
            }
        });

        console.log(`Valid transaction hash: ${validTx.hash.toString()}`);
        console.log(`Submitting valid transaction...\n`);

        const txHash = await emulator.submitTx(validTx);

        console.log(`✅ Valid transaction accepted (as expected)`);
        console.log(`Transaction hash: ${txHash}\n`);

        expect(txHash).toBe(validTx.hash.toString());
    });

    it("should demonstrate TxBuilder automatically balances transactions", async () => {
        const utxo = emulator.getUtxos().values().next().value!;
        const inputValue = utxo.resolved.value.lovelaces;

        console.log(`\n=== TxBuilder Test (Automatic Balancing) ===`);
        console.log(`Input UTxO value: ${inputValue} lovelaces (${Number(inputValue) / 1_000_000} ADA)`);

        // Build transaction using TxBuilder
        // TxBuilder will automatically:
        // 1. Calculate the minimum fee
        // 2. Create change output if needed
        // 3. Ensure value preservation
        const sendAmount = 50_000_000n; // 50 ADA
        const output = new TxOut({
            address: utxo.resolved.address,
            value: Value.lovelaces(sendAmount)
        });

        console.log(`Sending: ${sendAmount} lovelaces (${Number(sendAmount) / 1_000_000} ADA)`);
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
        console.log(`Fee: ${tx.body.fee} lovelaces (${Number(tx.body.fee) / 1_000_000} ADA)`);

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
            console.log(`  Output: ${output.value.lovelaces} lovelaces (${Number(output.value.lovelaces) / 1_000_000} ADA)`);
        }

        console.log(`\nValue preservation check:`);
        console.log(`  Total inputs: ${totalInputValue} lovelaces (${Number(totalInputValue) / 1_000_000} ADA)`);
        console.log(`  Total outputs: ${totalOutputValue} lovelaces (${Number(totalOutputValue) / 1_000_000} ADA)`);
        console.log(`  Fee: ${tx.body.fee} lovelaces (${Number(tx.body.fee) / 1_000_000} ADA)`);
        console.log(`  Verification: ${totalInputValue} = ${totalOutputValue + tx.body.fee} ✓\n`);

        // Submit the transaction - should succeed
        const txHash = await emulator.submitTx(tx);

        console.log(`✅ TxBuilder transaction accepted`);
        console.log(`Transaction hash: ${txHash}\n`);

        expect(txHash).toBe(tx.hash.toString());

        // Verify value preservation manually
        expect(totalInputValue).toBe(totalOutputValue + tx.body.fee);
    });
});
