import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { generateKeys, encrypt, decrypt } from "./utils/rsa";
import "./App.css";

// koneksi ke server backend
const socket = io("http://localhost:3001", {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  // state buat nyimpen data aplikasi
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  
  // state buat chat dan kunci rsa
  const [messages, setMessages] = useState([]); // format: { sender, text, isMe }
  const [inputMsg, setInputMsg] = useState("");
  const [myKeys, setMyKeys] = useState(null);
  const [debugLog, setDebugLog] = useState("Waiting for activity..."); // log enkripsi/dekripsi
  const messagesEndRef = useRef(null);

  // auto scroll ke bawah kalo ada pesan baru
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // listener buat cek status koneksi
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ connected to server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ disconnected from server");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.log("connection error:", error);
      setIsConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  // fungsi login dan generate kunci rsa
  const handleLogin = async () => {
    if (!username.trim()) return alert("Isi username!");
    if (!isConnected) return alert("Belum terkoneksi ke server! Pastikan server berjalan di port 3001");
    
    setIsGeneratingKeys(true);
    setDebugLog("🔑 generating rsa keys... please wait...");
    
    try {
      // generate kunci rsa di browser
      const keys = await generateKeys();
      setMyKeys(keys);
      
      setDebugLog(`✅ keys generated!\n\npublic key (e): ${keys.publicKey.e}\npublic key (n): ${keys.publicKey.n.substring(0, 30)}...`);
      
      // kirim public key ke server
      socket.emit("register_user", { 
        username: username.trim(), 
        publicKey: keys.publicKey 
      });
      
      setIsLoggedIn(true);
    } catch (error) {
      console.error("key generation error:", error);
      alert("Error generating keys: " + error.message);
      setDebugLog("❌ key generation failed: " + error.message);
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // fungsi kirim pesan
  const sendMessage = () => {
    if (!inputMsg.trim() || !selectedUser) return;
    if (!myKeys) return alert("Keys belum ready!");

    const messageToSend = inputMsg.trim();

    // minta public key penerima dari server
    socket.emit("get_public_key", selectedUser, (targetPublicKey) => {
      if (!targetPublicKey) {
        alert("User offline atau tidak ditemukan!");
        return;
      }

      try {
        // enkripsi pesan pake public key penerima
        const cipherText = encrypt(messageToSend, targetPublicKey);

        // update log
        setDebugLog(`📤 [sending]\nto: ${selectedUser}\noriginal: "${messageToSend}"\ncipher (${cipherText.length} blocks): [${cipherText.slice(0, 2).join(", ")}...]`);

        // kirim ciphertext ke server
        socket.emit("send_message", {
          to: selectedUser,
          cipherText: cipherText
        });

        // tampilin pesan asli di ui sendiri
        setMessages((prev) => [...prev, { 
          sender: "Me", 
          text: messageToSend, 
          isMe: true,
          timestamp: new Date().toLocaleTimeString()
        }]);
        setInputMsg("");
      } catch (error) {
        console.error("encryption error:", error);
        alert("Error encrypting message: " + error.message);
      }
    });
  };

  // handle tombol enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // listener event socket
  useEffect(() => {
    // update daftar user online
    socket.on("update_user_list", (users) => {
      console.log("online users:", users);
      setOnlineUsers(users.filter(u => u !== username)); // jangan tampilin diri sendiri
    });

    // dekripsi pas nerima pesan
    socket.on("receive_message", (data) => {
      console.log("received message from:", data.from);
      
      if (myKeys && data.cipherText) {
        try {
          // dekripsi pake private key sendiri
          const originalText = decrypt(data.cipherText, myKeys.privateKey);
          
          setMessages((prev) => [...prev, { 
            sender: data.from, 
            text: originalText, 
            isMe: false,
            timestamp: new Date().toLocaleTimeString()
          }]);
          
          // update log
          setDebugLog(`📥 [received]\nfrom: ${data.from}\ncipher (${data.cipherText.length} blocks): [${data.cipherText.slice(0, 2).join(", ")}...]\ndecrypted: "${originalText}"`);
        } catch (error) {
          console.error("decryption error:", error);
          setMessages((prev) => [...prev, { 
            sender: data.from, 
            text: "[Decryption Error]", 
            isMe: false,
            timestamp: new Date().toLocaleTimeString()
          }]);
        }
      }
    });

    return () => {
      socket.off("update_user_list");
      socket.off("receive_message");
    };
  }, [myKeys, username]);

  // render halaman login
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>☕ HuTalks</h2>
          <p className="subtitle">End-to-End Encrypted Messaging with RSA Algorithm</p>
          
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? "✅ Connected to Server" : "❌ Disconnected - Start server first!"}
          </div>
          
          <div className="login-form">
            <input 
              placeholder="Enter your username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              disabled={isGeneratingKeys}
            />
            <button 
              onClick={handleLogin} 
              disabled={!isConnected || isGeneratingKeys}
            >
              {isGeneratingKeys ? "Generating..." : "🔑 Login"}
            </button>
          </div>
          
          <p className="login-note">
            *RSA key pair will be generated automatically when you login
          </p>
          
          <div className="how-to-run">
            <h4>📋 How to Run:</h4>
            <ol>
              <li>Open terminal in <code>server</code> folder</li>
              <li>Run: <code>npm start</code></li>
              <li>Open another terminal in <code>client</code> folder</li>
              <li>Run: <code>npm run dev</code></li>
              <li>Open 2 browser tabs to test chat</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // render halaman chat utama
  return (
    <div className="chat-container">
      {/* sidebar: daftar user */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>👤 {username}</h3>
          <div className="status">Online & Secure</div>
        </div>
        
        <div className="users-section">
          <h4>Online Users ({onlineUsers.length})</h4>
          {onlineUsers.length === 0 ? (
            <p className="no-users">
              No other users online.<br/>
              Open another browser tab to test!
            </p>
          ) : (
            onlineUsers.map((u) => (
              <div 
                key={u} 
                onClick={() => setSelectedUser(u)}
                className={`user-item ${selectedUser === u ? 'selected' : ''}`}
              >
                <div className="avatar">👤</div>
                <span className="username">{u}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* area chat utama */}
      <div className="chat-main">
        <div className="chat-header">
          <span className="icon">💬</span>
          <h3>{selectedUser ? `Chat with ${selectedUser}` : "Select a user to start chatting"}</h3>
        </div>
        
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}>🔒</div>
              <p>Messages are end-to-end encrypted with RSA</p>
              <p>Select a user and start chatting!</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.isMe ? 'sent' : 'received'}`}>
                <div className="message-bubble">
                  {!msg.isMe && <div className="message-sender">{msg.sender}</div>}
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.timestamp}</div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input 
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedUser ? "Type your secret message..." : "Select a user first..."}
            disabled={!selectedUser}
          />
          <button 
            onClick={sendMessage} 
            disabled={!selectedUser || !inputMsg.trim()}
          >
            Send 🔒
          </button>
        </div>
      </div>

      {/* panel debug buat liat proses enkripsi */}
      <div className="debug-panel">
        <div className="debug-header">
          <h3>☕ HuTalks</h3>
          <p>Real-time encryption/decryption log</p>
        </div>
        
        <div className="debug-content">
          <div className="debug-log">{debugLog}</div>
          
          <div className="debug-section">
            <h4>🔑 My Keys</h4>
            <div className="key-display">
              <span className="key-label">Public Key (e):</span>
              <span className="key-value">{myKeys?.publicKey.e}</span>
              
              <span className="key-label" style={{ marginTop: '15px' }}>Public Key (n):</span>
              <span className="key-value" style={{ fontSize: '0.65rem' }}>{myKeys?.publicKey.n}</span>
              
              <span className="key-label" style={{ marginTop: '15px' }}>Private Key (d):</span>
              <span className="key-hidden">[HIDDEN - Never leaves browser]</span>
              <p className="key-note">Private key is used locally for decryption only</p>
            </div>
          </div>
          
          <div className="debug-section">
            <h4>📚 HuTalks UserGuide</h4>
            <div className="how-rsa-works">
              <p><strong>1. Key Generation:</strong><br/>
              Generate p, q (primes), compute n=p×q, φ=(p-1)(q-1), choose e, compute d=e⁻¹ mod φ</p>
              
              <p><strong>2. Encryption:</strong><br/>
              C = M^e mod n</p>
              
              <p><strong>3. Decryption:</strong><br/>
              M = C^d mod n</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;