const crypto = require("crypto");

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: node scripts/hash-password.js '<new-password>'");
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  process.stdout.write(`scrypt$${salt}$${derivedKey.toString("hex")}\n`);
}

main().catch((error) => {
  console.error("[hash-password]", error.message);
  process.exit(1);
});
