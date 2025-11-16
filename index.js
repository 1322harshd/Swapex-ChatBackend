// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Conversation = require("./models");
// const routes = require('./routes');// <-- remove this unused require
const app = express();
app.use(cors({ 
  origin: ["http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5174", "http://127.0.0.1:5175"], 
  methods: ["GET","POST"],
  credentials: true 
}));
//created http server for socket.io
const server = http.createServer(app);
//instantiating the server for socket.io with cors
const io = new Server(server, {
  cors: { 
    origin: ["http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5174", "http://127.0.0.1:5175"], 
    methods: ["GET","POST"],
    credentials: true 
  }
});
app.use(express.json());

// require once and verify it's a router/middleware
const routes = require("./routes.js");
console.log('routes type:', typeof routes, 'isRouter:', routes && typeof routes.use === 'function'); // debug
app.use("/", routes);

const dbURI = 'mongodb+srv://harshdeep2k193840_db_user:mhU1sC9dH0zak80m@chatapp.qgehhs3.mongodb.net/?retryWrites=true&w=majority&appName=ChatAPP'; // Replace with your connection string

    mongoose.connect(dbURI)
    .then(() => console.log('MongoDB connected...')) // Or use .then/.catch for promises
    .catch(err => console.error(err));

//listener for new client connections
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Listen to messages from clients
  socket.on("sendMessage", (data) => {
    console.log("Received:", data);

    // Broadcast to all clients including sender
    io.emit("newMessage", data);
  });
//listen to disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3000, () => console.log("Socket.IO server running on port 3000"));
