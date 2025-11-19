const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema({
  sender: Schema.Types.Mixed,
  text: String,             
  createdAt: {
    type: Date,
    default: Date.now          
  }
});

const conversationSchema = new Schema({
  product: { type: Schema.Types.Mixed },  
  buyer: { type: Schema.Types.Mixed },    
  seller: { type: Schema.Types.Mixed },   
  messages: [messageSchema] 
});

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;