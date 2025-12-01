import { useEffect, useState } from "react";
import io from "socket.io-client";
import { encrypt, decrypt, generateKeys } from "./utils/rsa"; // Import RSA buatan Anggota 1

const socket = io.connect("http://localhost:3001"); // Konek ke Server

function App() {
  const [message, setMessage] = useState("");
  const [messageReceived, setMessageReceived] = useState("");

  const sendMessage = () => {
    // Pura-puranya kita punya public key lawan
    const cipherText = encrypt(message, "dummy_public_key"); 
    socket.emit("send_message", { message: cipherText });
  };

  useEffect(() => {
    socket.on("receive_message", (data) => {
      // Saat terima pesan, dekripsi
      const originalText = decrypt(data.message, "dummy_private_key");
      setMessageReceived(originalText);
    });
  }, [socket]);

  return (
    <div className="App" style={{ padding: 20 }}>
      <h1>RSA Chat Test</h1>
      <input 
        placeholder="Ketik pesan..." 
        onChange={(event) => setMessage(event.target.value)} 
      />
      <button onClick={sendMessage}>Kirim Pesan</button>

      <h3>Pesan Diterima:</h3>
      <p>{messageReceived}</p>
    </div>
  );
}

export default App;