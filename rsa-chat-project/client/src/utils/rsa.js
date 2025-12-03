import bigInt from "big-integer";

// helper: generate bilangan prima random
const generateRandomPrime = (bitLength) => {
  // generate angka random sesuai bitlength
  let min = bigInt(2).pow(bitLength - 1);
  let max = bigInt(2).pow(bitLength);
  
  // generate bigint antara min dan max
  let randomNum = bigInt.randBetween(min, max);
  
  // cari bilangan prima berikutnya
  while (!randomNum.isPrime()) {
    randomNum = randomNum.add(1);
  }
  
  return randomNum;
};

// generate kunci rsa (dipanggil pas register)
export const generateKeys = async () => {
  // pake bilangan prima random (bitlength kecil biar cepet)
  // kalo production, pake bitlength >= 1024
  const bitLength = 64; // diperkecil biar cepet
  
  console.log("🔑 generating rsa keys...");
  
  const p = generateRandomPrime(bitLength);
  const q = generateRandomPrime(bitLength);
  
  // pastiin p dan q beda
  let finalQ = q;
  while (p.equals(finalQ)) {
    finalQ = generateRandomPrime(bitLength);
  }
  
  const n = p.multiply(finalQ);
  const phi = p.minus(1).multiply(finalQ.minus(1));
  
  const e = bigInt(65537); // nilai e standar
  
  // pastiin gcd(e, phi) = 1
  if (!bigInt.gcd(e, phi).equals(1)) {
    // kalo ga coprime, generate ulang
    return generateKeys();
  }
  
  const d = e.modInv(phi); // cari private key (modular inverse)

  console.log("✅ rsa keys generated!");
  console.log("public key (e):", e.toString());
  console.log("public key (n):", n.toString().substring(0, 20) + "...");

  return {
    publicKey: { e: e.toString(), n: n.toString() },
    privateKey: { d: d.toString(), n: n.toString() }
  };
};

// enkripsi: pesan -> ascii -> rumus rsa
export const encrypt = (message, publicKey) => {
  try {
    const e = bigInt(publicKey.e);
    const n = bigInt(publicKey.n);
    
    // pecah pesan jadi array kode ascii
    const textCodes = message.split('').map(char => char.charCodeAt(0));
    
    // enkripsi tiap karakter: c = m^e mod n
    const encryptedCodes = textCodes.map(code => {
      return bigInt(code).modPow(e, n).toString();
    });

    console.log("🔒 encrypted:", message, "->", encryptedCodes.length, "blocks");
    return encryptedCodes; // return array ciphertext
  } catch (error) {
    console.error("encryption error:", error);
    return [];
  }
};

// dekripsi: ciphertext -> rumus rsa -> ascii -> pesan
export const decrypt = (cipherArray, privateKey) => {
  try {
    if (!cipherArray || !Array.isArray(cipherArray) || cipherArray.length === 0) {
      console.error("invalid cipher array");
      return "[Error: Invalid cipher]";
    }

    const d = bigInt(privateKey.d);
    const n = bigInt(privateKey.n);

    // dekripsi tiap blok: m = c^d mod n
    const decryptedCodes = cipherArray.map(cipher => {
      const decrypted = bigInt(cipher).modPow(d, n);
      return decrypted.toJSNumber();
    });

    // gabungin kode ascii jadi string
    const result = String.fromCharCode(...decryptedCodes);
    console.log("🔓 decrypted:", cipherArray.length, "blocks ->", result);
    return result;
  } catch (error) {
    console.error("decryption error:", error);
    return "[Error: Decryption failed]";
  }
};