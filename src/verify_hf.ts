import 'dotenv/config';
import { HfInference } from '@huggingface/inference';

async function verify() {
    const key = process.env.HUGGINGFACE_API_KEY;
    const hf = new HfInference(key);

    const model = 'Qwen/Qwen2.5-7B-Instruct';

    try {
        console.log(`\nTesting ${model} with chatCompletion...`);
        const res = await hf.chatCompletion({
            model: model,
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10
        });
        console.log('✅ Success:', res.choices[0].message.content);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

verify();
