// routes/conversation.js
const express = require("express");
const router = express.Router();
const Conversation = require("./models");

// Get or create conversation
router.post("/conversation", async (req, res) => {
  const { product, buyer, seller } = req.body;

  try {
    // check if conversation exists
    let convo = await Conversation.findOne({ product, buyer, seller });
    console.log({product,buyer,seller});
    if (!convo) {
      // create new one
      convo = new Conversation({ product, buyer, seller, messages: [] });
      await convo.save();
    }

    res.json(convo); // return conversation (with messages if exists)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Add message
router.post("/conversation/:id/message", async (req, res) => {
  const { id } = req.params;
  const { sender, text } = req.body;

  // Debug: log what is received
  console.log("POST /conversation/:id/message");
  console.log("Conversation ID:", id);
  console.log("Sender:", sender);
  console.log("Text:", text);

  try {
    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    convo.messages.push({ sender, text });
    await convo.save();

    res.json(convo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//load previous conversations
router.get("/conversation/:id", async (req, res) => {
  console.log("GET /conversation/:id", req.params.id);
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    res.json(convo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// example route
router.get('/', (req, res) => res.send('OK'));

// export the router for CommonJS
module.exports = router;
