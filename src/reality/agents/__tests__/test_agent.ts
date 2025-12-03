import 'dotenv/config';
import { WebSearchAgent } from '../web_search_agent';

async function testWebSearchAgent() {
    try {
        console.log('\n=== WEB SEARCH AGENT TEST ===\n');

        const agent = new WebSearchAgent();
        console.log('✓ Agent initialized');

        // Mock variable for testing
        const testVariable = {
            variable_id: 'test-123',
            symbol: 'ELON-IQ',
            name: 'Elon Musk Intelligence',
            description: 'Perceived intelligence based on decisions and statements',
            category: 'tech',
            llm_context: 'Focus on business decisions, technical innovations, public statements'
        };

        console.log(`\nTesting discovery for: ${testVariable.name}...`);
        const events = await agent.discoverEventsForVariable(testVariable);

        console.log(`\n✓ Discovery complete. Found ${events.length} events.\n`);

        if (events.length > 0) {
            console.log('Sample Event:');
            const e = events[0];
            console.log(`  Summary: ${e.summary}`);
            console.log(`  Impact Score: ${e.impact_score}`);
            console.log(`  Confidence: ${e.confidence}`);
            console.log(`  Reasoning: ${e.reasoning}`);
            console.log(`  Sources: ${e.sources.join(', ')}`);
        } else {
            console.log('No events found. Check logs for errors.');
        }

        console.log('\n✅ Web Search Agent test passed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testWebSearchAgent();
