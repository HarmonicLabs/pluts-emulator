import { Address, AddressStr, CanBeTxOutRef, TxOutRef, defaultProtocolParameters, forceTxOutRefStr, Hash32, isProtocolParameters, IUTxO, ProtocolParameters, StakeAddressBech32, Tx, TxOutRefStr, UTxO } from "@harmoniclabs/cardano-ledger-ts"
import { StakeAddressInfos } from "./types/StakeAddressInfos";
import { CanBeData,  CanResolveToUTxO, defaultMainnetGenesisInfos, GenesisInfos, IGetGenesisInfos, IGetProtocolParameters, IProvider, IResolveDatumHashes, IResolveUTxOs, isGenesisInfos, ISubmitTx, normalizedGenesisInfos, NormalizedGenesisInfos, TxBuilder, TxBuilderRunner } from "@harmoniclabs/plu-ts-offchain"
import { debug } from "console";

class Queue<T> {
    private items: T[] = [];

    enqueue(item: T): void {
        this.items.push(item);
    }

    dequeue(): T | undefined {
        return this.items.shift();
    }

    peek(): T | undefined {
        return this.items[0];
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    size(): number {
        return this.items.length;
    }

    asArray(): T[] {
        return this.items;
    }
}

export class Emulator
implements IGetGenesisInfos, IGetProtocolParameters, IResolveUTxOs, ISubmitTx
{
    private readonly utxos: Map<TxOutRefStr,UTxO>;
    private readonly stakeAddresses: Map<StakeAddressBech32, StakeAddressInfos>;
    private readonly addresses: Map<AddressStr, Set<TxOutRefStr>>;

    private debugLevel: number;
    private readonly mempool: Queue<Tx>;

    private time: number;
    private slot: number;
    private blockHeight: number;

    private readonly genesisInfos: NormalizedGenesisInfos;
    private readonly protocolParameters: ProtocolParameters;

    readonly txBuilder: TxBuilder;

    constructor(
        initialUtxoSet: Iterable<IUTxO> = [],
        genesisInfos: GenesisInfos = defaultMainnetGenesisInfos,
        protocolParameters: ProtocolParameters = defaultProtocolParameters,
        debugLevel: number = 1,
    )
    {
        if( !isGenesisInfos( genesisInfos ) ) genesisInfos = defaultMainnetGenesisInfos;
        this.genesisInfos = normalizedGenesisInfos( genesisInfos );

        if( !isProtocolParameters( protocolParameters ) ) protocolParameters = defaultProtocolParameters;
        this.protocolParameters = protocolParameters;

        this.txBuilder = new TxBuilder( this.protocolParameters, this.genesisInfos );
        this.mempool = new Queue<Tx>();
        this.debugLevel = debugLevel;

        this.time = this.genesisInfos.systemStartPosixMs;
        this.slot = this.genesisInfos.startSlotNo;
        this.blockHeight = 0;
        
        this.utxos = new Map();
        this.stakeAddresses = new Map();
        this.addresses = new Map();

        for( const iutxo of initialUtxoSet )
        {
            this.pushUtxo( new UTxO( iutxo ) );
        }
    }
    getUtxos(): Map<TxOutRefStr, UTxO>
    {
        return new Map( this.utxos );
    }
    private pushUtxo( utxo: UTxO ): void
    {
        const ref = utxo.utxoRef.toString();

        if( !this.utxos.has( ref ) )
        {
            this.utxos.set( ref, utxo );

            const addr = utxo.resolved.address.toString();
            if( !this.addresses.has( addr ) ) this.addresses.set( addr, new Set() );

            this.addresses.get( addr )!.add( ref );
        }
    }


    // tbd - awaitSlot


    // awaitBlock:
    // go through the mempool
    //    - For each transaction:
    //       - If yes:
    //          - consume the UTxOs in input (remove from utxo)
    //          - add the UTxOs in output (add to utxo)
    //       - If no:
    //          - remove the transaction from the mempool
    // Moves time forward to the next blockNumber block

    awaitBlock (height : number = 1) : void {
        if (height <= 0) {
            console.warn("Invalid block number. Must be greater than zero.");
        }
        
        while (height > 0) {

            this.blockHeight += height;
            this.slot += height * (this.genesisInfos.slotLengthMs / 1000);
            this.time += height * this.genesisInfos.slotLengthMs;

            let currentBlockUsed = 0

            while (!this.mempool.isEmpty()) {
                let txSize = this.getTxSize(this.mempool.peek())
                
                // check if tx size can fit in the block
                if (txSize && ((currentBlockUsed + txSize) < this.protocolParameters.maxBlockBodySize)) {
                    
                    const tx = this.mempool.dequeue()!;
                    
                    for (let i = 0; i < tx.body.inputs.length; i++){
                        this.removeUtxo(tx.body.inputs[i])
                    }
                    for (let i = 0; i < tx.body.outputs.length; i++){
                        this.pushUtxo(new UTxO({
                            resolved: tx.body.outputs[i],
                            utxoRef: new TxOutRef({
                                id: tx.hash.toString(), // to be verified
                                index: i
                            })
                        }))
                    }

                    currentBlockUsed += txSize;

                    txSize = this.getTxSize(this.mempool.peek())

                } else {
                    break;
                }
            }

            console.log(`Advanced to block number ${this.blockHeight} by height ${height} (slot ${this.slot}). Time: ${new Date(this.time).toISOString()}`);
        
            height -= 1;
        }
    }
   
    private removeUtxo( utxoRef: CanBeTxOutRef ): void
    {
        const ref = forceTxOutRefStr( utxoRef );
        const addr = this.utxos.get( ref )?.resolved.address.toString();

        if( typeof addr !== "string" ) return;

        this.utxos.delete( ref );

        const addrRefs = this.addresses.get( addr )!;
        addrRefs.delete( ref );

        if( addrRefs.size <= 0 ) this.addresses.delete( addr );
    }

    getGenesisInfos(): Promise<GenesisInfos>
    {
        return Promise.resolve({ ...this.genesisInfos });
    }

    getProtocolParameters(): Promise<ProtocolParameters>
    {
        return Promise.resolve( this.protocolParameters );
    }

    /**
     * resolves the utxos that are present on the current ledger state
     * 
     * if some of the specified utxos are not present (have been spent already)
     * they will be filtered out
    */
    resolveUtxos( utxos: CanResolveToUTxO[] ): Promise<UTxO[]>
    {
        return Promise.resolve(
            [ ...new Set<TxOutRefStr>( utxos.map( forceTxOutRefStr ) ) ]
            .map( ref => this.utxos.get( ref )?.clone() )
            .filter( u => u instanceof UTxO ) as UTxO[]
        );
    }

    /**
     * Print the mempool
     */
    printMempool(): void {
        console.log("Mempool:");
        for (let i = 0; i < this.mempool.size(); i++){
            console.log("Transaction ID:", this.mempool.asArray()[i].hash.toString());
            console.log("Transaction Inputs:");
            for (let j = 0; j < this.mempool.asArray()[i].body.inputs.length; j++){
                console.log("  Input ID:", this.mempool.asArray()[i].body.inputs[j].toString());
            }
            console.log("Transaction Outputs:");
            for (let j = 0; j < this.mempool.asArray()[i].body.outputs.length; j++){
                console.log("  Output ID:", this.mempool.asArray()[i].body.outputs[j].toString());
            }
        }
    }
    /**
     * Print one UTXO
     */
    printUtxo(utxo: UTxO, debugLevel: number = 1): void {
        console.log("UTxO Ref ID:", utxo.utxoRef.id.toString());
        console.log("UTxO Ref Index:", utxo.utxoRef.index);
        if (debugLevel > 2) {
            console.log("Address Type:", utxo.resolved.address.type);
        }
        if (debugLevel > 1) {
            console.log("Network:", utxo.resolved.address.network);
        }
        if (debugLevel > 1) {
            console.log("Payment Credentials:", utxo.resolved.address.paymentCreds);
        } else {
            console.log("Payment Credentials (hex):", utxo.resolved.address.paymentCreds.hash.toString());
        }
        if (utxo.resolved.address.stakeCreds) {
            console.log("Stake Credentials:", utxo.resolved.address.stakeCreds);
        }
        console.log("Value: {");
        console.log("  Assets:");
        utxo.resolved.value.map.forEach(asset => {
            console.log("    Policy:", asset.policy);
            asset.assets.forEach(a => {
                if (a.name.toString() == "") {
                    console.log("      Asset: lovelaces");
                }
                else {
                    console.log("      Asset:", a.name);
                }
                console.log("      Quantity:", a.quantity);
            });
        });
        if (utxo.resolved.datum) {
            console.log("  Datum:", utxo.resolved.datum);
        }
        if (utxo.resolved.refScript) {
            console.log("  Reference Script:", utxo.resolved.refScript);
        }
        console.log("}");
    }
    /**
     * Print all the UTXOs
     */
    printUtxos(utxos: Map<TxOutRefStr, UTxO>, debugLevel: number = 1): void {
        for (let utxo of utxos.values()){
            this.printUtxo(utxo, debugLevel);
        }
    }

    /**
     * validates and submits a transaction to the emulated blockchain
    */
    submitTx( txCBOR: string | Tx ): Promise<string>
    {
        // TODO add some tx validation
        const tx = txCBOR instanceof Tx ? txCBOR : Tx.fromCbor( txCBOR );
        if (this.isTxValid(tx)) {
            this.mempool.enqueue( tx );
        }
        else {
            // Add a debug level and some more useful information
            console.log("Transaction is invalid")
        }

        return Promise.resolve( tx.hash.toString() );
    }
    
    private isTxValid(tx: Tx) : boolean {
        // Check if the transaction is valid
        return true
    }

    getTxSize(tx: Tx | undefined) {
        return tx ? ((tx instanceof Tx ? tx.toCbor() : tx).toBuffer().length) : 0;
    }

    getTxMaxSize() {
        return Number(this.protocolParameters.maxTxSize);
    }
}