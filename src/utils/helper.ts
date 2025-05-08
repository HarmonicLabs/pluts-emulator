import { Address, AddressStr, Credential, IUTxO, Value } from "@harmoniclabs/plu-ts"
import { getRandomValues } from "crypto"

/**
 * Generate a random Bech32 address.
 */
export function generateRandomBech32Address(): AddressStr {
    const hash28i = getRandomValues(new Uint8Array(28))
    const testnetAddr = new Address(
        "testnet",
        Credential.keyHash(hash28i)
    )
    return testnetAddr.toString()
}
  
  /**
   * Generate a random transaction hash for testing
   */
export function generateRandomTxHash(salt: number = 0): string {
    // Create a predictable but unique hash based on salt
    return Array.from(
      { length: 64 },
      (_, i) => "0123456789abcdef"[(i + salt) % 16]
    ).join("");
  }
  
  /**
   * Create an initial UTxO for the emulator
   */
export function createInitialUTxO(lovelaces: bigint, address: Address, txHash: string): IUTxO {
    return {
      utxoRef: {
        id: txHash,
        index: 0
      },
      resolved: {
        address: address,
        value: Value.lovelaces(lovelaces),
        datum: undefined,
        refScript: undefined
      }
    };
  }