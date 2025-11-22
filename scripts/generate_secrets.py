"""
Generate secure secrets for production deployment.
Run this script to generate new secrets for Railway deployment.
"""
import secrets

def generate_secrets():
    """Generate secure random secrets."""
    print("=" * 60)
    print("Everything Market - Secret Generation")
    print("=" * 60)
    print("\nGenerate these secrets for your Railway deployment:\n")
    
    secrets_config = {
        "REALITY_API_SECRET": secrets.token_urlsafe(32),
        "ADMIN_API_KEY": secrets.token_urlsafe(32),
        "JWT_SECRET": secrets.token_urlsafe(32),
    }
    
    for key, value in secrets_config.items():
        print(f"{key}={value}")
    
    print("\n" + "=" * 60)
    print("⚠️  IMPORTANT:")
    print("  1. Copy these secrets to Railway environment variables")
    print("  2. Never commit these to Git")
    print("  3. Store securely in password manager")
    print("=" * 60)
    
    # Save to file (gitignored)
    with open(".secrets.txt", "w") as f:
        f.write("# Generated secrets - DO NOT COMMIT\n")
        f.write("# Add these to Railway environment variables\n\n")
        for key, value in secrets_config.items():
            f.write(f"{key}={value}\n")
    
    print("\n✅ Secrets saved to .secrets.txt (gitignored)")

if __name__ == "__main__":
    generate_secrets()
