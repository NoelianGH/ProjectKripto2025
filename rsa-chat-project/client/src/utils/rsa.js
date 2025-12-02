// TEMPAT ANGGOTA 1 MENULIS KODE RSA
import bigInt from "big-integer";
/**
 * Fungsi untuk membangkitkan kunci RSA.
 * * VARABEL INPUT UNTUK UI:
 * @param {string|number} input_Prime_P - Input dari user untuk bilangan Prima P
 * @param {string|number} input_Prime_Q - Input dari user untuk bilangan Prima Q
 * @param {string|number} input_E_Eksponen - (Opsional) Input user untuk nilai e. Kosongkan jika ingin auto-generate.
 * @param {string} message - Plaintext (String biasa)
 * @param {object} publicKey - Object { e, n }
 * @param {Array<string>} cipherText - Array berisi angka-angka string (hasil output encrypt)
 * @param {object} privateKey - Object { d, n }
 */
export const generateKeys = () => {
    console.log("Generating keys...");
    console.log("Generating keys with inputs:", input_Prime_P, input_Prime_Q);

    try {
        // 1. Konversi input ke BigInteger
        const p = bigInt(input_Prime_P);
        const q = bigInt(input_Prime_Q);

        // Validasi sederhana: p dan q tidak boleh sama
        if (p.equals(q)) {
            throw new Error("Peringatan: Nilai P dan Q tidak boleh sama.");
        }

        // 2. Hitung n = p * q
        const n = p.multiply(q);

        // 3. Hitung phi = (p - 1) * (q - 1)
        const phi = p.prev().multiply(q.prev());

        let e;

        // 4. Logika pemilihan e (Public Exponent)
        if (input_E_Eksponen && input_E_Eksponen.toString().trim() !== "") {
            // Jika user memasukkan nilai e manual
            e = bigInt(input_E_Eksponen);
            
            // Cek apakah e coprime dengan phi (gcd(e, phi) == 1)
            if (bigInt.gcd(e, phi).notEquals(1)) {
                throw new Error(`Nilai e = ${e} tidak relatif prima dengan phi. Silakan ganti nilai e.`);
            }
        } else {
            // Jika user mengosongkan e (Auto-select sesuai logika Python)
            // Kandidat umum seperti di Python script
            const candidates = [3, 5, 17, 257, 65537];
            let found = false;
            
            for (let cand of candidates) {
                let candBig = bigInt(cand);
                if (candBig.lesser(phi) && bigInt.gcd(candBig, phi).equals(1)) {
                    e = candBig;
                    found = true;
                    break;
                }
            }

            // Fallback: jika kandidat umum gagal, cari loop dari 3
            if (!found) {
                let current = bigInt(3);
                while (current.lesser(phi)) {
                    if (bigInt.gcd(current, phi).equals(1)) {
                        e = current;
                        found = true;
                        break;
                    }
                    current = current.add(2);
                }
            }
            
            if (!found) {
                throw new Error("Gagal menemukan e yang valid secara otomatis. Coba nilai P dan Q yang berbeda.");
            }
        }

        // 5. Hitung d (Private Key) -> modular inverse dari e mod phi
        // Python: modinv(e, phi)
        // BigInt JS: e.modInv(phi)
        const d = e.modInv(phi);

        console.log(`Keys Generated! n: ${n}, e: ${e}, d: ${d}`);

        // Mengembalikan object Keys
        // Kita konversi ke String agar aman saat dipindah-pindah di UI/JSON
        return { 
            publicKey: { e: e.toString(), n: n.toString() }, 
            privateKey: { d: d.toString(), n: n.toString() } 
        };

    } catch (error) {
        console.error("Error generating keys:", error.message);
        throw error; // Lempar error agar UI bisa menampilkan alert
    }
};

export const encrypt = (message, publicKey) => {
    if (!publicKey || !publicKey.e || !publicKey.n) {
        throw new Error("Public Key tidak valid.");
    }

    const e = bigInt(publicKey.e);
    const n = bigInt(publicKey.n);
    
    // Konversi string ke array of ASCII codes (BigInt)
    // Python: [ord(ch) for ch in s]
    const m_list = [];
    for (let i = 0; i < message.length; i++) {
        m_list.push(bigInt(message.charCodeAt(i)));
    }

    // Validasi: m < n
    // Python: too_big check
    for (let m of m_list) {
        if (m.greaterOrEquals(n)) {
            throw new Error(`Error: Karakter dengan kode ASCII ${m} terlalu besar untuk nilai n=${n}. Gunakan P dan Q yang lebih besar.`);
        }
    }

    // Enkripsi: c = m^e mod n
    // Python: pow(m, e, n) -> JS: m.modPow(e, n)
    const c_list = m_list.map(m => m.modPow(e, n).toString());

    // Mengembalikan Array of Strings (Ciphertext berupa angka-angka)
    return c_list;
};

export const decrypt = (cipherText, privateKey) => {
    if (!privateKey || !privateKey.d || !privateKey.n) {
        throw new Error("Private Key tidak valid.");
    }

    // Pastikan input berupa array. Jika UI mengirim string dipisah koma, kita split dulu.
    let c_list_input = cipherText;
    if (typeof cipherText === 'string') {
        // Asumsi format "123,456,789"
        c_list_input = cipherText.split(',').map(item => item.trim());
    }

    const d = bigInt(privateKey.d);
    const n = bigInt(privateKey.n);

    // Dekripsi: m = c^d mod n
    // Python: pow(c, d, n) -> JS: c.modPow(d, n)
    
    let decrypted_chars = [];
    
    try {
        const decrypted_bigints = c_list_input.map(cStr => {
            const c = bigInt(cStr);
            return c.modPow(d, n);
        });

        // Konversi kembali dari ASCII (BigInt) ke String
        // Python: chr(x) -> JS: String.fromCharCode(num)
        decrypted_chars = decrypted_bigints.map(m => String.fromCharCode(Number(m))); // Cast ke Number aman karena ASCII < 65536

    } catch (err) {
        console.error("Decryption error:", err);
        return "Gagal mendekripsi (Key salah atau data rusak).";
    }

    return decrypted_chars.join('');
};