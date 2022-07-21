import { SyncState } from 'app/lib/types';
import { defineStore } from 'pinia';

import { appConfig } from "../lib/appConfig";
import * as util from "../lib/util";
import { FarmedBlock } from '../lib/types';
import { storeBlocks, getStoredBlocks } from '../lib/blockStorage';

enum Status {
  'idle',
  'syncing',
  'farming'
}

interface State {
  status: Status;
  plotSizeGB: number;
  plotDir: string;
  farmedBlocks: FarmedBlock[];
  peers: number;
  nodeName: string;
  syncState: SyncState;
  rewardAddress: string;
  isFirstLoad: boolean;
  syncedAtNum: number;
}

export const useStore = defineStore('store', {
  state: (): State => ({
    status: Status.idle,
    plotSizeGB: 1,
    plotDir: '/',
    farmedBlocks: [],
    peers: 0,
    nodeName: '',
    syncState: {
      startingBlock: 0,
      currentBlock: 0,
      highestBlock: 0,
    },
    rewardAddress: '',
    // TODO: it is confusing to start with 'false' value, replace with better mechanism
    isFirstLoad: false,
    syncedAtNum: 0,
  }),

  getters: {
    trimmedName(): string {
      return this.nodeName.length > 20
        ? `${this.nodeName.slice(0, 20)}...`
        : this.nodeName;
    },
    blocksByAddress(state): FarmedBlock[] {
      return this.farmedBlocks
        .filter(({ rewardAddr }: FarmedBlock) => rewardAddr === state.rewardAddress)
    },
    // TODO: include voting rewards
    totalEarned(): number {
      return this.blocksByAddress
        .reduce((agg: number, { blockReward, feeReward }) => blockReward + feeReward + agg, 0)
    }
  },

  actions: {
    setPlotDir(dir: string) {
      this.plotDir = dir;
    },
    setPlotSize(size: number) {
      this.plotSizeGB = size;
    },
    async setNodeName(name: string) {
      this.nodeName = name;
      await appConfig.update({ nodeName: name });
    },
    setSyncState(state: SyncState) {
      this.syncState = state;
    },
    setPeers(peers: number) {
      this.peers = peers;
    },
    setStatus(status: Status) {
      this.status = status;
    },
    async startPlotting() {
      const nodeName = util.generateNodeName();
      this.setNodeName(nodeName);

      await appConfig.update({
        plot: {
          location: this.plotDir,
          sizeGB: this.plotSizeGB,
        },
        nodeName,
      });

      this.setStatus(Status.syncing);
    },
    async setRewardAddress(address: string) {
      this.rewardAddress = address;
      await appConfig.update({ rewardAddress: address });
    },
    setFirstLoad() {
      this.isFirstLoad = true;
    },
    addFarmedBlock(block: FarmedBlock) {
      this.farmedBlocks = [block, ...this.farmedBlocks];
      storeBlocks(this.farmedBlocks);
    },
    updateBlockNum(blockNum: number) {
      this.syncedAtNum = blockNum;
    },
    async updateFromConfig() {
      const config = await appConfig.read();
      this.plotSizeGB = config.plot.sizeGB;
      this.plotDir = config.plot.location;
      this.nodeName = config.nodeName;
      this.rewardAddress = config.rewardAddress;
      this.farmedBlocks = getStoredBlocks();
    }
  }
});
