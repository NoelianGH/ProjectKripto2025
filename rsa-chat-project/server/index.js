const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// endpoint buat cek server jalan
app.get('/', (req, res) => {
    res.json({ 
        status: 'RSA Chat Server Running',
        users: Object.keys(users).length,
        timestamp: new Date().toISOString()
    });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// database di memori (ilang kalo server restart)
let users = {}; 

io.on("connection", (socket) => {
    console.log(`✅ user connected: ${socket.id}`);

    // fitur register
    socket.on("register_user", (data) => {
        if (!data || !data.username || !data.publicKey) {
            console.log("❌ invalid registration data");
            return;
        }
        
        // simpen username & public key
        users[data.username] = {
            socketId: socket.id,
            publicKey: data.publicKey // server simpen ini buat dikasih ke user lain
        };
        
        // update list user ke semua orang
        io.emit("update_user_list", Object.keys(users));
        console.log(`📝 user registered: ${data.username}`);
        console.log(`👥 total online users: ${Object.keys(users).length}`);
    });

    // fitur minta public key user lain
    socket.on("get_public_key", (targetUsername, callback) => {
        console.log(`🔑 key request for: ${targetUsername}`);
        
        if (typeof callback !== 'function') {
            console.log("❌ invalid callback");
            return;
        }
        
        if (users[targetUsername]) {
            // kasih public key target ke yang minta
            callback(users[targetUsername].publicKey);
            console.log(`✅ public key sent for: ${targetUsername}`);
        } else {
            callback(null);
            console.log(`❌ user not found: ${targetUsername}`);
        }
    });

    // fitur relay pesan (server cuma terusin, ga bisa baca isinya)
    socket.on("send_message", (data) => {
        if (!data || !data.to || !data.cipherText) {
            console.log("❌ invalid message data");
            return;
        }
        
        const target = users[data.to];
        const senderUsername = getKeyByValue(users, socket.id);
        
        if (target) {
            // log buat buktiin server cuma liat ciphertext
            console.log(`📨 [relay] from: ${senderUsername} → to: ${data.to}`);
            console.log(`🔒 encrypted (${data.cipherText.length} blocks): [${data.cipherText.slice(0, 2).join(", ")}...]`);

            io.to(target.socketId).emit("receive_message", {
                from: senderUsername,
                cipherText: data.cipherText // data masih terenkripsi
            });
            
            console.log(`✅ message relayed successfully`);
        } else {
            console.log(`❌ target user offline: ${data.to}`);
        }
    });

    socket.on("disconnect", () => {
        const username = getKeyByValue(users, socket.id);
        if (username) {
            delete users[username];
            io.emit("update_user_list", Object.keys(users));
            console.log(`👋 user disconnected: ${username}`);
            console.log(`👥 remaining users: ${Object.keys(users).length}`);
        }
    });
});

// helper buat cari username dari socket id
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key].socketId === value);
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log("═══════════════════════════════════════");
    console.log("🔐 rsa secure chat server");
    console.log(`🚀 running on http://localhost:${PORT}`);
    console.log("═══════════════════════════════════════");
    console.log("waiting for connections...\n");
});