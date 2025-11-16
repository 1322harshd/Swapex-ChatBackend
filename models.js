const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema({
  sender: Schema.Types.Mixed,  // flexible type for sender ID
  text: String,                // message content
  createdAt: {
    type: Date,
    default: Date.now          // auto timestamp
  }
});

const conversationSchema = new Schema({
  product: { type: Schema.Types.Mixed },  // flexible type for product ID
  buyer: { type: Schema.Types.Mixed },    // flexible type for buyer ID  
  seller: { type: Schema.Types.Mixed },   // flexible type for seller ID
  messages: [messageSchema] // array of messages
});

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;