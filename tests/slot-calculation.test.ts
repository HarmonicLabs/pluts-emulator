import { describe, it, expect, beforeEach } from '@jest/globals';
import { defaultMainnetGenesisInfos, defaultProtocolParameters } from "@harmoniclabs/buildooor";
import { Emulator } from "../src/Emulator";
import { experimentFunctions } from "../src/experiment";

describe("Slot Calculation Tests (Minimal)", () => {
    let emulator: Emulator;

    beforeEach(() => {
        const utxosInit = experimentFunctions.createRandomInitialUtxos(1);
        emulator = new Emulator(utxosInit, defaultMainnetGenesisInfos, defaultProtocolParameters);
    });

    it("should verify active slots coefficient (20 slots per block)", () => {
        const ACTIVE_SLOTS_COEFFICIENT = 0.05;
        const SLOTS_PER_BLOCK = 1 / ACTIVE_SLOTS_COEFFICIENT;
        
        console.log(`\n=== Cardano Active Slots Coefficient ===`);
        console.log(`Active slots coefficient (f): ${ACTIVE_SLOTS_COEFFICIENT}`);
        console.log(`Average slots per block: 1 / ${ACTIVE_SLOTS_COEFFICIENT} = ${SLOTS_PER_BLOCK}`);
        console.log(`This is where the "20" comes from!\n`);
        
        expect(SLOTS_PER_BLOCK).toBe(20);
    });

    it("should advance correctly by 1 block (20 slots)", () => {
        const initialSlot = emulator.getCurrentSlot();
        const initialTime = emulator.getCurrentTime();
        
        console.log(`\n=== Advancing 1 Block ===`);
        console.log(`Initial: Slot ${initialSlot}`);
        
        emulator.awaitBlock(1);
        
        const newSlot = emulator.getCurrentSlot();
        const elapsedSlots = newSlot - initialSlot;
        const elapsedMs = emulator.getCurrentTime() - initialTime;
        
        console.log(`After:   Slot ${newSlot}`);
        console.log(`Delta:   ${elapsedSlots} slots = ${elapsedMs}ms`);
        console.log(`Expected: 20 slots = 20,000ms\n`);
        
        expect(elapsedSlots).toBe(20);
        expect(elapsedMs).toBe(20_000); // 20 seconds
    });

    it("should advance correctly by slots (100 slots)", () => {
        const initialSlot = emulator.getCurrentSlot();
        
        console.log(`\n=== Advancing 100 Slots ===`);
        
        emulator.awaitSlot(100);
        
        const elapsedSlots = emulator.getCurrentSlot() - initialSlot;
        
        console.log(`Elapsed: ${elapsedSlots} slots\n`);
        
        expect(elapsedSlots).toBe(100);
    });

    it("should calculate block height from slots correctly", () => {
        console.log(`\n=== Block Height Calculation ===`);
        
        // Advance 60 slots = 3 blocks (60 / 20 = 3)
        emulator.awaitSlot(60);
        
        const blockHeight = emulator.getCurrentBlockHeight();
        
        console.log(`60 slots → ${blockHeight} blocks (expected: 3)`);
        
        expect(blockHeight).toBe(3);
    });

    it("should track epochs correctly (432,000 slots per epoch)", () => {
        console.log(`\n=== Epoch Tracking ===`);
        
        const initialEpoch = emulator.getCurrentEpoch();
        console.log(`Initial epoch: ${initialEpoch}`);
        
        // Advance to next epoch boundary
        emulator.awaitSlot(432_000);
        
        const newEpoch = emulator.getCurrentEpoch();
        console.log(`After 432,000 slots: Epoch ${newEpoch}`);
        console.log(`This represents 5 days of blockchain time\n`);
        
        expect(newEpoch).toBe(initialEpoch + 1);
    });

    it("should convert slot to POSIX time correctly", () => {
        console.log(`\n=== Slot to POSIX Conversion ===`);
        
        const currentSlot = emulator.getCurrentSlot();
        const currentTime = emulator.getCurrentTime();
        
        const convertedTime = Number(emulator.fromSlotToPosix(currentSlot));
        
        console.log(`Slot: ${currentSlot}`);
        console.log(`Current time: ${currentTime}ms`);
        console.log(`Converted time: ${convertedTime}ms`);
        console.log(`Match: ${currentTime === convertedTime ? '✓' : '✗'}\n`);
        
        expect(convertedTime).toBe(currentTime);
    });

    it("should verify 1 slot = 1 second (from genesis info)", () => {
        console.log(`\n=== Genesis Info Verification ===`);

        const slotLengthMs = Number(defaultMainnetGenesisInfos.slotLengthMs); // Convert to number
        if (isNaN(slotLengthMs) || slotLengthMs <= 0) {
            throw new Error("Invalid slot length in genesis info");
        }

        console.log(`Slot length from genesis: ${slotLengthMs}ms`);
        console.log(`This equals: ${slotLengthMs / 1000} second\n`);

        expect(slotLengthMs).toBe(1000); // Ensure slot length is 1000ms
    });
});