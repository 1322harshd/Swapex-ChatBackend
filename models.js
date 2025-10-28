const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema({
  sender: Number,     // buyer or seller ID
  text: String,       // message content
  createdAt: {
    type: Date,
    default: Date.now // auto timestamp
  }
});

const conversationSchema = new Schema({
  product: Number,      // product ID
  buyer: Number,        // buyer ID
  seller: Number,       // seller ID
  messages: [messageSchema] // array of messages
});

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;