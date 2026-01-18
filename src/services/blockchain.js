const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.BSC_RPC_URL
);

const USDT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT_ADDRESS,
  USDT_ABI,
  provider
);

class BlockchainService {
  /* ===============================
     BLOCK INFO
  =============================== */
  async getCurrentBlock() {
    return provider.getBlockNumber();
  }

  /* ===============================
     TOKEN INFO
  =============================== */
  async getUSDTDecimals() {
    return usdtContract.decimals();
  }

  /* ===============================
     TRANSFER EVENTS (MULTI ADDRESS SAFE)
  =============================== */
  async getTransferEvents(fromBlock, toBlock, walletAddresses) {
    // Normalize addresses
    const addressSet = new Set(
      walletAddresses.map(a => a.toLowerCase())
    );

    // No filter on "to" (important!)
    const filter = usdtContract.filters.Transfer();

    const events = await usdtContract.queryFilter(
      filter,
      fromBlock,
      toBlock
    );

    // Filter only deposits to our wallets
    return events.filter(e =>
      addressSet.has(e.args.to.toLowerCase())
    );
  }

  /* ===============================
     CONFIRMATIONS
  =============================== */
  async getTransactionConfirmations(txHash) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.blockNumber) return 0;

    const currentBlock = await provider.getBlockNumber();
    return currentBlock - receipt.blockNumber + 1;
  }

  /* ===============================
     BALANCES
  =============================== */
  async getUSDTBalance(address) {
    const decimals = await this.getUSDTDecimals();
    const balance = await usdtContract.balanceOf(address);
    return ethers.utils.formatUnits(balance, decimals);
  }

  async getBNBBalance(address) {
    const balance = await provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  }

  /* ===============================
     TRANSFER USDT (SWEEP)
  =============================== */
  async transferUSDT(fromPrivateKey, toAddress, amount) {
    const wallet = new ethers.Wallet(fromPrivateKey, provider);
    const contract = new ethers.Contract(
      process.env.USDT_CONTRACT_ADDRESS,
      USDT_ABI,
      wallet
    );

    const decimals = await contract.decimals();
    const amountInWei = ethers.utils.parseUnits(
      amount.toString(),
      decimals
    );

    const tx = await contract.transfer(toAddress, amountInWei);
    await tx.wait(1);

    return tx.hash;
  }

  /* ===============================
     TRANSFER BNB
  =============================== */
  async transferBNB(fromPrivateKey, toAddress, amount) {
    const wallet = new ethers.Wallet(fromPrivateKey, provider);

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.utils.parseEther(amount.toString()),
    });

    await tx.wait(1);
    return tx.hash;
  }

  /* ===============================
     GAS ESTIMATION
  =============================== */
  async estimateUSDTGasCost() {
    const gasPrice = await provider.getGasPrice();
    const gasLimit = ethers.BigNumber.from('65000');
    const cost = gasPrice.mul(gasLimit);
    return ethers.utils.formatEther(cost);
  }
}

module.exports = new BlockchainService();
