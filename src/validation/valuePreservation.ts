import { Tx, Value } from "@harmoniclabs/plu-ts";
import { ValidationResult, validationSuccess, validationFailure } from "./types";

/**
 * Validates that value is preserved in a transaction.
 *
 * The fundamental rule of blockchain: value cannot be created or destroyed.
 *
 * Formula: inputs_value + minted_value = outputs_value + burned_value + fee
 *
 * Or equivalently: inputs_value = outputs_value + fee + burned_value - minted_value
 *
 * @param tx Transaction to validate
 * @param ledgerUtxos Map of available UTxOs in the ledger (to resolve input values)
 * @returns ValidationResult indicating if value is preserved
 */
export function validateValuePreservation(
    tx: Tx,
    ledgerUtxos: Map<string, { resolved: { value: Value } }>
): ValidationResult {
    try {
        // 1. Calculate total input value
        let inputValue = BigInt(0);
        const missingInputs: string[] = [];

        for (const input of tx.body.inputs) {
            const inputRef = input.utxoRef.toString();
            const utxo = ledgerUtxos.get(inputRef);

            if (!utxo) {
                missingInputs.push(inputRef);
                continue;
            }

            inputValue += utxo.resolved.value.lovelaces;
        }

        if (missingInputs.length > 0) {
            return validationFailure(
                `Cannot validate value preservation: missing inputs in ledger`,
                { missingInputs }
            );
        }

        // 2. Calculate total output value
        let outputValue = BigInt(0);
        for (const output of tx.body.outputs) {
            outputValue += output.value.lovelaces;
        }

        // 3. Get fee
        const fee = tx.body.fee;

        // 4. Calculate minted value (positive if minting, negative if burning)
        let mintedValue = BigInt(0);
        if (tx.body.mint) {
            // Sum up all minted/burned tokens
            // For lovelaces, this should always be 0 (can't mint/burn ADA)
            // For now, we only check lovelaces (ADA)
            // TODO: Handle native tokens properly when implementing token validation
            const mintedLovelaces = tx.body.mint.lovelaces;
            if (mintedLovelaces !== BigInt(0)) {
                return validationFailure(
                    `Cannot mint or burn lovelaces (ADA)`,
                    {
                        attemptedMint: mintedLovelaces.toString()
                    }
                );
            }
            mintedValue = mintedLovelaces;
        }

        // 5. Check value preservation
        // inputs + minted = outputs + fee
        // Or: inputs = outputs + fee - minted (since minted for ADA is always 0)
        const expectedInputValue = outputValue + fee - mintedValue;

        if (inputValue !== expectedInputValue) {
            const difference = inputValue - expectedInputValue;
            const differenceAda = Number(difference) / 1_000_000;

            let errorMessage: string;
            if (difference > 0) {
                errorMessage = `Value not preserved: destroying ${Math.abs(differenceAda)} ADA`;
            } else {
                errorMessage = `Value not preserved: creating ${Math.abs(differenceAda)} ADA from nothing`;
            }

            return validationFailure(errorMessage, {
                inputValue: inputValue.toString(),
                outputValue: outputValue.toString(),
                fee: fee.toString(),
                mintedValue: mintedValue.toString(),
                expectedInputValue: expectedInputValue.toString(),
                difference: difference.toString(),
                differenceAda: differenceAda.toFixed(6),
                equation: {
                    expected: `${inputValue.toString()} = ${outputValue.toString()} + ${fee.toString()}`,
                    actual: `${inputValue.toString()} ≠ ${expectedInputValue.toString()}`
                }
            });
        }

        // Value is preserved!
        return validationSuccess();

    } catch (error) {
        return validationFailure(
            `Error during value preservation validation: ${error}`,
            { error: String(error) }
        );
    }
}

/**
 * Helper function to calculate total value in a Value object
 * Currently only handles lovelaces (ADA)
 *
 * @param value Value object
 * @returns Total lovelaces
 */
export function getTotalLovelaces(value: Value): bigint {
    return value.lovelaces;
}

/**
 * Helper to format lovelaces as ADA for display
 * @param lovelaces Amount in lovelaces
 * @returns Formatted string like "100.000000 ADA"
 */
export function formatAda(lovelaces: bigint): string {
    const ada = Number(lovelaces) / 1_000_000;
    return `${ada.toFixed(6)} ADA`;
}
