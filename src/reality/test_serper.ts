import 'dotenv/config';
import { SerperClient } from './services/serper_client';

async function testSerperClient() {
    try {
        console.log('\n=== SERPER CLIENT TEST ===\n');

        const client = new SerperClient();
        console.log('✓ Client initialized');

        console.log('\nSearching: "Elon Musk Tesla" (past day)...');
        const results = await client.search('Elon Musk Tesla', {
            num: 3,
            tbs: 'qdr:d'
        });

        console.log(`✓ Found ${results.length} results\n`);

        if (results.length > 0) {
            console.log('Sample Result:');
            console.log(`  Title: ${results[0].title}`);
            console.log(`  URL: ${results[0].link}`);
            console.log(`  Snippet: ${results[0].snippet.substring(0, 100)}...`);
        }

        console.log(`\n✅ Serper Client working!`);
        console.log(`API calls made: ${client.getUsageCount()}/2500 monthly limit\n`);

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testSerperClient();
