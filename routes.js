/**
 * Conversation Routes
 * Handles API endpoints for conversation management including creation, messaging, and retrieval
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
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

/**
 * POST / - Get or create conversation using atomic upsert
 * Prevents duplicate conversations for the same product/buyer/seller combination
 */
router.post("/", async (req, res) => {
  try {
    const { product: rawProduct, buyer: rawBuyer, seller: rawSeller } = req.body;
    
    // Normalize input values for consistent database storage
    const product = normalizeVal(rawProduct);
    const buyer = normalizeVal(rawBuyer);
    const seller = normalizeVal(rawSeller);

    // Create bidirectional query to find existing conversation regardless of who initiated it
    const bidirectionalQuery = {
      product: product,
      $or: [
        { buyer: buyer, seller: seller },
        { buyer: seller, seller: buyer }
      ]
    };

    // First, try to find an existing conversation
    let convo = await Conversation.findOne(bidirectionalQuery).lean();
    
    if (!convo) {
      // If no conversation exists, create a new one with consistent buyer/seller order
      const createQuery = { product, buyer, seller };
      convo = await Conversation.findOneAndUpdate(
        createQuery,
        { $setOnInsert: { product, buyer, seller, messages: [] } },
        { new: true, upsert: true }
      ).lean();
    }

    return res.json(convo);
  } catch (err) {
    console.error("Error creating/finding conversation:", err.message);
    
    // Handle specific MongoDB connection errors
    if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
      return res.status(503).json({ error: "Database connection failed" });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: "Invalid data", details: err.errors });
    }
    
    return res.status(500).json({ 
      error: "Server error", 
      message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

/**
 * POST /:id/message - Add a new message to an existing conversation
 * Uses atomic push operation to ensure message consistency
 */
router.post("/:id/message", async (req, res) => {
  try {
    const { id } = req.params;
    const { sender: rawSender, text } = req.body;
    const sender = normalizeVal(rawSender);

    // Atomically add message to conversation
    const convo = await Conversation.findByIdAndUpdate(
      id,
      { $push: { messages: { sender, text } } },
      { new: true }
    );

    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    return res.json(convo);
  } catch (err) {
    console.error("Error adding message:", err.message);
    
    // Handle invalid conversation ID format
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    
    // Handle database connection issues
    if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
      return res.status(503).json({ error: "Database connection failed" });
    }
    
    return res.status(500).json({ 
      error: "Server error", 
      message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

/**
 * GET / - List conversations with optional filtering
 * Supports filtering by seller, buyer, or product via query parameters
 */
router.get("/", async (req, res) => {
  try {
    const { seller, buyer, product } = req.query;
    
    // Build filter query from query parameters
    const query = {};
    if (seller) query.seller = parseInt(seller);
    if (buyer) query.buyer = parseInt(buyer);
    if (product) query.product = parseInt(product);

    const convos = await Conversation.find(query).lean();
    res.json(convos);
  } catch (err) {
    console.error("Error listing conversations:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /:id - Load a specific conversation by ID
 * Returns conversation with all messages
 */
router.get("/:id", async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    res.json(convo);
  } catch (err) {
    console.error("Error loading conversation:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/products/:id - Get product information with related conversations
 * Returns mock product data - can be replaced with actual product service integration
 */
router.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    // Find conversations related to this product
    const conversations = await Conversation.find({ product: parseInt(id) });
    
    // Return mock product data with conversations
    const product = {
      id: parseInt(id),
      name: `Product ${id}`,
      description: "Sample product description",
      conversations: conversations
    };
    
    res.json(product);
  } catch (err) {
    console.error("Error loading product:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/products/:id/conversations - Get all conversations for a specific product
 */
router.get("/api/products/:id/conversations", async (req, res) => {
  const { id } = req.params;
  
  try {
    const conversations = await Conversation.find({ product: parseInt(id) });
    res.json(conversations);
  } catch (err) {
    console.error("Error loading product conversations:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Health check endpoint for load balancers and monitoring
 */
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'swapex-chat-backend'
  });
});

/**
 * Database connection test endpoint for debugging
 */
router.get('/test-db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Check mongoose connection status
    const isConnected = mongoose.connection.readyState === 1;
    
    if (isConnected) {
      // Test database operation
      const testDoc = await Conversation.findOne().limit(1);
      
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
    console.error('Database test error:', err.message);
    res.status(500).json({ 
      status: 'database_error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Simple test endpoints for API health verification
 */
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Test route working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

router.post('/test', (req, res) => {
  res.json({ 
    message: 'POST test route working!', 
    body: req.body,
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;
