pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    uint public MAX_AUTO_REGISTERED_AIRLINES = 4;

    uint public INSURANCE_STATUS_UNKNOWN = 0;
    uint public INSURANCE_STATUS_IN_PROGRESS = 1;
    uint public INSURANCE_STATUS_PAID = 1;
    uint public INSURANCE_STATUS_CLOSED = 2;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping (address=>bool) private authorizedCallers;

    struct Airline {
        bool isExists;
        uint256 registeredNumber;
        bool needApprove;
        bool isFunded;
        Votes votes;
        uint256 minVotes;
    }
    struct Votes{
        uint votersCount;
        mapping(address => bool) voters;
    }

    uint256 private airlinesCount = 0;
    mapping(address => Airline) private airlines;

    struct InsuranceInfo{
        address passenger;
        uint256 value;
        uint status;
    }
    mapping(bytes32 => InsuranceInfo) private insurances;
    mapping(address => uint256) private passengerBalances;
    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() public {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational == true, "Contract is currently not operational");
        _;
        // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }
    modifier requireAuthorizedCaller(address contractAddress) {
         require(authorizedCallers[contractAddress] == true, "Not Authorized Caller");
        _;
    }

    modifier checkAirlineExists(address airlineAddress) {
        require(airlines[airlineAddress].isExists, "Airline does't exist");
        _;
    }

    modifier checkAirlineApproved(address airlineAddress) {
        Airline airline = airlines[airlineAddress];
        require((airline.needApprove == false) || (airline.votes.votersCount >= airline.minVotes), "Need approval from other Airlines");
        _;
    }

    modifier checkAirlineFunds(address airlineAddress) {
        Airline memory airline = airlines[airlineAddress];
        require(airline.isFunded != true, "Need funds");
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address contractAddress) external requireContractOwner requireIsOperational {
        authorizedCallers[contractAddress] = true;
    }
    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address airlineAddress) external requireIsOperational{
        airlines[airlineAddress] = Airline({
            isExists: true,
            registeredNumber: airlinesCount,
            needApprove: airlinesCount >= MAX_AUTO_REGISTERED_AIRLINES,
            votes: Votes(0),
            isFunded: false,
            minVotes: airlinesCount.add(1).div(2)
        });

        airlinesCount = airlinesCount.add(1);
    }

    /**
     * @dev Add vote to airline, return needApprove flag
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function voteAirline(address airlineAddress, address voterAddress) external checkAirlineExists(airlineAddress) requireIsOperational returns (bool){
        require(airlines[airlineAddress].votes.voters[voterAddress] == false, "Airline already voted by this account");

        airlines[airlineAddress].votes.votersCount = airlines[airlineAddress].votes.votersCount.add(1);
        airlines[airlineAddress].votes.voters[voterAddress] = true;

        airlines[airlineAddress].needApprove = airlines[airlineAddress].votes.votersCount < airlines[airlineAddress].minVotes;
        return airlines[airlineAddress].needApprove;
    }


    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(address passenger, bytes32 flightKey) external requireIsOperational payable {
        insurances[flightKey] = InsuranceInfo({
            passenger: passenger,
            value: msg.value,
            status: INSURANCE_STATUS_IN_PROGRESS
        });
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(bytes32 flightKey) external requireIsOperational {
        InsuranceInfo insurance = insurances[flightKey];
        if (insurance.status == INSURANCE_STATUS_IN_PROGRESS) {
            uint256 insurancePayoutValue = getInsurancePayoutValue(flightKey);
            uint256 balance = passengerBalances[insurance.passenger];
            passengerBalances[insurance.passenger] = balance.add(insurancePayoutValue);
            insurance.status = INSURANCE_STATUS_PAID;
        }
    }

    /**
     *  @dev Set insurance closed status
    */
    function closeInsurance(bytes32 flightKey) external requireIsOperational{
        InsuranceInfo insurance = insurances[flightKey];
        if (insurance.status != INSURANCE_STATUS_UNKNOWN) {
            insurance.status = INSURANCE_STATUS_CLOSED;
        }
    }


    function getInsurancePayoutValue(bytes32 flightKey) view public requireIsOperational returns(uint256){
        InsuranceInfo insurance = insurances[flightKey];
        uint256 insurancePayoutValue = insurance.value.div(2);
        return insurancePayoutValue.add(insurance.value);
    }

    function getPassengerBalance(address passengerAddress) view public requireIsOperational returns(uint256){
        return passengerBalances[passengerAddress];
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passengerAddress) external requireIsOperational {
        uint256 balance = passengerBalances[passengerAddress];
        require(address(this).balance > balance, 'Not enough contact balance');
        passengerBalances[passengerAddress] = 0;
        passengerAddress.transfer(balance);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund(address airlineAddress) payable external requireIsOperational() checkAirlineExists(airlineAddress) checkAirlineApproved(airlineAddress){
        airlines[airlineAddress].isFunded = true;
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function isAirline(address airlineAddress) public view requireIsOperational() returns (bool) {
        return airlines[airlineAddress].isExists;
    }

    function getAirline(address airlineAddress) public view requireIsOperational() returns (bool isExists, uint256 registeredNumber, bool needApprove, bool isFunded, uint256 votersCount, uint minVotes) {
        Airline memory airline = airlines[airlineAddress];
        return (
            airline.isExists,
            airline.registeredNumber,
            airline.needApprove,
            airline.isFunded,
            airline.votes.votersCount,
            airline.minVotes
        );
    }
    function getAirlinesCount() public view returns (uint256) {
        return airlinesCount;
    }


}

