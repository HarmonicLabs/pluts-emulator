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
 * Adds a quantity to an asset in the map
 */
function addToAssetMap(assetMap: Map<AssetId, bigint>, assetId: AssetId, quantity: bigint): void {
    const current = assetMap.get(assetId) || BigInt(0);
    assetMap.set(assetId, current + quantity);
}

/**
 * Adds assets from a Value to the asset map
 */
function addValueToMap(value: Value, assetMap: Map<AssetId, bigint>, multiply: number = 1): void {
    // Add lovelaces (ADA)
    addToAssetMap(assetMap, 'lovelaces', value.lovelaces * BigInt(multiply));

    // Add native tokens
    for (const policyEntry of value.map) {
        const policyId = policyEntry.policy.toString();

        // Skip entries with empty/invalid policy ID
        if (!policyId || policyId === '') {
            continue;
        }

        for (const asset of policyEntry.assets) {
            // Skip entries with empty asset name
            if (asset.name.length === 0) {
                continue;
            }

            const assetId = getAssetId(policyId, asset.name);
            addToAssetMap(assetMap, assetId, asset.quantity * BigInt(multiply));
        }
    }
}

/**
 * Checks value preservation for a single asset
 * Formula: inputs_value + minted_value = outputs_value + burned_value + fee
 */
function checkAssetPreservation(
    assetId: AssetId,
    inputAssets: Map<AssetId, bigint>,
    outputAssets: Map<AssetId, bigint>,
    mintedAssets: Map<AssetId, bigint>,
    burnedAssets: Map<AssetId, bigint>,
    transactionFee: bigint
): ValidationResult | null {
    const inputAmount = inputAssets.get(assetId) || BigInt(0);
    const outputAmount = outputAssets.get(assetId) || BigInt(0);
    const mintedAmount = mintedAssets.get(assetId) || BigInt(0);
    const burnedAmount = burnedAssets.get(assetId) || BigInt(0);

    // For ADA, include fee on the right side
    const feeAmount = (assetId === 'lovelaces') ? transactionFee : BigInt(0);

    // Calculate both sides of the equation
    const leftSide = inputAmount + mintedAmount;
    const rightSide = outputAmount + burnedAmount + feeAmount;

    if (leftSide !== rightSide) {
        const difference = leftSide - rightSide;

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
            burnedAmount: burnedAmount.toString(),
            feeAmount: feeAmount.toString(),
            leftSide: leftSide.toString(),
            rightSide: rightSide.toString(),
            difference: difference.toString(),
            differenceFormatted: isAda ? `${differenceAda.toFixed(6)} ADA` : `${differenceAda} ${assetName}`,
            equation: {
                expected: `${inputAmount} + ${mintedAmount} = ${outputAmount} + ${burnedAmount} + ${feeAmount}`,
                leftSide: leftSide.toString(),
                rightSide: rightSide.toString(),
                valid: false
            }
        });
    }

    return null;
}

/**
 * Validates that value is preserved in a transaction.
 *
 * The fundamental rule of blockchain: value cannot be created or destroyed.
 *
 * Formula: inputs_value + minted_value = outputs_value + burned_value + fee
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
        const burnedAssets = new Map<AssetId, bigint>();

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

        // 3. Calculate minted and burned values (all assets)
        if (tx.body.mint) {
            // Separate positive (minted) and negative (burned) amounts
            for (const policyEntry of tx.body.mint.map) {
                const policyId = policyEntry.policy.toString();

                // Skip entries with empty/invalid policy ID
                if (!policyId || policyId === '') {
                    continue;
                }

                for (const asset of policyEntry.assets) {
                    // Skip entries with empty asset name
                    if (asset.name.length === 0) {
                        continue;
                    }

                    const assetId = getAssetId(policyId, asset.name);
                    const quantity = asset.quantity;

                    if (quantity > BigInt(0)) {
                        // Positive = minted
                        addToAssetMap(mintedAssets, assetId, quantity);
                    } else if (quantity < BigInt(0)) {
                        // Negative = burned (store as positive value)
                        addToAssetMap(burnedAssets, assetId, -quantity);
                    }
                }
            }

            // Check that ADA is never minted or burned
            const mintedAda = mintedAssets.get('lovelaces') || BigInt(0);
            const burnedAda = burnedAssets.get('lovelaces') || BigInt(0);
            if (mintedAda !== BigInt(0) || burnedAda !== BigInt(0)) {
                return validationFailure(
                    `Cannot mint or burn lovelaces (ADA)`,
                    {
                        attemptedMint: mintedAda.toString(),
                        attemptedBurn: burnedAda.toString()
                    }
                );
            }
        }

        // 4. Get all unique asset IDs from all maps
        const allAssetIds = new Set<AssetId>([
            ...inputAssets.keys(),
            ...outputAssets.keys(),
            ...mintedAssets.keys(),
            ...burnedAssets.keys()
        ]);

        // 5. Check value preservation for EACH asset
        // Formula: inputs_value + minted_value = outputs_value + burned_value + fee
        for (const assetId of allAssetIds) {
            const validationError = checkAssetPreservation(
                assetId,
                inputAssets,
                outputAssets,
                mintedAssets,
                burnedAssets,
                tx.body.fee
            );

            if (validationError) {
                return validationError;
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
