var mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1/faucet?authSource=admin', { useNewUrlParser: true, user: 'faucet', pass: 'faucet@1234'}, function(error) {
    console.log(error);
});