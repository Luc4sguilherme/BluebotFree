const {readFileSync} = require('graceful-fs');
const {duration} = require('moment');
const {getAuthCode} = require('steam-totp');
const RequestDatabase = require('../components/RequestDatabase.js');
const {Log, storeFile, readJSON, formatNumber} = require('azul-tools');
const {DebugLogs, sharedse, username, password} = require('../config/main.js')
const {DataStructures} = require('@doctormckay/stdlib');

let CardDatabase = {};

const Offers = new DataStructures.LeastUsedCache(Infinity, duration(10, 'minutes'));

let Profits = {
	"tf2": {
		"buy": {
			"sets": 0,
			"currency": 0
		},
		"sell": {
			"sets": 0,
			"currency": 0
		}
	}
};

module.exports = {
	Init: Init,

	GenerateSteamGuardToken: GenerateSteamGuardToken,
	getLogOn: getLogOn,

	isSteamCommonError: isSteamCommonError,
	ExpForLevel: ExpForLevel,
	fixNumber: fixNumber,

	getSetsCount: getSetsCount,
	getProfits: getProfits,

	isTradeOfferRepeated: isTradeOfferRepeated,
	newTradeOfferFinished: newTradeOfferFinished,

	UpdateProfits: UpdateProfit,

	Now: Now
}

async function Init() {
	try {
		Profits = JSON.parse(readFileSync(`${process.cwd()}/data/profits.json`)) || Profits;
	} catch (e) {}

	const AwaitUpdate = await LoadLocalCardDatabase();
	if (AwaitUpdate) await UpdateDatabase();
	else UpdateDatabase();

	setInterval(() => {
		UpdateDatabase();
	}, duration(12, 'hours'));
}

async function UpdateDatabase() {
	Log.Debug("Updating card sets Database..", false, DebugLogs);
	const FreshDatabase = await RequestDatabase();
	await storeData("database.json", FreshDatabase, true);
	Log.Debug(`Database up to date!, Found ${formatNumber(Object.keys(FreshDatabase).length)} apps with cards!`, false, DebugLogs);
}

async function getSetsCount(appid){
	if (CardDatabase.hasOwnProperty(appid)) return CardDatabase[appid];
	return 0;
}

function getProfits(){
	return Profits;
}

function isTradeOfferRepeated(OfferID){
	return Offers.get(OfferID);
}

function newTradeOfferFinished(OfferID){
	Offers.add(OfferID, true);
}

async function LoadLocalCardDatabase() {
	CardDatabase = await readJSON("data/database.json");
	if (Object.keys(CardDatabase).length > 0) {
		Log.Debug(`Successfuly loaded ${formatNumber(Object.keys(CardDatabase).length)} apps from local database!`, false, DebugLogs);
		return false;
	}
	return true;
}

async function UpdateProfit(SellInfoType, SellInfoCurrency, _sets, _currency) {
	switch (SellInfoType) {
		case 0:
			//sold
			if (SellInfoCurrency == "tf key(s)") UpdateProfits(0, 0, _sets, _currency);
			break;
		case 1:
			//bought
			if (SellInfoCurrency == "tf key(s)") UpdateProfits(_sets, _currency);
			break;
	}
}

async function UpdateProfits(BuySets = 0, BuyCurrency = 0, SellSets = 0, SellCurrency = 0) {
	Profits.tf2.buy.sets += BuySets;
	Profits.tf2.buy.currency += BuyCurrency;

	Profits.tf2.sell.sets += SellSets;
	Profits.tf2.sell.currency += SellCurrency;
	
	return storeData(`profits.json`, this.Profits, true);
}

function Now() {
	return new Date().getTime();
}

function storeData(filename, data, json = false){
	return storeFile(`data/${filename}`, json ? JSON.stringify(data) : data, 'w');
}

function getLogOn() {
	return {
		"accountName": username,
		"password": password,
		"rememberPassword": true
	};
}

async function GenerateSteamGuardToken() {
    return getAuthCode(sharedse);
}

async function ExpForLevel(level = 0) {
    let exp = 0;

    for (let i = 1; i <= level; i++) {
        exp += Math.ceil(i / 10) * 100; //Current level exp
    }

    return exp;
}

function fixNumber(number, x) {
	return parseFloat(number.toFixed(x));
}

function isSteamCommonError(ErrorMessage = "", LowerCase = false) {
	if (LowerCase) ErrorMessage = ErrorMessage.toLowerCase();
	if (ErrorMessage.indexOf("socket hang up") > -1) return true;
	if (ErrorMessage.indexOf("EBUSY") > -1) return true;
	if (ErrorMessage == "ETIMEDOUT") return true;
	if (ErrorMessage == "ESOCKETTIMEDOUT") return true;
	return false;
}