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

async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  if (!storedHash.startsWith("scrypt$")) {
    return storedHash === password;
  }

  const [, salt, hashHex] = storedHash.split("$");
  const derivedKey = await scryptAsync(password, salt);
  const hashBuffer = Buffer.from(hashHex, "hex");

  if (hashBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, derivedKey);
}

module.exports = {
  verifyPassword
};
