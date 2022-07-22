import { SyncState } from 'app/lib/types';
import { defineStore } from 'pinia';

import { appConfig } from "../lib/appConfig";
import * as util from "../lib/util";
import { FarmedBlock } from '../lib/types';
import { storeBlocks, getStoredBlocks } from '../lib/blockStorage';
import { Client } from '../lib/client';

export type Status = 'idle' | 'startingNode' | 'syncing' | 'farming';

interface Network {
  peers: number;
  syncedAtNum: number;
  state: string;
  message: string;
}

interface Plot {
  state: string;
  message: string;
}

interface Plotting {
  finishedGB: number;
  remainingGB: number;
  status: string;
}

interface State {
  status: Status;
  plotSizeGB: number;
  plotDir: string;
  farmedBlocks: FarmedBlock[];
  nodeName: string;
  syncState: SyncState;
  rewardAddress: string;
  isFirstLoad: boolean;
  network: Network;
  plot: Plot;
  plotting: Plotting;
}

export const useStore = defineStore('store', {
  state: (): State => ({
    status: 'idle',
    plotSizeGB: 1,
    plotDir: '/',
    farmedBlocks: [],
    nodeName: '',
    syncState: {
      startingBlock: 0,
      currentBlock: 0,
      highestBlock: 0,
    },
    // TODO: consider creating separate store for Network
    network: {
      syncedAtNum: 0,
      peers: 0,
      state: 'starting',
      // TODO: set int string
      message: 'dashboard.initializing', // this.$t('dashboard.initializing')
    },
    rewardAddress: '',
    // TODO: it is confusing to start with 'false' value, replace with better mechanism
    isFirstLoad: false,
    plot: {
      state: 'starting',
      // TODO: set int string
      message: 'dashboard.initializing', // this.$t('dashboard.initializing')
    },
    plotting: {
      finishedGB: 0,
      remainingGB: 0,
      // TODO: set int string
      status: 'plottingProgress.fetchingPlot',
    }
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
    },
    plottingFinished(): number {
      return parseFloat(this.plotting.finishedGB.toFixed(2))
    },
    plottingRemaining(): number {
      return parseFloat((this.plotSizeGB - this.plotting.finishedGB).toFixed(2))
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
      this.network.peers = peers;
    },
    setStatus(status: Status) {
      this.status = status;
    },
    async confirmPlottingSetup() {
      const nodeName = util.generateNodeName();
      this.setNodeName(nodeName);

      await appConfig.update({
        plot: {
          location: this.plotDir,
          sizeGB: this.plotSizeGB,
        },
        nodeName,
      });
    },
    setRewardAddress(address: string) {
      this.rewardAddress = address;
    },
    // we need a separate method, because we store address to config only after user confirmed (modal in SetupPlot.vue)
    async confirmRewardAddress() {
      await appConfig.update({ rewardAddress: this.rewardAddress });
    },
    setFirstLoad() {
      this.isFirstLoad = true;
    },
    addFarmedBlock(block: FarmedBlock) {
      this.farmedBlocks = [block, ...this.farmedBlocks];
      storeBlocks(this.farmedBlocks);
    },
    updateBlockNum(blockNum: number) {
      this.network.syncedAtNum = blockNum;
    },
    async updateFromConfig() {
      const config = await appConfig.read();
      this.plotSizeGB = config.plot.sizeGB;
      this.plotDir = config.plot.location;
      this.nodeName = config.nodeName;
      this.rewardAddress = config.rewardAddress;
      this.farmedBlocks = getStoredBlocks();
    },
    setNetworkState(state: string) {
      this.network.state = state;
    },
    setNetworkMessage(message: string) {
      this.network.message = message;
    },
    setPlotState(state: string) {
      this.plot.state = state;
    },
    setPlotMessage(message: string) {
      this.plot.message = message;
    },
    // TODO: find better way to provide client
    async startNode(client: Client) {
      if (this.nodeName && this.plotDir) {
        this.setStatus('startingNode');
        await client.startNode(this.plotDir, this.nodeName);
      } else {
        // TODO: create error state and update here
        util.errorLogger("NODE START | node name and plot directory are required to start node");
      }
    },
    setPlottingFinished(value: number) {
      this.plotting.finishedGB = value;
    },
    setPlottingRemaining(value: number) {
      this.plotting.remainingGB = value;
    },
    setPlottingStatus(status: string) {
      this.plotting.status = status;
    }
  }
});
