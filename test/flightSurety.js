var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, {from: config.testAddresses[2]});
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        } catch (e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('(airline) register an Airline when contract is deployed', async () => {
        let result = await config.flightSuretyData.isAirline.call(config.firstAirline);
        assert.equal(result, true, "First Airline was not created");
    });

    it('(airline) can not register second an Airline from NON airline address', async () => {
        let newAirline = accounts[3];

        try {
            await config.flightSuretyApp.registerAirline(newAirline, {from: accounts[4]});
        } catch (e) {
        }
        let result = await config.flightSuretyData.isAirline.call(newAirline);

        assert.equal(result, false, "Can create second airline from non airline address");

    });
    it('(airline) can register second an Airline from airline address', async () => {
        let newAirline = accounts[4];

        try {
            await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
        } catch (e) {
        }
        let result = await config.flightSuretyData.isAirline.call(newAirline);
        assert.equal(result, true, "Can not create second airline from airline address");

    });
    it('(airline) can register 5th an Airline with needApprove == true', async () => {
        try {
            await config.flightSuretyApp.registerAirline(accounts[5], {from: config.firstAirline});
            await config.flightSuretyApp.registerAirline(accounts[6], {from: config.firstAirline});
            await config.flightSuretyApp.registerAirline(accounts[7], {from: config.firstAirline}); /* 5th airline */
        } catch (e) {
        }
        let result = await config.flightSuretyData.getAirline.call(accounts[7]);

        assert.equal(result.needApprove, true, "Can create airlines without multi approval");
    });
    //
    // it('(airline) vote airlines', async () => {
    //     try {
    //         await config.flightSuretyApp.voteAirline(accounts[7], {from: config.firstAirline});
    //         await config.flightSuretyApp.voteAirline(accounts[7], {from: accounts[4]});
    //     } catch (e) {
    //         console.log(e);
    //     }
    //     let result = await config.flightSuretyData.getAirline.call(accounts[7]);
    //
    //     assert.equal(result.needApprove, false, "Vote not work correctly");
    // });

    // it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    //
    //     // ARRANGE
    //     let newAirline = accounts[2];
    //
    //     // ACT
    //     try {
    //         await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    //     } catch (e) {
    //
    //     }
    //     let result = await config.flightSuretyData.isAirline.call(newAirline);
    //
    //     // ASSERT
    //     assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    //
    // });


});
