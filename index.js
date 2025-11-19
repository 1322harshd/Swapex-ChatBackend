const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const conversationRoutes = require("./routes");
const Conversation = require("./models");

const app = express();

// MongoDB URI check
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// 1. CORS first
app.use(cors({
  origin: [
    "https://swapex-verceldeployment.vercel.app",
    "http://localhost:5174"
  ],
  credentials: true
}));

app.use(express.json());

// 2. Routes before socket
app.use("/conversation", conversationRoutes);

// 3. Create HTTP server
const server = http.createServer(app);

// 4. Attach socket.io
const io = new Server(server, {
  cors: {
    origin: [
      "https://swapex-verceldeployment.vercel.app",
      "http://localhost:5174"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// MongoDB connection
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

// 5. Socket logic
io.on("connection", (socket) => {
  console.log("Client connected", socket.id);

  // Join a conversation room
  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined room ${conversationId}`);
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message } = data;
      console.log("Received message for room:", conversationId, message);

      // Save message to MongoDB
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        const newMessage = {
          sender: message.sender,
          text: message.text,
          timestamp: message.timestamp || new Date()
        };
        
        conversation.messages.push(newMessage);
        await conversation.save();
        console.log("Message saved to database");
        
        // Broadcast the message to all users in the room
        io.to(conversationId).emit('receive_message', newMessage);
        console.log(`Message broadcasted to room ${conversationId}`);
      } else {
        console.error(`Conversation ${conversationId} not found`);
        socket.emit('message_error', { error: 'Conversation not found' });
      }
    } catch (error) {
      console.error('Error handling send_message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Keep your existing listeners (backward compatibility)
  socket.on("sendMessage", (data) => {
    console.log("Received (legacy):", data);
    // Broadcast to all clients including sender
    io.emit("newMessage", data);
  });

  //listen to disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// 6. Listen on EB port
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
