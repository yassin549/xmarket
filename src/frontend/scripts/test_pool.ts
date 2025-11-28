import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

import { getPool } from '../lib/infra/db/pool';

async function test() {
    console.log('Testing pool import...');
    try {
        const pool = getPool();
        console.log('Pool initialized:', !!pool);
        console.log('Test complete');
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
