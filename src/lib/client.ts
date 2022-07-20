import { ApiPromise, Keyring } from "@polkadot/api"
import type { Vec } from "@polkadot/types/codec"
import { mnemonicGenerate, cryptoWaitReady } from "@polkadot/util-crypto"
import * as event from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/tauri"
import * as process from "process"
import * as util from "../lib/util"
import { appConfig } from "./appConfig"
import {
  FarmedBlock,
  SubPreDigest
} from "../lib/types"
import type { SyncState, EventRecord } from '@polkadot/types/interfaces/system';
import { IU8a } from "@polkadot/types-codec/types"

const tauri = { event, invoke }
const SUNIT = 1000000000000000000n

export class Client {
  protected clearTauriDestroy: event.UnlistenFn = () => null;
  protected unsubscribe: event.UnlistenFn = () => null;

  private api: ApiPromise;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  async getPeersCount(): Promise<number> {
    const peers = await this.api.rpc.system.peers();
    return peers.length;
  }

  // TODO: implement unit test
  // TODO: refactor using reduce
  async getBlockRewards(hash: IU8a): Promise<number> {
    let blockReward = 0;
    const apiAt = await this.api.at(hash);
    const records = (await apiAt.query.system.events()) as Vec<EventRecord>;
    records.forEach((record) => {
      const { section, method, data } = record.event
      if (section === "rewards" && method === "BlockReward") {
        const reward = this.api.registry.createType("u128", data[1]);
        blockReward = Number((reward.toBigInt() * 100n) / SUNIT) / 100;
      } else if (section === "transactionFees") {
        // TODO: include storage and compute fees
      }
    })

    return blockReward;
  }

  // TODO: handlers param is temporary - create better solution
  async startSubscription(handlers: {
    farmedBlockHandler: (block: FarmedBlock) => void;
    newBlockHandler: (blockNum: number) => void;
  }): Promise<void> {
    const rewardAddress: string = (await appConfig.read()).rewardAddress;

    this.unsubscribe = await this.api.rpc.chain.subscribeNewHeads(
      async ({ hash, number }) => {
        const blockNum = number.toNumber()
        const header = await this.api.rpc.chain.getHeader(hash);

        // TODO: handle vote rewards: check VoteReward events and aggregate
        // TODO: extract farmed block rewards logic
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
          }
          handlers.farmedBlockHandler(block);
        }
        handlers.newBlockHandler(blockNum);
      }
    )

    process.on("beforeExit", this.stopSubscription)
    window.addEventListener("unload", this.stopSubscription)
    this.clearTauriDestroy = await tauri.event.once(
      "tauri://destroyed",
      () => console.log("Destroyed event!")
    )
  }

  stopSubscription() {
    util.infoLogger("block subscription stop triggered")
    this.unsubscribe()
    this.api.disconnect()
    try {
      this.clearTauriDestroy()
      window.removeEventListener("unload", this.stopSubscription)
    } catch (error) {
      util.errorLogger(error)
    }
  }

  public async connectApi(): Promise<void> {
    if (!this.api.isConnected) {
      await this.api.connect()
    }
    await this.api.isReadyOrError
  }

  public async getSyncState(): Promise<SyncState> {
    return this.api.rpc.system.syncState();
  }

  public async isSyncing(): Promise<boolean> {
    const { isSyncing } = await this.api.rpc.system.health();
    return isSyncing.isTrue;
  }

  public async startNode(path: string, nodeName: string): Promise<void> {
    await tauri.invoke("start_node", { path, nodeName })
    // TODO: workaround in case node takes some time to fully start.
    await new Promise((resolve) => setTimeout(resolve, 7000))
    await this.connectApi()
  }

  public async createRewardAddress(): Promise<{ rewardAddress: string, mnemonic: string }> {
    const mnemonic = mnemonicGenerate()
    const keyring = new Keyring({ type: 'sr25519', ss58Format: 2254 }) // 2254 is the prefix for subspace-testnet
    await cryptoWaitReady();
    const pair = keyring.createFromUri(mnemonic)
    return {
      rewardAddress: pair.address,
      mnemonic,
    }
  }

  /* FARMER INTEGRATION */
  public async startFarming(path: string, plotSizeGB: number): Promise<boolean> {
    // convert GB to Bytes
    const plotSize = Math.round(plotSizeGB * 1024 * 1024 * 1024)
    const rewardAddress: string = (await appConfig.read()).rewardAddress
    if (rewardAddress === "") {
      util.errorLogger("Tried to send empty reward address to backend!")
    }
    return await tauri.invoke("farming", { path, rewardAddress, plotSize })
  }
}
