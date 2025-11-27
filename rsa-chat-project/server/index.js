const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // URL React (Vite) biasanya di port ini
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on("send_message", (data) => {
        // Server menerima pesan (Ciphertext) dan mengirim ke semua orang (Broadcast)
        // Dalam praktiknya nanti kirim ke target spesifik, ini untuk tes awal saja
        socket.broadcast.emit("receive_message", data);
    });
});

server.listen(3001, () => {
    console.log("SERVER RUNNING ON PORT 3001");
});