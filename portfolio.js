#!/usr/bin/env node
import chalk from 'chalk';
import fs from 'fs';
import JSONStream from "JSONStream";
import _, { map } from 'underscore';
import moment from "moment";
import axios from "axios";

const args = process.argv;

// usage represents the help guide
const usage = function() {
    const usageText = `
    portfolio helps you manage you portfolio functions.
  
    usage:
      ./portfolio.js <command>
  
      commands can be:
  
      help:                                                                         Get the commands list
      getProtfolioValueForAllToken:                                                 Get protfolio value for all token
      getProtfolioValueForSpecificToken <token>:                                    Get protfolio value for spectific token
      getProtfolioValueForAllTokenForGivenDate <date>(YYYY-MM-DD):                  Get protfolio value for all token within given date
      getProtfolioValueForSpecificTokenForGivenDate <token> <date>(YYYY-MM-DD):     Get protfolio value for specific token within given date.
    `
  
    console.log(usageText);
}

// used to log errors to the console in red color
const errorLog = (error) => {
    const eLog = chalk.red(error);
    console.log(eLog);
}

// we make sure the length of the arguments is exactly three
if (args.length > 5) {
    errorLog(`three argument can be accepted`)
    usage();
}

//read json file using csv file
const readJsonFile = (functionType, token = null, date = null, dateTimeStampStart, dateTimeStampEnd ) => {
    let i = 0;
    let allTokenObject = {};
    let portfolioObject = {portfolioValue: 0};

    if (!fs.existsSync('./transactions.json')) {
        errorLog(`transactions.json file not exists.`);
        usage();
        return true;
    } 

    const stream = fs.createReadStream('./transactions.json', {flags: 'r', encoding: 'utf-8'});

    stream.pipe(JSONStream.parse('*'))
    .on('data', (data) => {
        switch (functionType) {
            case 'getProtfolioValueForAllToken':
                if (allTokenObject[data.token]) {
                    const {portfolioValue} = {...allTokenObject[data.token]};
                    //call to addition and substraction function
                    let value = additionAndSubstraction(data.transaction_type, portfolioValue, data.amount);
                    allTokenObject[data.token] = {portfolioValue: value};
                } else {
                    //call to addition and substraction function
                    let value = additionAndSubstraction(data.transaction_type, 0, data.amount);
                    allTokenObject[data.token] = {portfolioValue: value};
                }
                break;
            case 'getProtfolioValueForSpecificToken':
                if (token === data.token) {
                    const {portfolioValue} = {...portfolioObject};
                    //call to addition and substraction function
                    portfolioObject.portfolioValue = additionAndSubstraction(data.transaction_type, portfolioValue, data.amount);
                }
                break;
            case 'getProtfolioValueForAllTokenForGivenDate':
                if (dateTimeStampStart <= data.timestamp && data.timestamp <= dateTimeStampEnd  ) {
                    if (allTokenObject[data.token]) {
                        const {portfolioValue} = {...allTokenObject[data.token]};
                        //call to addition and substraction function
                        let value = additionAndSubstraction(data.transaction_type, portfolioValue, data.amount);
                        allTokenObject[data.token] = {portfolioValue: value};
                    } else {
                        //call to addition and substraction function
                        let value = additionAndSubstraction(data.transaction_type, 0, data.amount);
                        allTokenObject[data.token] = {portfolioValue: value};
                    }
                }
                break;
            case 'getProtfolioValueForSpecificTokenForGivenDate':
                if (token === data.token && dateTimeStampStart <= data.timestamp && data.timestamp <= dateTimeStampEnd) {
                    const {portfolioValue} = {...portfolioObject};
                    //call to addition and substraction function
                    portfolioObject.portfolioValue = additionAndSubstraction(data.transaction_type, portfolioValue, data.amount);
                } 
        }
        
        console.log('item count read', i)
        i++;
    }).on("end", async() => {
        switch (functionType) {
            case 'getProtfolioValueForAllToken':
                await Promise.all(
                    Object.keys(allTokenObject).map(async(key) => {
                        const result = await usdValueForSpecificToken(key);

                        if (!result.error) {
                            const USDValue = result.data;
                            return {
                                [key]: {
                                    portfolioValue : '$' + (allTokenObject[key].portfolioValue * USDValue)
                                }
                            }
                        }
                    
                    })
                ).then((usdAllTokenValue) => {
                    console.log('get Protfolio value for all token', usdAllTokenValue);
                });
                break;
            case 'getProtfolioValueForSpecificToken':
                const result = await usdValueForSpecificToken(token);

                if (!result.error) {
                    const USDValue = result.data;
                    const newUsdValue = portfolioObject.portfolioValue * USDValue;
                    console.log(`get Protfolio value for ${token} is $`, newUsdValue);
                }
                
                break;
            case 'getProtfolioValueForAllTokenForGivenDate':
                await Promise.all(
                    Object.keys(allTokenObject).map(async(key) => {
                    const result = await usdValueForSpecificToken(key);

                    if (!result.error) {
                        const USDValue = result.data;
                        return {
                            [key]: {
                                portfolioValue : '$' + (allTokenObject[key].portfolioValue * USDValue)
                            }
                        }
                    }
                    })
                ).then((usdAllTokenValueWithDate) => {
                    console.log(`get Protfolio value for all token for given ${date}`, usdAllTokenValueWithDate);
                });
                break;
            case 'getProtfolioValueForSpecificTokenForGivenDate':
                const data = await usdValueForSpecificToken(token);

                if (!data.error) {
                    const USDValue = data.data;
                    const newUsdValueWithDate = portfolioObject.portfolioValue * USDValue;
                    console.log(`get Protfolio value for token ${token} within given date ${date} is $`, newUsdValueWithDate);
                }
                break;
        }
    });
}

const usdValueForSpecificToken = async(token) => {
    return axios({
        method: 'get',
        url: `https://min-api.cryptocompare.com/data/price?fsym=${token}&tsyms=USD`,
        headers: { 'Accept': 'application/json' }, // this api needs this header set for the request
    }).then((currencyData) => {
        return {
            'error': false,
            'data': currencyData.data.USD
        }
    }).catch((error) => {
        return {
            'error': true,
            'message': error
        }
    });
}

//getProtfolioValueForAllToken 
const getProtfolioValueForAllToken = () => {
    readJsonFile('getProtfolioValueForAllToken');
}

//getProtfolioValueForSpecificToken 
const getProtfolioValueForSpecificToken = (token) => {
    if (!token) {
        const eLog = chalk.red(`Need to pass second parameter(token) for this function.`);
        console.log(eLog);
        usage();
        return true;
    }

    readJsonFile('getProtfolioValueForSpecificToken', token);
}


//getProtfolioValueForAllTokenForGivenDate 
const getProtfolioValueForAllTokenForGivenDate = (date) => {
    if (!date) {
        const eLog = chalk.red(`Need to pass second parameter(Date) for this function.`);
        console.log(eLog);
        usage();
        return true;
    }

    let isValidDate = moment(date, 'YYYY-MM-DD', true).isValid();

    if (!isValidDate) {
        const eLog = chalk.red(`Invalid date pass to the function, please pass the date with correct format.`);
        console.log(eLog);
        return true;
    }

    const myDateArray = date.split("-");
    const dateTimeStampStart = new Date(myDateArray[0], myDateArray[1] - 1, myDateArray[2], 0, 0, 0) / 1000;
    const dateTimeStampEnd = new Date(myDateArray[0], myDateArray[1] - 1, myDateArray[2], 23, 59, 59) / 1000;

    readJsonFile('getProtfolioValueForAllTokenForGivenDate', null, date, dateTimeStampStart, dateTimeStampEnd);
}

//getProtfolioValueForSpecificTokenForGivenDate 
const getProtfolioValueForSpecificTokenForGivenDate = (token, date) => {
    if (!token) {
        const eLog = chalk.red(`Need to pass second parameter(token) for this function.`);
        console.log(eLog);
        usage();
        return true;
    }

    if (!date) {
        const eLog = chalk.red(`Need to pass third parameter(Date) for this function.`);
        console.log(eLog);
        usage();
        return true;
    }

    let isValidDate = moment(date, 'YYYY-MM-DD', true).isValid();

    if (!isValidDate) {
        const eLog = chalk.red(`Invalid date pass to the function, please pass the date with correct format.`);
        console.log(eLog);
        return true;
    }

    const myDateArray = date.split("-");
    const dateTimeStampStart = new Date(myDateArray[0], myDateArray[1] - 1, myDateArray[2], 0, 0, 0) / 1000;
    const dateTimeStampEnd = new Date(myDateArray[0], myDateArray[1] - 1, myDateArray[2], 23, 59, 59) / 1000;

    readJsonFile('getProtfolioValueForSpecificTokenForGivenDate', token, date, dateTimeStampStart, dateTimeStampEnd);
}

//addition and substraction function
const additionAndSubstraction = (type, totalValue, value) => {
    let newTotalValue = parseFloat(totalValue);
    let newValue = parseFloat(value);

    if (type === "DEPOSIT") {
        newTotalValue = newTotalValue + newValue;
    } else if (type === "WITHDRAWAL") {
        newTotalValue = newTotalValue - newValue;
    }

    return newTotalValue;
}

switch(args[2]) {
    case 'help':
        usage();
        break;
    case 'getProtfolioValueForAllToken':
        getProtfolioValueForAllToken();
        break;
    case 'getProtfolioValueForSpecificToken':
        getProtfolioValueForSpecificToken(args[3]);
        break;
    case 'getProtfolioValueForAllTokenForGivenDate':
        getProtfolioValueForAllTokenForGivenDate(args[3]);
        break;
    case 'getProtfolioValueForSpecificTokenForGivenDate':
        getProtfolioValueForSpecificTokenForGivenDate(args[3], args[4]);
        break;
    default:
      errorLog('invalid command passed');
      usage();
}
