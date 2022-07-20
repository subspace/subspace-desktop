import { SyncState } from 'app/lib/types';
import { defineStore } from 'pinia';

import { appConfig } from "../lib/appConfig";
import * as util from "../lib/util";

enum Status {
  'idle',
  'syncing',
  'farming'
}

export const useStore = defineStore('store', {
  state: () => ({
    status: Status.idle,
    plotSizeGB: 1,
    plotDir: '/',
    farmed: [],
    peers: 0,
    nodeName: '',
    syncState: {
      currentBlock: 0,
      highestBlock: 0,
    },
    rewardAddress: '',
    // TODO: it is confusing to start with 'false' value, replace with better mechanism
    isFirstLoad: false,
  }),

  getters: {
    trimmedName(): string {
      return this.nodeName.length > 20
        ? `${this.nodeName.slice(0, 20)}...`
        : this.nodeName;
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
          sizeGB: this.plotSizeGB 
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
    }
  }
});
