// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Conversation = require("./models");
// const routes = require('./routes');// <-- remove this unused require
const app = express();
const PORT = process.env.PORT || 3000;
const dbURI = process.env.MONGODB_URI;

if (!dbURI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// Allow more origins for production
const allowedOrigins = [
  "http://localhost:5174", 
  "http://localhost:5175", 
  "http://127.0.0.1:5174", 
  "http://127.0.0.1:5175",
  // Vercel deployment URLs
  "https://swapex-verceldeployment.vercel.app",
  "https://swapex-verceldepl-git-71c775-harshdeep-singhs-projects-bd6643fa.vercel.app",
  "https://swapex-verceldeployment-1nxouthl8.vercel.app"
];

// Add production origins if available
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({ 
  origin: allowedOrigins, 
  methods: ["GET","POST"],
  credentials: true 
}));
app.use(express.json());

// Serve static files (replaces EB static files configuration)
app.use(express.static("public"));

// require once and verify it's a router/middleware
const routes = require("./routes.js");
console.log('routes type:', typeof routes, 'isRouter:', routes && typeof routes.use === 'function'); // debug

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: {
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: PORT,
      hasMongoUri: !!process.env.MONGODB_URI
    }
  };
  
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    healthCheck.status = 'ERROR';
    healthCheck.mongodb.error = 'Not connected to MongoDB';
    return res.status(503).json(healthCheck);
  }
  
  res.json(healthCheck);
});

app.use("/", routes);

//created http server for socket.io
const server = http.createServer(app);
//instantiating the server for socket.io with cors
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for EB deployment - restrict to frontend domain later
    methods: ["GET", "POST"],
    credentials: true 
  }
});

// Enhanced MongoDB connection with better error handling
mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 10000, 
    socketTimeoutMS: 45000, 
    maxPoolSize: 10, 
    heartbeatFrequencyMS: 10000,
})
.then(() => {
    console.log('MongoDB connected successfully');
    console.log('Database URI (masked):', dbURI.replace(/\/\/[^@]+@/, '//***:***@'));
    console.log('Connected to database:', mongoose.connection.name || 'default');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
})
.catch(err => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Error code:', err.code);
    console.error('Error name:', err.name);
    console.error('Database URI (masked):', dbURI.replace(/\/\/[^@]+@/, '//***:***@'));
    console.error('Full error:', err);
    
    // Exit process on connection failure for hosted environments
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

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

server.listen(PORT, () => console.log(`Socket.IO server running on port ${PORT}`));
