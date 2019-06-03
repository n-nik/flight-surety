import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import UIHelpers from './uiHelpers';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.passengerBalance = 0;
    }


    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }
            console.log('Airlines ', this.airlines);
            console.log('passengers ', this.passengers);
            this.getPassengerBalance()
                .then((balance) => {
                    this.passengerBalance = this._convertToEther(balance)
                    callback()
                });
        });

        this.flightSuretyApp.events.UpdatedPassengerBalance({
            fromBlock: 0
        }, (error, event) => {
            this.passengerBalance = this._convertToEther(event.returnValues.balance);
            UIHelpers.updatePassengerBalance(this.passengerBalance);
        });

        this.flightSuretyApp.events.FlightStatusInfo({
            fromBlock: 0
        }, (error, event) => {
            // console.log(event.returnValues);
            UIHelpers.updateStatus(event.returnValues);
        });

        this.flightSuretyApp.events.InsurancePayout({
            fromBlock: 0
        }, (error, event) => {
            const data = event.returnValues;
            data.passengerBalance = this._convertToEther(data.passengerBalance);
            data.insurancePayoutValue = this._convertToEther(data.insurancePayoutValue);
            this.passengerBalance = data.passengerBalance;

            UIHelpers.updateInsurancePayout(data);
            UIHelpers.updatePassengerBalance(this.passengerBalance);
        });
    }

    isOperational() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.flightSuretyApp.methods
                .isOperational()
                .call({ from: self.owner}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(result);
                });
        })
    }

    fetchFlightStatus(airline, flight, timestamp) {
        let self = this;
        return new Promise((resolve, reject) => {
            self.flightSuretyApp.methods
                .fetchFlightStatus(airline, flight, timestamp)
                .send({ from: self.owner}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve();
                });
        })

    }

    registerFlight(flight, value) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight,
            value,
            timestamp: Math.floor(Date.now() / 1000)
        };
        return new Promise((resolve, reject) => {
            self.flightSuretyApp.methods
                .registerFlight(payload.airline, payload.flight, payload.timestamp)
                .send({ from: self.owner, value: web3.toWei(value, "ether"), gas:3000000}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(payload);

                });
        });
    }

    getPassengerBalance() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.flightSuretyApp.methods
                .getPassengerBalance(self.owner)
                .call({ from: self.owner}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(result);
                });
        });
    }

    withdrawPassengerFunds() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.flightSuretyApp.methods
                .withdrawPassengerFunds()
                .send({ from: self.owner, gas:3000000}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve();
                });
        });
    }

    _convertToEther(value) {
        return this.web3.utils.fromWei(this.web3.utils.toBN(value), 'ether')
    }

}
