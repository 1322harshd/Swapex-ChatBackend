// routes/conversation.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Conversation = require("./models");

// helper to normalize inputs (try Number, ObjectId, fallback to raw)
function normalizeVal(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return v._id ?? v.id ?? v;
  
  // Try to convert string numbers to actual numbers
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return Number(v);
  
  // Check if it's a valid MongoDB ObjectId
  if (typeof v === "string" && mongoose.Types.ObjectId.isValid(v)) return mongoose.Types.ObjectId(v);
  
  // Return as-is for any other type (including non-numeric strings)
  return v;
}

// Get or create conversation (atomic upsert)
router.post("/", async (req, res) => {
  try {
    console.log("🔵 POST / REQUEST RECEIVED");
    console.log("Raw body:", req.body);
    
    const { product: rawProduct, buyer: rawBuyer, seller: rawSeller } = req.body;
    const product = normalizeVal(rawProduct);
    const buyer = normalizeVal(rawBuyer);
    const seller = normalizeVal(rawSeller);

    console.log("Normalized values:", { product, buyer, seller });

    const query = {};
    if (product !== null) query.product = product;
    if (buyer !== null) query.buyer = buyer;
    if (seller !== null) query.seller = seller;

    console.log("MongoDB query:", query);

    // Check if conversation already exists before upsert
    const existing = await Conversation.findOne(query);
    console.log("Existing conversation found:", existing ? existing._id : "NONE");

    // atomic upsert -> returns existing or creates one without race-duplication
    const convo = await Conversation.findOneAndUpdate(
      query,
      { $setOnInsert: { product, buyer, seller, messages: [] } },
      { new: true, upsert: true }
    ).lean();

    console.log("🟢 POST / RESULT ->", { 
      product, buyer, seller, 
      id: convo?._id,
      wasNew: !existing,
      timestamp: new Date().toISOString()
    });
    return res.json(convo);
  } catch (err) {
    console.error("🔴 POST / error:", err.message);
    console.error("Error name:", err.name);
    console.error("Error stack:", err.stack);
    
    // Check for specific MongoDB errors
    if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
      console.error("MongoDB connection issue detected");
      return res.status(503).json({ error: "Database connection failed" });
    }
    
    if (err.name === 'ValidationError') {
      console.error("Validation error:", err.errors);
      return res.status(400).json({ error: "Invalid data", details: err.errors });
    }
    
    return res.status(500).json({ 
      error: "Server error", 
      message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

// Add message (atomic push)
router.post("/:id/message", async (req, res) => {
  try {
    const { id } = req.params;
    const { sender: rawSender, text } = req.body;
    const sender = normalizeVal(rawSender);

    const convo = await Conversation.findByIdAndUpdate(
      id,
      { $push: { messages: { sender, text } } },
      { new: true }
    );

    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    return res.json(convo);
  } catch (err) {
    console.error("POST message error:", err.message);
    console.error("Error name:", err.name);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    
    if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
      return res.status(503).json({ error: "Database connection failed" });
    }
    
    return res.status(500).json({ 
      error: "Server error", 
      message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

// List conversations (filter by seller, buyer or product via query params)
router.get("/", async (req, res) => {
  try {
    const { seller, buyer, product } = req.query;
    const query = {};
    if (seller) query.seller = parseInt(seller);
    if (buyer) query.buyer = parseInt(buyer);
    if (product) query.product = parseInt(product);

    // optional: populate product/buyer fields if you store refs and want more info
    const convos = await Conversation.find(query).lean();
    console.log("GET /", { query, count: convos.length });
    res.json(convos);
  } catch (err) {
    console.error("Failed to list conversations", err);
    res.status(500).json({ error: "Server error" });
  }
});

//load previous conversations
router.get("/:id", async (req, res) => {
  console.log("GET /:id", req.params.id);
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    res.json(convo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// API Routes for products
router.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    // For now, return a mock product or find conversations related to this product
    const conversations = await Conversation.find({ product: parseInt(id) });
    
    // Mock product data - you can replace this with actual product data from a Product model
    const product = {
      id: parseInt(id),
      name: `Product ${id}`,
      description: "Sample product description",
      conversations: conversations
    };
    
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get conversations for a specific product
router.get("/api/products/:id/conversations", async (req, res) => {
  const { id } = req.params;
  
  try {
    const conversations = await Conversation.find({ product: parseInt(id) });
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// example route
router.get('/', (req, res) => res.send('OK'));

// Health check endpoint for AWS ELB
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'swapex-chat-backend'
  });
});

// Database connection test endpoint
router.get('/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    const mongoose = require('mongoose');
    
    // Check if mongoose is connected
    const isConnected = mongoose.connection.readyState === 1;
    console.log('Mongoose connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name || 'default');
    
    if (isConnected) {
      // Try a simple database operation
      const testDoc = await Conversation.findOne().limit(1);
      console.log('Sample document found:', !!testDoc);
      
      res.status(200).json({ 
        status: 'database_connected',
        connected: true,
        database: mongoose.connection.name || 'default',
        documentsExist: !!testDoc,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        status: 'database_disconnected',
        connected: false,
        connectionState: mongoose.connection.readyState,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({ 
      status: 'database_error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test route that doesn't use MongoDB
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Test route working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// Test POST route that doesn't use MongoDB
router.post('/test', (req, res) => {
  res.json({ 
    message: 'POST test route working!', 
    body: req.body,
    timestamp: new Date().toISOString() 
  });
});

// export the router for CommonJS
module.exports = router;
