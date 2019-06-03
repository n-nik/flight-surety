
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational()
            .then(result => {
                console.log( 'Operational Status', result);
            })
            .catch(err => {
                console.log( 'Operational Status', err);
            });


        // User-submitted transaction
        DOM.elid('submit-purchase').addEventListener('click', () => {
            let flightNumber = DOM.elid('flight-number').value;
            let ticketNumber = DOM.elid('flight-ticket').value;
            let value = Number(DOM.elid('flight-value').value);
            let airline;
            let flight = flightNumber + ' ' + ticketNumber;
            let timestamp;
            contract.registerFlight(flight, value)
                .then((result) => {
                    airline = result.airline;
                    timestamp = result.timestamp;
                    console.log(`Flight info: ${airline}, ${flight}, ${timestamp} `);
                    return contract.fetchFlightStatus(airline, flight, timestamp);
                })
                .then(() => {
                    display('Oracles', 'Trigger oracles', [
                        { label: 'Fetch Flight', error: null, value: flight + ' ' + timestamp},
                        { label: 'Status ', error: null, value: 'UNKNOWN', id: 'status-' + timestamp},
                        { label: 'Value ', error: null, value: value + ' ETH', },
                        { label: 'Insurance payout value ', error: null, value: 0 + ' ETH', id: 'insurance-payout-' + timestamp }
                    ]);
                })
                .catch(err => {
                    display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: err.message, value:  ''}]);
                })
        });

        // User-submitted transaction
        DOM.elid('submit-withdraw').addEventListener('click', () => {
            contract.withdrawPassengerFunds()
                .then(() => {
                    console.log('Funds were successfully withdraw');
                })
                .catch(err => {
                    console.log('Error on withdraw funds ', err.message);
                })
        });
    
    });
    

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        const errorClass = result.error ? ' error ' : '';
        const id = result.id || '';
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field',}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value' + errorClass, id}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    });
    displayDiv.append(section);
    let appContainer = document.getElementById("app-container");
    appContainer.scrollTop = appContainer.scrollHeight;

}







