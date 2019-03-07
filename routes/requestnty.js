var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser'); //parses information from POST
var mongoose = require('mongoose'); //mongo connection
var request = require("request");
var moment = require("moment");
var get_ip = require('ipware')().get_ip;
var kue = require("kue");
var queue = kue.createQueue();
//router.use(bodyParser.raw());
var Web3 = require("web3");
var endpoint = "http://rpc.testnet.nexty.io:8545";
var networkID = 111111;
//var endpoint = "https://ss.nexty.io";
//var networkID = 66666;
const web3 = new Web3(new Web3.providers.HttpProvider(endpoint));
var Tx = require('ethereumjs-tx');
router.post('/', function(req, res, next) {
    //Check if valid captcha
     request('https://www.google.com/recaptcha/api/siteverify?secret=' + process.env.GOOGLE_CAPTCHA_SECRET + '&response=' + req.body.captcha, function (error, response, body) {
        if (error) {
            res.json({error:"Unexpected error during captcha processing!"})
        }else{
            var jsonBody = JSON.parse(body);
            if (!jsonBody.success) {
                res.json({error:"Invalid captcha token!"})
            }else{
                //Check if address get faucet a day a go
                var timeNow = moment().unix()
                var dayago = timeNow - 24*60*60;
                var minuteago = timeNow - 60;
                var clientIP = get_ip(req).clientIp;
                mongoose.model('Faucet').find({"address": req.body.address, "time": {$gt: dayago}}, function(err, obj) {
                    if (obj.length>0) {
                        res.json({error:"You have requested for Faucet within recent 24 hours. Please come back later"});
                    }else{
                        mongoose.model('Faucet').find({"ip": clientIP, "time": {$gt: minuteago}}, function(err, obj) {
                            console.log(err)
                            if (obj.length>0) {
                                res.json({error:"Please dont try to get Faucet too much!"});
                            }else{
                                var job = queue.create('startFaucetSending', {address: req.body.address, clientIP, timeNow}).save();
                                queue.process( 'startFaucetSending', 1, faucetSending);
                                job.on('complete', function(result){
                                    console.log({success:"Faucet sent!",tx:result});
                                    res.json({success:"Faucet sent!",tx:result});
                                  }).on('failed attempt', function(errorMessage, doneAttempts){
                                    res.json({error:"Problem with sending Faucet. Pls notify admin!"});
                                  }).on('failed', function(errorMessage){
                                  });
                            }
                        })
                    }
                })
            }
        }
    });
})

var faucetSending = function(job,done) { 
    web3.eth.getTransactionCount(web3.eth.accounts.privateKeyToAccount("0x"+process.env.PRIVATE_KEY).address).then(function(nonce){
        //Process sending faucet
        const rawTransaction = {
            "to": job.data.address,
            "nonce": nonce,
            "value": web3.utils.toHex(web3.utils.toWei("50000", "ether")),
            "chainId": networkID,
            "gasLimit": 21000, // 21,000 in decimal
        };
        var privateKey = new Buffer.from(process.env.PRIVATE_KEY, 'hex')
        var tx = new Tx(rawTransaction);
        tx.sign(privateKey);
        var serializedTx = tx.serialize();
        web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        .on('error', function(error){
            console.log(error);
        })
        .catch(function (err) {
            console.log(err)
            done(err);
        })
        .then(function(receipt) {
            //res.json({success:"Faucet sent!",tx:hash});
            //console.log("Transaction hash2: ", hash);
            mongoose.model('Faucet').create({"address":job.data.address,"ip":job.data.clientIP, "tx": receipt.transactionHash, "time": job.data.timeNow}, function (err, emails) {
                if (err) {
                    console.log(err)
                }
            })
            done(null, receipt.transactionHash);
        });
    })
    .catch(function (err) {
        console.log(err)
        done(err);
    })
}


module.exports = router;