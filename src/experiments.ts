import { Address, AddressStr, IUTxO, Value } from "@harmoniclabs/plu-ts";
import { generateRandomBech32Address } from "./utils/helper";

/**
 * Generate a random transaction hash for testing
 * @param index - Index to incorporate into the hash (will be the first byte)
 * @returns A 64-character hex string (32 bytes)
 */
function generateRandomTxHash(index: number): string {
    const buffer = Buffer.alloc(32);
    buffer[0] = index;

    // Fill the rest with random-like data based on index
    for (let i = 1; i < 32; i++) {
        buffer[i] = (index * i + i * i) % 256;
    }

    return buffer.toString('hex');
}

/**
 * Create an initial UTxO for the emulator
 * @param lovelaces - Amount of ADA in lovelaces
 * @param address - Cardano address (as string or Address object)
 * @param txHash - Transaction hash ID
 * @returns A UTxO object
 */
function createInitialUTxO(
    lovelaces: bigint,
    address: AddressStr | Address,
    txHash: string
): IUTxO {
    const addr = typeof address === "string" ? Address.fromString(address) : address;

    return {
        utxoRef: {
            id: txHash,
            index: 0
        },
        resolved: {
            address: addr,
            value: Value.lovelaces(lovelaces),
            datum: undefined,
            refScript: undefined
        }
    };
}

/**
 * Create multiple random initial UTxOs for testing
 * @param numUtxos - Number of UTxOs to create
 * @param targetAmount - Amount of ADA per UTxO in lovelaces (default: 100 ADA)
 * @returns Array of UTxO objects
 */
function createRandomInitialUtxos(
    numUtxos: number,
    targetAmount: bigint = 100_000_000n
): IUTxO[] {
    if (numUtxos === 0) {
        return [];
    }

    const utxos: IUTxO[] = [];

    for (let i = 0; i < numUtxos; i++) {
        const address = generateRandomBech32Address();
        const txHash = generateRandomTxHash(i);
        const utxo = createInitialUTxO(targetAmount, address, txHash);
        utxos.push(utxo);
    }

    return utxos;
}

export const experimentFunctions = {
    generateRandomTxHash,
    createInitialUTxO,
    createRandomInitialUtxos
};
