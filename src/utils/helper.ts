import { Address, AddressStr, Credential } from "@harmoniclabs/cardano-ledger-ts"
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

