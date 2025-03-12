import { Emulator } from "../src/Emulator";
import { CanResolveToUTxO, TxBuilder, defaultMainnetGenesisInfos, normalizedGenesisInfos } from "@harmoniclabs/buildooor";
import { defaultProtocolParameters, IUTxO, Tx, TxOutRefStr, UTxO } from "@harmoniclabs/cardano-ledger-ts";
import { experimentFunctions } from "../src/experiments";

describe("Emulator Tests", () => {
    let emulator: Emulator;
    let txBuilder: TxBuilder;
    let utxosInit: IUTxO[];
    let consoleWarnSpy;
    let consoleLogSpy;

    beforeEach(() => {
        utxosInit = experimentFunctions.createRandomInitialUtxos(2);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
        txBuilder = new TxBuilder(defaultProtocolParameters, defaultMainnetGenesisInfos);
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    })

    it("should warn when called with invalid block height", () => {
        emulator.awaitBlock(0);
        expect(consoleWarnSpy).toHaveBeenCalledWith("Invalid call to awaitBlock. Argument height must be greater than zero.");
    });

    it("should advance to the next block and clear the mempool", () => {
        // Build and submit a transaction
        const utxo = emulator.getUtxos().values().next().value;
        const tx = txBuilder.buildSync({
            inputs: [utxo],
            outputs: [],
            changeAddress: utxo.resolved.address,
        });
        emulator.submitTx(tx);

        expect(emulator.thisMempool.size()).toBeGreaterThan(0);

        // Await block processing
        emulator.awaitBlock(1);

        // Verify that the mempool is empty after block processing
        expect(emulator.thisMempool.size()).toBe(0);
        expect(emulator.getUtxos().size).toBeGreaterThan(0); // Ensure UTXOs were updated
    });

    it("should throw warning if transaction is too large to fit in the block", () => {
        const utxo = emulator.getUtxos().values().next().value;
        let tx = txBuilder.buildSync({
            inputs: [utxo],
            outputs: [],
            changeAddress: utxo.resolved.address,
        });

        // Mock the `getTxSize` method to return a size greater than the block limit
        jest.spyOn(emulator, "getTxSize").mockReturnValue(90000);

        // Submit the large transaction to the emulator's mempool
        emulator.submitTx(tx);

        // Process a block
        emulator.awaitBlock(1);

        // Verify the warning was logged
        expect(consoleWarnSpy).toHaveBeenCalledWith("Transaction too large to fit in block. Skipping transaction.");
    })

    it('should return the genesis infos', async () => {
        const result = await emulator.getGenesisInfos();
        const val = normalizedGenesisInfos(defaultMainnetGenesisInfos);
    
        expect(result).toEqual(val);
    });

    it('should return the protocol parameters', async () => {
        const result = await emulator.getProtocolParameters();
    
        expect(result).toEqual(defaultProtocolParameters);
    });

    // Tests for: resolveUtxos
    describe("Emulator - resolveUtxos", () => {
        let emulator: Emulator;
        let mockUtxos: IUTxO[];
        let txRef1;
        let txRef2;
    
        beforeEach(() => {
            mockUtxos = experimentFunctions.createRandomInitialUtxos(2);
            txRef1 = mockUtxos[0].utxoRef.id.toString();
            txRef2 = mockUtxos[1].utxoRef.id.toString();
            emulator = new Emulator(mockUtxos);
        });
    
        it("should resolve valid UTXOs from given references", async () => {
            const utxoRefs: CanResolveToUTxO[] = [`${txRef1}#0`, `${txRef2}#0`];
            const result = await emulator.resolveUtxos(utxoRefs);
    
            expect(result).toHaveLength(2);
            expect(result[0]?.utxoRef.id.toString()).toBe(txRef1);
            expect(result[1]?.utxoRef.id.toString()).toBe(txRef2);
        });
    
        it("should filter out invalid UTXO references", async () => {
            const utxoRefs: CanResolveToUTxO[] = [`${txRef1}#0`, "invalidRef#1"];
            const result = await emulator.resolveUtxos(utxoRefs);
    
            expect(result).toHaveLength(1);
            expect(result[0]?.utxoRef.id.toString()).toBe(txRef1);
        });
    
        it("should handle duplicate UTXO references", async () => {
            const utxoRefs: CanResolveToUTxO[] = [`${txRef1}#0`, `${txRef1}#0`, `${txRef2}#0`];
            const result = await emulator.resolveUtxos(utxoRefs);
    
            expect(result).toHaveLength(2); // Deduplicated
            expect(result[0]?.utxoRef.id.toString()).toBe(txRef1);
            expect(result[1]?.utxoRef.id.toString()).toBe(txRef2);
        });
    
        it("should return an empty array if no valid references are provided", async () => {
            const utxoRefs: CanResolveToUTxO[] = ["invalidRef#1", "invalidRef#2"];
            const result = await emulator.resolveUtxos(utxoRefs);
    
            expect(result).toHaveLength(0);
        });
    
        it("should return an empty array for an empty input", async () => {
            const utxoRefs: CanResolveToUTxO[] = [];
            const result = await emulator.resolveUtxos(utxoRefs);
    
            expect(result).toHaveLength(0);
        });
    });

    // Tests for: printUtxos
    it("should print details of a single UTxO", () => {
        const mockUTxO: UTxO = {
            utxoRef: {
                id: "mockRefId",
                index: 0,
            },
            resolved: {
                address: {
                    type: "base",
                    network: "mainnet",
                    paymentCreds: {
                        hash: "mockHash",
                    },
                    stakeCreds: "mockStakeCreds",
                },
                value: {
                    map: [
                        {
                            policy: "mockPolicy",
                            assets: [
                                { name: "mockAsset", quantity: 1000 },
                                { name: "", quantity: 500 }, // Lovelace
                            ],
                        },
                    ],
                },
                datum: "mockDatum",
                refScript: "mockRefScript",
            },
        } as unknown as UTxO;

        jest.spyOn(emulator, "printUtxo"); // Spy on the printUtxo method

        emulator.printUtxo(mockUTxO, 2);

        // Verify the console.log outputs
        expect(consoleLogSpy).toHaveBeenCalledWith("UTxO Ref ID:", "mockRefId");
        expect(consoleLogSpy).toHaveBeenCalledWith("UTxO Ref Index:", 0);
        expect(consoleLogSpy).toHaveBeenCalledWith("Network:", "mainnet");
        expect(consoleLogSpy).toHaveBeenCalledWith("Payment Credentials:", {
            hash: "mockHash",
        });
        expect(consoleLogSpy).toHaveBeenCalledWith("Stake Credentials:", "mockStakeCreds");
        expect(consoleLogSpy).toHaveBeenCalledWith("Value: {");
        expect(consoleLogSpy).toHaveBeenCalledWith("  Assets:");
        expect(consoleLogSpy).toHaveBeenCalledWith("    Policy:", "mockPolicy");
        expect(consoleLogSpy).toHaveBeenCalledWith("      Asset:", "mockAsset");
        expect(consoleLogSpy).toHaveBeenCalledWith("      Quantity:", 1000);
        expect(consoleLogSpy).toHaveBeenCalledWith("      Asset: lovelaces");
        expect(consoleLogSpy).toHaveBeenCalledWith("      Quantity:", 500);
        expect(consoleLogSpy).toHaveBeenCalledWith("  Datum:", "mockDatum");
        expect(consoleLogSpy).toHaveBeenCalledWith("  Reference Script:", "mockRefScript");
    });

    it("should print all UTxOs in the map", () => {
        const mockUTxOs = new Map<string, UTxO>([
            [
                "mockRef1",
                {
                    utxoRef: { id: "mockRef1", index: 0 },
                    resolved: {
                        address: {
                            type: "base",
                            network: "mainnet",
                            paymentCreds: { hash: "mockHash1" },
                        },
                        value: { map: [] },
                    },
                } as unknown as UTxO,
            ],
            [
                "mockRef2",
                {
                    utxoRef: { id: "mockRef2", index: 1 },
                    resolved: {
                        address: {
                            type: "base",
                            network: "mainnet",
                            paymentCreds: { hash: "mockHash2" },
                        },
                        value: { map: [] },
                    },
                } as unknown as UTxO,
            ],
        ]);

        jest.spyOn(emulator, "printUtxo"); // Spy on the printUtxo method

        emulator.printUtxos(mockUTxOs as any, 1);

        // Verify that printUtxo was called for each UTxO
        expect(emulator.printUtxo).toHaveBeenCalledTimes(2);
        expect(emulator.printUtxo).toHaveBeenCalledWith(mockUTxOs.get("mockRef1"), 1);
        expect(emulator.printUtxo).toHaveBeenCalledWith(mockUTxOs.get("mockRef2"), 1);
    });

    it("should print the address type when debugLevel is greater than 2", () => {
        const mockUTxO: UTxO = {
            utxoRef: {
                id: "mockRefId",
                index: 0,
            },
            resolved: {
                address: {
                    type: "base",
                    network: "mainnet",
                    paymentCreds: {
                        hash: "mockHash",
                    },
                    stakeCreds: "mockStakeCreds",
                },
                value: {
                    map: [],
                },
            },
        } as unknown as UTxO;
    
        emulator.printUtxo(mockUTxO, 3);
    
        // Verify that console.log outputs the address type
        expect(console.log).toHaveBeenCalledWith("Address Type:", "base");
    });

    // Tests for: submitTx 
    it("should add a valid transaction to the mempool", async () => {
        const utxo = emulator.getUtxos().values().next().value
        let mockTx = txBuilder.buildSync({
            inputs: [utxo],
            outputs: [],
            changeAddress: utxo.resolved.address,
        });

        // Mock isTxValid to always return true
        jest.spyOn(emulator as any, "isTxValid").mockReturnValue(true);

        // Submit the transaction
        await emulator.submitTx(mockTx);

        // Assertions
        expect(emulator.thisMempool.size()).toBe(1);
        expect(emulator.thisMempool.peek()).toBe(mockTx);
    });

    it("should reject an invalid transaction", async () => {
        const utxo = emulator.getUtxos().values().next().value
        let tx = txBuilder.buildSync({
            inputs: [utxo],
            outputs: [],
            changeAddress: utxo.resolved.address,
        });

        // Mock isTxValid to always return false
        jest.spyOn(emulator as any, "isTxValid").mockReturnValue(false);

        

        // Submit the transaction
        await emulator.submitTx(tx);

        // Assertions
        expect(emulator.thisMempool.size()).toBe(0);
        expect(consoleLogSpy).toHaveBeenCalledWith("Transaction is invalid");
    });

    it("should handle a transaction submitted as CBOR string", async () => {
        const mockTx = {
            hash: { toString: jest.fn().mockReturnValue("mockTxHash") },
        } as unknown as Tx;

        jest.spyOn(Tx, "fromCbor").mockReturnValue(mockTx);

        // Mock isTxValid to always return true
        jest.spyOn(emulator as any, "isTxValid").mockReturnValue(true);

        // Submit the transaction as CBOR
        const txCbor = "mockCborString";
        const txHash = await emulator.submitTx(txCbor);

        // Assertions
        expect(Tx.fromCbor).toHaveBeenCalledWith(txCbor);
        expect(txHash).toBe("mockTxHash");
        expect(emulator.thisMempool.size()).toBe(1);
        expect(emulator.thisMempool.peek()).toBe(mockTx);
    });

    // Tests for: getTxSize
    it("getTxSize returns correct size for a Tx instance", () => {
        // Create a dummy transaction with a large size
        const utxo = emulator.getUtxos().values().next().value;
        let tx = txBuilder.buildSync({
            inputs: [utxo],
            outputs: [],
            changeAddress: utxo.resolved.address,
        });
        const expectedSize = tx.toCbor().toBuffer().length;
        
        const size = emulator.getTxSize(tx);
        
        // Check if the size is correct
        expect(size).toBe(expectedSize);
    });
    
    it("getTxSize returns correct size for non-Tx CBOR object", () => {
        const mockCbor = {
            toBuffer: jest.fn().mockReturnValue(Buffer.from("mockCbor")),
        };

        const size = emulator.getTxSize(mockCbor as any);
        expect(size).toBe(Buffer.from("mockCbor").length);
    });
    
    it("getTxSize returns 0 for undefined", () => {
        const size = emulator.getTxSize(undefined);
        expect(size).toBe(0);
    });

    // Tests for: getTxMaxSize
    it('getTxMaxSize returns a number', () => {
        const maxSize = emulator.getTxMaxSize();
        expect(typeof maxSize).toBe('number');
    });

    it('returns the correct value from protocolParameters.maxTxSize', () => {
        const maxSize = emulator.getTxMaxSize();
        expect(maxSize).toBe(defaultProtocolParameters.maxTxSize);
    });
});