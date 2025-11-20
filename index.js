/**
 * Swapex Chat Backend Server
 * Real-time messaging application with Socket.IO and MongoDB
 */

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const conversationRoutes = require("./routes");
const Conversation = require("./models");

/**
 * Helper function to normalize input values for database queries
 * Converts string numbers to integers and validates MongoDB ObjectIds
 */
function normalizeVal(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return v._id ?? v.id ?? v;
  
  // Convert string numbers to actual numbers
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return Number(v);
  
  // Validate and convert MongoDB ObjectIds
  if (typeof v === "string" && mongoose.Types.ObjectId.isValid(v)) return mongoose.Types.ObjectId(v);
  
  return v;
}

const app = express();

// Validate required environment variables
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// Configure CORS for frontend applications
app.use(cors({
  origin: [
    "https://swapex.art", // Production frontend
    "http://localhost:5174" // Development frontend
  ],
  credentials: true
}));

// Enable JSON request body parsing
app.use(express.json());

// Mount conversation API routes
app.use("/conversation", conversationRoutes);

// Create HTTP server instance
const server = http.createServer(app);

// Initialize Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: [
      "https://swapex.art", // Production frontend
      "http://localhost:5174" // Development frontend
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to MongoDB with optimized connection settings
mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 10000, // 10 second timeout for server selection
    socketTimeoutMS: 45000, // 45 second timeout for socket operations
    maxPoolSize: 10, // Maximum 10 connections in the pool
    heartbeatFrequencyMS: 10000, // Send heartbeat every 10 seconds
})
.then(() => {
    console.log('MongoDB connected successfully');
})
.catch(err => {
    console.error('MongoDB connection failed:', err.message);
    
    // Exit process on connection failure in production environments
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Monitor MongoDB connection health
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// Handle real-time WebSocket connections
io.on("connection", (socket) => {
  
  // Handle user joining a specific conversation room
  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
  });

  // Handle new message submissions
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message } = data;
      
      // Normalize sender to ensure consistent data type
      const normalizedMessage = {
        sender: normalizeVal(message.sender),
        text: message.text,
        createdAt: new Date()
      };
      
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { $push: { messages: normalizedMessage } },
        { new: true }
      );
      
      if (conversation) {
        // Broadcast only the new message to room participants
        io.to(conversationId).emit('receive_message', normalizedMessage);
      } else {
        socket.emit('message_error', { error: 'Conversation not found' });
      }
    } catch (error) {
      console.error('Error handling send_message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Legacy message handler for backward compatibility
  socket.on("sendMessage", (data) => {
    // Broadcast to all connected clients
    io.emit("newMessage", data);
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    // Client disconnected - no action needed as Socket.IO handles cleanup
  });
});

// Start the server on the specified port
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
