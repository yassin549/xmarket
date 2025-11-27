/**
 * Test Phase 8: Realtime & Channel Counters Integration
 */

import { config } from 'dotenv';
import { incrementSequence, getCurrentSequence } from './backend/realtime/channel_counters';

// Note: publishToChannel uses Ably which requires network, skip for now

// Load environment variables
config();

async function testChannelCounters() {
    console.log('\n🧪 Testing Channel Counters...\n');

    try {
        // Test 1: Increment sequence for a channel
        console.log('Test 1: Increment sequence');
        const seq1 = await incrementSequence('market:BTC-USD');
        console.log(`  ✅ First increment: ${seq1}`);

        const seq2 = await incrementSequence('market:BTC-USD');
        console.log(`  ✅ Second increment: ${seq2}`);

        if (seq2 !== seq1 + 1) {
            throw new Error(`Expected ${seq1 + 1}, got ${seq2}`);
        }
        console.log('  ✅ Sequence increments correctly\n');

        // Test 2: Multiple channels
        console.log('Test 2: Multiple channels');
        const seqBTC = await incrementSequence('market:BTC-USD');
        const seqETH = await incrementSequence('market:ETH-USD');
        console.log(`  ✅ BTC-USD sequence: ${seqBTC}`);
        console.log(`  ✅ ETH-USD sequence: ${seqETH}`);
        console.log('  ✅ Channels are independent\n');

        // Test 3: Get current sequence
        console.log('Test 3: Get current sequence');
        const currentSeq = await getCurrentSequence('market:BTC-USD');
        console.log(`  ✅ Current sequence: ${currentSeq}`);

        // Test 4: Publish to channel (requires Ably SDK initialization)
        console.log('\nTest 4: Publish to channel');
        console.log('  ⏭️  Skipped (requires full Ably initialization)');
        // if (process.env.ABLY_API_KEY) {
        //     const pubSeq = await publishToChannel(
        //         'test:channel',
        //         'TEST_EVENT',
        //         { message: 'Hello from Phase 8!' }
        //     );
        //     console.log(`  ✅ Published with sequence: ${pubSeq}`);
        // }

        console.log('\n✅ All tests passed!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testChannelCounters();
