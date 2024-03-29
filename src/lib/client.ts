import { ApiPromise, Keyring } from '@polkadot/api';
import type { Vec } from '@polkadot/types/codec';
import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import * as tauri from '@tauri-apps/api';
import type { EventRecord } from '@polkadot/types/interfaces/system';
import { IU8a } from '@polkadot/types-codec/types';

import * as process from 'process';
import {
  FarmedBlock,
  SubPreDigest,
  SyncState,
} from '../lib/types';
import Config from './config';
import TauriInvoker from './tauri';

const SUNIT = 1000000000000000000n;

interface ClientParams {
  api: ApiPromise;
  config: Config;
  tauri: TauriInvoker;
}

// TODO: implement unit tests
/** Class responsible for interaction with local Subspace node using Polkadot.js API */
export class Client {
  protected clearTauriDestroy: tauri.event.UnlistenFn = () => null;
  protected unsubscribe: tauri.event.UnlistenFn = () => null;
  private api: ApiPromise;
  private config: Config;
  private tauri: TauriInvoker;
  /**
   * Create Client instance
   * @param {ClientParams} params
   * @param {ApiPromise} params.api - Polkadot.js RPC API instance
   * @param {Config} params.config - Config class instance to interact with app config file
   * @param {TauriInvoker} params.tauri - tauri invoker (used for logging here)
   */
  constructor({ api, config, tauri }: ClientParams) {
    this.api = api;
    this.config = config;
    this.tauri = tauri;
  }

  /**
   * Get local node peers count
   * @returns {number} - peers count
   */
  public async getPeersCount(): Promise<number> {
    const peers = await this.api.rpc.system.peers();
    return peers.length;
  }

  // TODO: refactor using reduce
  /**
   * Get block rewards (farming, voting, fees, etc.)
   * @param {IU8a} hash - block hash as IU8a
   * @returns {number} - sum of SSC tokens
   */
  private async getBlockRewards(hash: IU8a): Promise<number> {
    let blockReward = 0;
    const apiAt = await this.api.at(hash);
    const records = (await apiAt.query.system.events()) as Vec<EventRecord>;
    records.forEach((record) => {
      const { section, method, data } = record.event;
      if (section === 'rewards' && method === 'BlockReward') {
        const reward = this.api.registry.createType('u128', data[1]);
        blockReward = Number((reward.toBigInt() * 100n) / SUNIT) / 100;
      } else if (section === 'transactionFees') {
        // TODO: include storage and compute fees
      }
    });

    return blockReward;
  }

  // TODO: handlers param is temporary - create better solution
  /**
   * Start subscription for Subspace blocks and process each block
   * @param handlers.farmedBlockHandler - handle block if it was farmed by user
   * @param handlers.newBlockHandler - handle regular block (was not farmed by user)
   */
  public async startSubscription(handlers: {
    farmedBlockHandler: (block: FarmedBlock) => void;
    newBlockHandler: (blockNum: number) => void;
  }): Promise<void> {
    const { rewardAddress } = (await this.config.readConfigFile());

    this.unsubscribe = await this.api.rpc.chain.subscribeNewHeads(
      async ({ hash, number }) => {
        const blockNum = number.toNumber();
        const header = await this.api.rpc.chain.getHeader(hash);
        const preRuntimeLog = header.digest.logs.find((digestItem) => digestItem.isPreRuntime)?.asPreRuntime[1];
        const preRuntime: SubPreDigest = this.api.registry.createType('SubPreDigest', preRuntimeLog);

        if (preRuntime.solution.reward_address.toString() === rewardAddress) {
          const blockReward = await this.getBlockRewards(hash);
          const block: FarmedBlock = {
            id: hash.toString(),
            time: Date.now(),
            // TODO: remove, transactions count is not displayed anywhere
            transactions: 0,
            blockNum,
            blockReward,
            feeReward: 0,
            // TODO: check if necessary to store address here since we only process blocks farmed by user
            rewardAddr: rewardAddress.toString(),
          };
          handlers.farmedBlockHandler(block);
        }
        handlers.newBlockHandler(blockNum);
      }
    );

    process.on('beforeExit', this.stopSubscription);
    window.addEventListener('unload', this.stopSubscription);
    this.clearTauriDestroy = await tauri.event.once(
      'tauri://destroyed',
      () => console.log('Destroyed event!')
    );
  }

  /**
   * Stop subscription for Subspace blocks, close connection to RPC, destroy Tauri, etc.
   */
  private stopSubscription() {
    this.tauri.infoLogger('block subscription stop triggered');
    this.unsubscribe();
    this.api.disconnect();
    try {
      this.clearTauriDestroy();
      window.removeEventListener('unload', this.stopSubscription);
    } catch (error) {
      this.tauri.errorLogger(error);
    }
  }

  /**
   * Connect to local node RPC using Polkadot.js API
   */
  public async connectApi(): Promise<void> {
    if (!this.api.isConnected) {
      await this.api.connect();
    }
    await this.api.isReadyOrError;
  }

  /**
   * Get sync state of the local node, which is displayed on PlottingProgress and Dashboard pages
   * @returns {SyncState} - sync state object (starting block, current block and highest block)
   */
  public async getSyncState(): Promise<SyncState> {
    return (await this.api.rpc.system.syncState()).toJSON() as unknown as SyncState;
  }

  /**
   * Utility method to determine if local node is syncing
   * @returns {boolean}
   */
  public async isSyncing(): Promise<boolean> {
    const { isSyncing } = await this.api.rpc.system.health();
    return isSyncing.isTrue;
  }

  /**
   * Wrapper for invoking backend method to start local node and connect to the RPC endpoint
   * @param {string} path - folder location
   * @param {string} nodeName - local node name
   */
  public async startNode(path: string, nodeName: string): Promise<void> {
    await this.tauri.startNode(path, nodeName);

    // TODO: workaround in case node takes some time to fully start, should be replaced with tauri events
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await this.connectApi();
  }


  /**
   * Create new reward address on first launch
   * @returns {CreateRewardAddressResult} - result object
   */
  /**
   * @typedef {CreateRewardAddressResult}
   * @property {string} rewardAddress - created reward address
   * @property {string} mnemonic - created mnemonic seed phrase (displayed once after being generated)
   */
  public async createRewardAddress(): Promise<{ rewardAddress: string, mnemonic: string }> {
    const mnemonic = mnemonicGenerate();
    const keyring = new Keyring({ type: 'sr25519', ss58Format: 2254 }); // 2254 is the prefix for subspace-testnet
    await cryptoWaitReady();
    const pair = keyring.createFromUri(mnemonic);
    return {
      rewardAddress: pair.address,
      mnemonic,
    };
  }

  /**
   * Wrapper for invoking backend method to start farmer
   * @param {string} path - plot location
   * @param {number} plotSizeGB - plot size (in GB)
   */
  public async startFarming(path: string, plotSizeGB: number): Promise<void> {
    // convert GB to Bytes
    const plotSize = Math.round(plotSizeGB * 1024 * 1024 * 1024);
    const { rewardAddress } = (await this.config.readConfigFile());
    if (!rewardAddress) {
      throw new Error('Tried to send empty reward address to backend!');
    }

    return this.tauri.startFarming(path, rewardAddress, plotSize);
  }
}
