import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, Contract } from 'ethers';
import { GasRelayService } from './gas-relay.service';
import { SignatureService } from './signature.service';
import * as EscrowArtifact from './abis/Escrow.json';
import * as eRWFArtifact from './abis/eRWF.json';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class ContractsService {
  private readonly logger = new LoggerService(ContractsService.name);
  private readonly escrowContract: Contract & any;
  private readonly eRWFContract: Contract & any;
  private readonly chainId: number;

  constructor(
    private configService: ConfigService,
    private gasRelayService: GasRelayService,
    private signatureService: SignatureService,
  ) {
    const provider = this.gasRelayService.getProvider();
    const escrowAddress = this.normalizeAddress(
      this.configService.get<string>('ESCROW_CONTRACT_ADDRESS'),
      'ESCROW_CONTRACT_ADDRESS',
    );
    const eRWFAddress = this.normalizeAddress(
      this.configService.get<string>('ERWF_CONTRACT_ADDRESS'),
      'ERWF_CONTRACT_ADDRESS',
    );
    this.chainId = Number(this.configService.get<string | number>('CHAIN_ID'));

    if (!Number.isFinite(this.chainId) || this.chainId <= 0) {
      throw new Error('CHAIN_ID must be a positive number');
    }

    const escrowAbi = (EscrowArtifact as any).abi ?? EscrowArtifact;
    const eRWFAbi = (eRWFArtifact as any).abi ?? eRWFArtifact;

    this.escrowContract = new ethers.Contract(escrowAddress, escrowAbi, provider) as any;
    this.eRWFContract = new ethers.Contract(eRWFAddress, eRWFAbi, provider) as any;

    // Dispute resolution uses the relay/treasury wallet. On deploy, that address
    // (or ADMIN_ADDRESS) receives ADMIN_ROLE — no separate admin key needed.
    this.logger.info('Contracts initialized', {
      escrowAddress,
      eRWFAddress,
      chainId: this.chainId,
      relayWallet: this.gasRelayService.getTreasuryWallet().address,
    });
  }

  /**
   * Create a new deal on-chain (user signs, relay pays gas)
   */
  async createDealOnChain(
    senderWallet: ethers.Wallet | ethers.HDNodeWallet,
    driverAddress: string,
    receiverAddress: string,
    amount: string,
  ): Promise<{ txHash: string; dealId: number }> {
    try {
      const senderAddress = senderWallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const nonce = await this.escrowContract.getNonce(senderAddress);
      const nextDealId = await this.escrowContract.nextDealId();

      const signature = await this.signatureService.signAction(
        senderWallet,
        escrowAddress,
        this.chainId,
        'createDeal',
        Number(nextDealId),
        Number(nonce),
      );

      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const amountWei = ethers.parseEther(amount);

      const tx = await this.escrowContract.connect(relayWallet).createDeal(
        senderAddress,
        driverAddress,
        receiverAddress,
        amountWei,
        signature,
      );

      const receipt = await tx.wait();
      this.logger.logTransaction('createDeal', receipt.hash, {
        dealId: Number(nextDealId),
        sender: senderAddress,
        amount,
      });

      return { txHash: receipt.hash, dealId: Number(nextDealId) };
    } catch (error) {
      throw new Error(this.formatContractError('createDeal', error));
    }
  }

  /**
   * Lock funds — receiver signs Escrow EIP-712 Action; relay submits lockFunds.
   * Escrow pulls eRWF via ESCROW_ROLE (no approve / permit / user gas).
   */
  async lockFundsOnChain(
    receiverWallet: ethers.Wallet | ethers.HDNodeWallet,
    dealId: number,
  ): Promise<string> {
    try {
      const receiverAddress = receiverWallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const relayWallet = this.gasRelayService.getTreasuryWallet();

      const nonce = await this.escrowContract.getNonce(receiverAddress);
      const signature = await this.signatureService.signAction(
        receiverWallet,
        escrowAddress,
        this.chainId,
        'lockFunds',
        dealId,
        Number(nonce),
      );

      const tx = await this.escrowContract.connect(relayWallet).lockFunds(dealId, signature);
      const receipt = await tx.wait();

      this.logger.logTransaction('lockFunds', receipt.hash, {
        dealId,
        receiver: receiverAddress,
      });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('lockFunds', error));
    }
  }

  async markShippedOnChain(
    senderWallet: ethers.Wallet | ethers.HDNodeWallet,
    dealId: number,
  ): Promise<string> {
    try {
      const senderAddress = senderWallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const nonce = await this.escrowContract.getNonce(senderAddress);
      const signature = await this.signatureService.signAction(
        senderWallet,
        escrowAddress,
        this.chainId,
        'markShipped',
        dealId,
        Number(nonce),
      );

      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const tx = await this.escrowContract.connect(relayWallet).markShipped(dealId, signature);
      const receipt = await tx.wait();

      this.logger.logTransaction('markShipped', receipt.hash, {
        dealId,
        sender: senderAddress,
      });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('markShipped', error));
    }
  }

  async markDeliveredOnChain(
    driverWallet: ethers.Wallet | ethers.HDNodeWallet,
    dealId: number,
  ): Promise<string> {
    try {
      const driverAddress = driverWallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const nonce = await this.escrowContract.getNonce(driverAddress);
      const signature = await this.signatureService.signAction(
        driverWallet,
        escrowAddress,
        this.chainId,
        'markDelivered',
        dealId,
        Number(nonce),
      );

      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const connected = this.escrowContract.connect(relayWallet);

      // Surface clear revert reasons instead of ethers "missing revert data"
      try {
        await connected.markDelivered.staticCall(dealId, signature);
      } catch (simError) {
        throw new Error(this.formatContractError('markDelivered', simError));
      }

      const tx = await connected.markDelivered(dealId, signature);
      const receipt = await tx.wait();

      this.logger.logTransaction('markDelivered', receipt.hash, {
        dealId,
        driver: driverAddress,
      });
      return receipt.hash;
    } catch (error) {
      if (String(error?.message || '').startsWith('markDelivered failed:')) {
        throw error;
      }
      throw new Error(this.formatContractError('markDelivered', error));
    }
  }

  async revokeOnChain(
    wallet: ethers.Wallet | ethers.HDNodeWallet,
    dealId: number,
    reasonCode: number,
  ): Promise<string> {
    try {
      const userAddress = wallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const nonce = await this.escrowContract.getNonce(userAddress);
      const signature = await this.signatureService.signAction(
        wallet,
        escrowAddress,
        this.chainId,
        'revoke',
        dealId,
        Number(nonce),
      );

      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const tx = await this.escrowContract
        .connect(relayWallet)
        .revoke(dealId, reasonCode, userAddress, signature);
      const receipt = await tx.wait();

      this.logger.logTransaction('revoke', receipt.hash, {
        dealId,
        user: userAddress,
        reasonCode,
      });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('revoke', error));
    }
  }

  async releaseFundsOnChain(dealId: number): Promise<string> {
    try {
      const treasuryWallet = this.gasRelayService.getTreasuryWallet();
      const tx = await this.escrowContract.connect(treasuryWallet).releaseFunds(dealId);
      const receipt = await tx.wait();
      this.logger.logTransaction('releaseFunds', receipt.hash, { dealId });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('releaseFunds', error));
    }
  }

  async autoCancelOnChain(dealId: number): Promise<string> {
    try {
      const treasuryWallet = this.gasRelayService.getTreasuryWallet();
      const tx = await this.escrowContract.connect(treasuryWallet).autoCancelIfUnlocked(dealId);
      const receipt = await tx.wait();
      this.logger.logTransaction('autoCancel', receipt.hash, { dealId });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('autoCancelIfUnlocked', error));
    }
  }

  async cancelBeforeLockOnChain(
    wallet: ethers.Wallet | ethers.HDNodeWallet,
    dealId: number,
  ): Promise<string> {
    try {
      const userAddress = wallet.address;
      const escrowAddress = await this.escrowContract.getAddress();
      const nonce = await this.escrowContract.getNonce(userAddress);
      const signature = await this.signatureService.signAction(
        wallet,
        escrowAddress,
        this.chainId,
        'cancelBeforeLock',
        dealId,
        Number(nonce),
      );

      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const tx = await this.escrowContract
        .connect(relayWallet)
        .cancelBeforeLock(dealId, userAddress, signature);
      const receipt = await tx.wait();

      this.logger.logTransaction('cancelBeforeLock', receipt.hash, {
        dealId,
        user: userAddress,
      });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('cancelBeforeLock', error));
    }
  }

  /**
   * Resolve dispute — signed by relay/treasury wallet (must hold ADMIN_ROLE).
   * Matches local deploy: deployer/adminAddress defaults to ADMIN_ROLE holder.
   */
  async resolveDisputeOnChain(
    dealId: number,
    amountToSender: string,
    amountToReceiver: string,
  ): Promise<string> {
    try {
      const amountToSenderWei = ethers.parseEther(amountToSender);
      const amountToReceiverWei = ethers.parseEther(amountToReceiver);
      const relayWallet = this.gasRelayService.getTreasuryWallet();
      const connected = this.escrowContract.connect(relayWallet);

      // Validate up-front so the admin gets an instant, clear error instead of
      // waiting minutes for a revert to surface as "missing revert data".
      try {
        await connected.resolveDispute.staticCall(
          dealId,
          amountToSenderWei,
          amountToReceiverWei,
        );
      } catch (simError) {
        throw new Error(this.formatContractError('resolveDispute', simError));
      }

      const tx = await connected.resolveDispute(
        dealId,
        amountToSenderWei,
        amountToReceiverWei,
      );

      // Do not block the admin HTTP response. Portal shows ResolutionPending
      // until the event listener confirms DisputeResolved on-chain.
      void this.waitForConfirmation(tx, 'resolveDispute', {
        dealId,
        amountToSender,
        amountToReceiver,
        admin: relayWallet.address,
      });
      return tx.hash;
    } catch (error) {
      if (String(error?.message || '').startsWith('resolveDispute failed:')) {
        throw error;
      }
      throw new Error(this.formatContractError('resolveDispute', error));
    }
  }

  /**
   * Await a tx receipt but cap how long the caller blocks. Final confirmation
   * (or failure) is always logged in the background so we never lose the record;
   * on timeout we return early and let the event listener reconcile state.
   */
  private waitForConfirmation(
    tx: ethers.ContractTransactionResponse,
    action: string,
    meta: Record<string, unknown>,
    timeoutMs = 20000,
  ): Promise<void> {
    const waitPromise = tx.wait();

    waitPromise.then(
      (receipt: any) =>
        this.logger.logTransaction(action, receipt?.hash ?? tx.hash, meta),
      (err: any) =>
        this.logger.warn(
          `${action} confirmation failed after submit (${tx.hash}): ${err?.message || err}`,
        ),
    );

    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.logger.info(`${action} submitted; confirmation still pending`, {
          txHash: tx.hash,
          ...meta,
        });
        resolve();
      }, timeoutMs);

      // Settle (resolve/reject) both stop the caller from blocking further.
      waitPromise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        () => {
          clearTimeout(timer);
          resolve();
        },
      );
    });
  }

  async getDealFromChain(dealId: number): Promise<any> {
    return this.escrowContract.getDeal(dealId);
  }

  async getNextDealId(): Promise<number> {
    return Number(await this.escrowContract.nextDealId());
  }

  getEscrowContract(): ethers.Contract {
    return this.escrowContract;
  }

  getChainId(): number {
    return this.chainId;
  }

  async getTokenBalance(address: string): Promise<bigint> {
    return this.eRWFContract.balanceOf(address);
  }

  async mintTokens(toAddress: string, amount: string): Promise<string> {
    try {
      const treasuryWallet = this.gasRelayService.getTreasuryWallet();
      const amountWei = ethers.parseEther(amount);
      const tx = await this.eRWFContract.connect(treasuryWallet).mint(toAddress, amountWei);
      const receipt = await tx.wait();
      this.logger.logTransaction('mint', receipt.hash, { toAddress, amount });
      return receipt.hash;
    } catch (error) {
      throw new Error(this.formatContractError('mint', error));
    }
  }

  private normalizeAddress(value: string | undefined, envName: string): string {
    const trimmed = (value || '').trim().replace(/^["']|["']$/g, '');
    if (!trimmed) {
      throw new Error(`${envName} must be set`);
    }
    if (!ethers.isAddress(trimmed)) {
      throw new Error(
        `${envName} is not a valid address: "${trimmed}". Check for typos or leading spaces in backend/.env`,
      );
    }
    return ethers.getAddress(trimmed);
  }

  private formatContractError(action: string, error: any): string {
    const rpcMessage =
      error?.info?.error?.message ||
      error?.error?.message ||
      error?.data?.message;
    const short = error?.shortMessage || '';
    // Free-tier RPC timeouts often arrive as CALL_EXCEPTION + "missing revert data"
    // with the real cause only in info.error.message.
    const opaque =
      !error?.reason &&
      (/missing revert data/i.test(short) || error?.code === 'CALL_EXCEPTION');

    const reason =
      error?.reason ||
      (opaque && rpcMessage ? rpcMessage : null) ||
      rpcMessage ||
      short ||
      error?.message ||
      String(error);
    this.logger.error(`${action} failed: ${reason}`);
    return `${action} failed: ${reason}`;
  }
}
