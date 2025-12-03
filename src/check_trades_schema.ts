import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env') });

import { query } from './infra/db/pool';

async function checkSchema() {
    try {
        const result = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'");
        console.log('Orders columns:', result.rows.map(r => r.column_name));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
