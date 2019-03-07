var mongoose = require('mongoose');  
var faucetSchema = new mongoose.Schema({  
  address: String,
  ip: String,
  tx: String,
  time: Number
});
mongoose.model('Faucet', faucetSchema);