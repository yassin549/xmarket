"""
TinyLlama Setup Script
Downloads and verifies TinyLlama-1.1B model
"""
import os
import sys

def download_tinyllama():
    """Download TinyLlama model"""
    print("=" * 60)
    print("TinyLlama-1.1B Download Script")
    print("=" * 60)
    
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch
        
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        cache_dir = os.getenv("TRANSFORMERS_CACHE", "./cache")
        
        print(f"\n📦 Model: {model_name}")
        print(f"📁 Cache: {cache_dir}")
        print(f"\n⏬ Downloading model (~1.1 GB)...")
        print("This may take 1-5 minutes depending on your connection.\n")
        
        # Download tokenizer
        print("1/2 Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=cache_dir
        )
        print("✅ Tokenizer downloaded!")
        
        # Download model
        print("\n2/2 Downloading model...")
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            cache_dir=cache_dir,
            low_cpu_mem_usage=True
        )
        print("✅ Model downloaded!")
        
        # Verify
        print("\n🧪 Testing model...")
        test_input = tokenizer("Hello!", return_tensors="pt")
        with torch.no_grad():
            output = model.generate(**test_input, max_new_tokens=5)
        result = tokenizer.decode(output[0], skip_special_tokens=True)
        print(f"✅ Model works! Test output: {result}")
        
        print("\n" + "=" * 60)
        print("✅ SUCCESS! TinyLlama is ready to use!")
        print("=" * 60)
        print(f"\n📍 Model cached at: {cache_dir}")
        print("\n🚀 Next steps:")
        print("   1. Run: python llm_server.py")
        print("   2. Server will start on http://localhost:8001")
        print("   3. Model loads instantly (already cached!)")
        
        return True
        
    except ImportError as e:
        print(f"\n❌ ERROR: Missing dependencies")
        print(f"   {e}")
        print("\n💡 Solution: pip install -r requirements-llm.txt")
        return False
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    success = download_tinyllama()
    sys.exit(0 if success else 1)
