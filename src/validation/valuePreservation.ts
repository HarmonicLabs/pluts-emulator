import { Tx, Value } from "@harmoniclabs/plu-ts";
import { ValidationResult, validationSuccess, validationFailure } from "./types";

/**
 * Represents an asset identifier (policyId + assetName)
 */
type AssetId = string;

/**
 * Creates a unique identifier for an asset
 */
function getAssetId(policyId: string, assetName: Uint8Array): AssetId {
    return `${policyId}.${Buffer.from(assetName).toString('hex')}`;
}

/**
 * Adds assets from a Value to the asset map
 */
function addValueToMap(value: Value, assetMap: Map<AssetId, bigint>, multiply: number = 1): void {
    // Add lovelaces (ADA)
    const currentAda = assetMap.get('lovelaces') || BigInt(0);
    assetMap.set('lovelaces', currentAda + value.lovelaces * BigInt(multiply));

    // Add native tokens (skip lovelaces which have empty policy)
    for (const policyEntry of value.map) {
        const policyId = policyEntry.policy.toString();

        // Skip entries with empty policy (these represent lovelaces, already counted above)
        if (!policyId || policyId === '' || policyId === '00'.repeat(28)) {
            continue;
        }

        for (const asset of policyEntry.assets) {
            // Skip entries with empty asset name that represent lovelaces
            if (asset.name.length === 0) {
                continue;
            }

            const assetId = getAssetId(policyId, asset.name);
            const currentAmount = assetMap.get(assetId) || BigInt(0);
            assetMap.set(assetId, currentAmount + asset.quantity * BigInt(multiply));
        }
    }
}

/**
 * Validates that value is preserved in a transaction.
 *
 * The fundamental rule of blockchain: value cannot be created or destroyed.
 *
 * Formula: inputs_value + minted_value = outputs_value + fee
 *
 * This applies to ALL assets (ADA + native tokens):
 * - For ADA: inputs = outputs + fee (cannot mint/burn ADA)
 * - For native tokens: inputs + minted = outputs (can mint/burn tokens)
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
        // Maps to track all assets: AssetId -> total quantity
        const inputAssets = new Map<AssetId, bigint>();
        const outputAssets = new Map<AssetId, bigint>();
        const mintedAssets = new Map<AssetId, bigint>();

        // 1. Calculate total input value (all assets)
        const missingInputs: string[] = [];

        for (const input of tx.body.inputs) {
            const inputRef = input.utxoRef.toString();
            const utxo = ledgerUtxos.get(inputRef);

            if (!utxo) {
                missingInputs.push(inputRef);
                continue;
            }

            addValueToMap(utxo.resolved.value, inputAssets);
        }

        if (missingInputs.length > 0) {
            return validationFailure(
                `Cannot validate value preservation: missing inputs in ledger`,
                { missingInputs }
            );
        }

        // 2. Calculate total output value (all assets)
        for (const output of tx.body.outputs) {
            addValueToMap(output.value, outputAssets);
        }

        // 3. Add fee to outputs (fee is paid in ADA)
        const fee = tx.body.fee;
        const currentOutputAda = outputAssets.get('lovelaces') || BigInt(0);
        outputAssets.set('lovelaces', currentOutputAda + fee);

        // 4. Calculate minted/burned value (all assets)
        if (tx.body.mint) {
            addValueToMap(tx.body.mint, mintedAssets);

            // Check that ADA is never minted or burned
            const mintedAda = mintedAssets.get('lovelaces') || BigInt(0);
            if (mintedAda !== BigInt(0)) {
                return validationFailure(
                    `Cannot mint or burn lovelaces (ADA)`,
                    { attemptedMint: mintedAda.toString() }
                );
            }
        }

        // 5. Get all unique asset IDs from inputs, outputs, and minting
        const allAssetIds = new Set<AssetId>([
            ...inputAssets.keys(),
            ...outputAssets.keys(),
            ...mintedAssets.keys()
        ]);

        // 6. Check value preservation for EACH asset
        // Formula: inputs[asset] + minted[asset] = outputs[asset]
        for (const assetId of allAssetIds) {
            const inputAmount = inputAssets.get(assetId) || BigInt(0);
            const outputAmount = outputAssets.get(assetId) || BigInt(0);
            const mintedAmount = mintedAssets.get(assetId) || BigInt(0);

            // Check: inputs + minted = outputs
            const expectedOutput = inputAmount + mintedAmount;

            if (expectedOutput !== outputAmount) {
                const difference = expectedOutput - outputAmount;

                // Format asset name for error message
                const isAda = assetId === 'lovelaces';
                const assetName = isAda ? 'ADA' : assetId;
                const differenceAda = isAda ? Number(difference) / 1_000_000 : Number(difference);

                let errorMessage: string;
                if (difference > 0) {
                    errorMessage = isAda
                        ? `Value not preserved: destroying ${Math.abs(differenceAda)} ADA`
                        : `Value not preserved: destroying ${Math.abs(differenceAda)} of token ${assetName}`;
                } else {
                    errorMessage = isAda
                        ? `Value not preserved: creating ${Math.abs(differenceAda)} ADA from nothing`
                        : `Value not preserved: creating ${Math.abs(differenceAda)} of token ${assetName} from nothing`;
                }

                return validationFailure(errorMessage, {
                    asset: assetId,
                    inputAmount: inputAmount.toString(),
                    outputAmount: outputAmount.toString(),
                    mintedAmount: mintedAmount.toString(),
                    expectedOutput: expectedOutput.toString(),
                    difference: difference.toString(),
                    differenceFormatted: isAda ? `${differenceAda.toFixed(6)} ADA` : `${differenceAda} ${assetName}`,
                    equation: {
                        expected: `${inputAmount} + ${mintedAmount} = ${expectedOutput}`,
                        actual: `${inputAmount} + ${mintedAmount} = ${outputAmount}`,
                        valid: false
                    }
                });
            }
        }

        // All assets preserved!
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
