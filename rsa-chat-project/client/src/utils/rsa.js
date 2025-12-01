// TEMPAT ANGGOTA 1 MENULIS KODE RSA
import bigInt from "big-integer";

export const generateKeys = () => {
    console.log("Generating keys...");
    // Logika p, q, n, e, d di sini
    return { publicKey: {}, privateKey: {} };
};

export const encrypt = (message, publicKey) => {
    return "CONTOH_ENKRIPSI_" + message; // Ganti dengan logika RSA
};

export const decrypt = (cipherText, privateKey) => {
    return cipherText.replace("CONTOH_ENKRIPSI_", ""); // Ganti dengan logika RSA
};