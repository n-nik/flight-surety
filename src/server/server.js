require('babel-polyfill');
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));

const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
const flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);

const ORACLES_NUMBER = 20;
const START_ORACLES_ADDRESS_INDEX = 29;
const END_ORACLES_ADDRESS_INDEX = START_ORACLES_ADDRESS_INDEX + ORACLES_NUMBER;
const oracles = [];

(async() => {
    let accounts = await web3.eth.getAccounts();
    if (accounts.length <= END_ORACLES_ADDRESS_INDEX) {
        throw new Error('Min accounts number must be 50; Run ganache-cli with `-a 50` flag');
    }
    try {
        await flightSuretyData.methods.authorizeCaller(config.appAddress).send({from: accounts[0]});
    } catch(e) {
        console.log(e)
    }

    let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call()
    console.log('Start register Oracles');

    accounts.slice(START_ORACLES_ADDRESS_INDEX, END_ORACLES_ADDRESS_INDEX).forEach( async(oracleAddress) => {
        try {
            await flightSuretyApp.methods.registerOracle().send({from: oracleAddress, value: fee, gas: 3000000});
            let indexesResult = await flightSuretyApp.methods.getMyIndexes().call({from: oracleAddress});
            oracles.push({
                address: oracleAddress,
                indexes: indexesResult
            });
            // console.log(oracles)
        } catch(e) {
            console.log(e)
        }
    });
    console.log('Finish register Oracles');



})();


flightSuretyApp.events.OracleRequest({
    fromBlock: 0
}, function (error, event) {
    if (error){
        console.log(error);
        return;
    }

    let randomStatusCode = Math.floor(Math.random() * 5) * 10;
    let eventValue = event.returnValues;
    console.log('Event ', eventValue);

    oracles.forEach((oracle) => {
        oracle.indexes.forEach((index) => {
            if (index !== eventValue.index) {
                return;
            }
            flightSuretyApp.methods.submitOracleResponse(
                index,
                eventValue.airline,
                eventValue.flight,
                eventValue.timestamp,
                randomStatusCode
            )
                .send({from: oracle.address , gas:5555555})
                .then(() => {
                    console.log(`RESULT: ${oracle.address}  INDEX:  ${index}  STATUS CODE: ${randomStatusCode}`);
                })
                .catch(err => {
                    console.log(`Oracle '${index} was rejected by reason: "${err.message}"'`);
                });
        });
    });
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
});

export default app;


