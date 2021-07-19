const {cutil} = require("@ghasemkiani/base/cutil");
const {Obj: Base} = require("@ghasemkiani/base/obj");
const {Inputter} = require("@ghasemkiani/io/inputter");
const {quantity} = require("@ghasemkiani/base-utils/quantity");
const {util: utilBsc} = require("@ghasemkiani/binance-smart-chain/util");
const {util: utilBc} = require("@ghasemkiani/binance-chain/util");
const {Token: TokenBsc} = require("@ghasemkiani/binance-smart-chain/token");
const {TokenHub} = require("@ghasemkiani/binance-smart-chain/token-hub");
const {Account: AccountBsc} = require("@ghasemkiani/binance-smart-chain/account");
const {Account: AccountBc} = require("@ghasemkiani/binance-chain/account");

class Bridge extends Base {
	async toTransferToBc({account, toAddress, tokenId, amount, amount_, expireTime}) {
		let bridge = this;
		expireTime ||= quantity.time().now().u("min").delta(bridge.expireMins).u("ms").n();
		let isBnb = (tokenId === "BNB");
		
		let accountBc = new AccountBc({address: toAddress});
		toAddress = accountBc.addressEth;
		
		let tokenWBNB = new TokenBsc({id: "WBNB", account});
		await tokenWBNB.toUpdate();
		
		let token = new TokenBsc({id: isBnb ? "WBNB" : tokenId, account});
		await token.toGetAbi();
		await token.toGetDecimals();
		if (cutil.isNilOrEmptyString(amount_)) {
			amount_ = token.wrapNumber(cutil.asNumber(amount));
		}
		// Zero or negative amount is added to token balance
		if (BigInt(amount_) <= 0n) {
			amount_ = (BigInt(await account.toGetTokenBalance_(tokenId)) + BigInt(amount_)).toString();
		}
		
		let BINANCE_CHAIN_PRECISION = utilBc.ASSET_PRECISION;
		if (token.decimals > BINANCE_CHAIN_PRECISION) {
			let N = 10 ** (token.decimals - BINANCE_CHAIN_PRECISION);
			amount_ = ((BigInt(amount_) / BigInt(N)) * BigInt(N)).toString();
		}
		
		let hub = new TokenHub({account});
		await hub.toGetAbi();
		let miniRelayFee_ = await hub.toGetMiniRelayFee();
		let value_ = miniRelayFee_;
		if(isBnb) {
			value_ = (BigInt(value_) + BigInt(amount_)).toString();
		}
		
		let contractAddr = isBnb ? "0x" + "0".repeat(40) : token.address;
		let recipient = toAddress;
		
		console.log(`Transferring to Binance Chain from address:\n${account.address}`);
		console.log({value_, contractAddr, recipient, amount_, expireTime});
		
		if(!isBnb) {
			let spender = hub.address;
			let allowance_ = await token.toGetAccountAllowance_(spender);
			console.log({allowance_});
			if (BigInt(allowance_) < BigInt(amount_)) {
				console.log(`Approving...`);
				console.log({spender, amount_});
				let result = await token.toApprove_(spender, amount_);
				console.log(JSON.stringify(result));
			}
		}
		
		let result = await hub.toCallWriteWithValue(value_, "transferOut", contractAddr, recipient, amount_, expireTime);
		return result;
	}
	async toTransferToBsc({account, toAddress, symbol, amount, expireTime}) {
		let bridge = this;
		expireTime ||= quantity.time().now().u("min").delta(bridge.expireMins).u("ms").n();
		await account.toInit();
		
		let fromAddress = account.address;
		
		console.log(`Transferring to Binance Smart Chain from address:\n${account.address}`);
		console.log({toAddress, fromAddress, amount, symbol, expireTime});
		
		let result = await account.bncClient.bridge.transferFromBcToBsc({toAddress, fromAddress, amount, symbol, expireTime});
		return result;
	}
}
cutil.extend(Bridge.prototype, {
	expireMins: 30,
});

module.exports = {Bridge};

// binance-chain/cross-chain-transfer-sample
