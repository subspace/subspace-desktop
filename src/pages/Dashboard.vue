<template lang="pug">
q-page.q-pl-lg.q-pr-lg.q-pt-md
  .row.justify-center
  .row.q-pb-sm.justify-center
  div(v-if="!loading")
    .row.q-gutter-md.q-pb-md(v-if="!expanded")
      .col
        plotCard(:plot="plot")
      .col
        netCard(:network="network")
    .row.q-gutter-md
      .col
        farmedList(
          :expanded="expanded"
          @expand="expand"
        )
  div(v-else)
    .flex
      .absolute-center
        .row.justify-center
          q-spinner-orbit(color="grey" size="120px")
        h4 {{ $t('dashboard.loadingMsg')}}
</template>

<script lang="ts">
import { defineComponent, watch } from "vue"
import { Notify } from "quasar"
import * as util from "../lib/util"
import farmedList from "../components/farmedList.vue"
import netCard from "../components/netCard.vue"
import plotCard from "../components/plotCard.vue"
import { FarmedBlock } from "../lib/types"
import { useStore } from '../stores/store';
import { SyncState } from "../lib/types";

export default defineComponent({
  components: { farmedList, netCard, plotCard },
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      network: {
        state: "starting",
        message: this.$t('dashboard.initializing'),
        peers: 0
      },
      plot: {
        state: "starting",
        message: this.$t('dashboard.initializing'),
      },
      expanded: false,
      util,
      loading: true,
      unsubscribe: () => null,
      peerInterval: 0,
    }
  },
  async mounted() {
    // TODO: remove client methods, call store methods instead: startNode, startFarming
    if (!this.store.isFirstLoad) {
      // TODO: fetch blocks from storage 
      util.infoLogger("DASHBOARD | starting node");
      const { nodeName, plotDir, plotSizeGB } = this.store;
      if (nodeName !== "") {
        await this.$client.startNode(plotDir, nodeName)
      } else {
        util.errorLogger("DASHBOARD | node name was empty when tried to start node")
      }
      util.infoLogger("DASHBOARD | starting farmer")
      const farmerStarted = await this.$client.startFarming(plotDir, plotSizeGB)
      if (!farmerStarted) {
        util.errorLogger("DASHBOARD | Farmer start error!")
      }
      util.infoLogger("DASHBOARD | starting block subscription")
      await this.$client.startSubscription({
        farmedBlockHandler: this.store.addFarmedBlock,
        newBlockHandler: this.store.updateBlockNum,
      });
    }

    this.loading = false

    this.fetchPeersCount();// fetch initial peers count value
    this.peerInterval = window.setInterval(this.fetchPeersCount, 30000);

    // watch for farmed blocks
    watch(
      () => this.store.farmedBlocks.length,
      () => {
        if (this.store.farmedBlocks.length) {
          this.farmBlock(this.store.farmedBlocks[0]);
        }
      },
      { immediate: true }
    )

    // watch for new blocks (synced at block number)
    watch(
      () => this.store.syncedAtNum,
      () => {
        if (this.network.state === "finished") {
          this.network.message = this.$t('dashboard.syncedAt', { blockNumber: this.store.syncedAtNum });
        }
      },
      { immediate: true }
    )

    await this.checkNodeAndNetwork()
    await this.checkFarmerAndPlot()
  },
  unmounted() {
    this.unsubscribe()
    clearInterval(this.peerInterval)
  },
  methods: {
    async fetchPeersCount() {
      const peers = await this.$client.getPeersCount();
      this.network.peers = peers;
    },
    expand(val: boolean) {
      this.expanded = val
    },
    async checkFarmerAndPlot() {
      // TODO: clarify
      this.plot.state = "verifying"
      this.plot.message = this.$t('dashboard.verifyingPlot')
      this.plot.message = this.$t('dashboard.syncedMsg')
      this.plot.state = "finished"
    },
    async checkNodeAndNetwork() {
      this.network.state = "verifying"
      this.network.message = this.$t('dashboard.verifyingNet')

      const syncState = (await this.$client.getSyncState()).toJSON() as unknown as SyncState;
      this.store.setSyncState(syncState);
      do {
        const { currentBlock, highestBlock } = this.store.syncState;
        this.network.message = this.$t('dashboard.syncingMsg', { currentBlock, highestBlock });
        await new Promise((resolve) => setTimeout(resolve, 3000))
        const syncState = (await this.$client.getSyncState()).toJSON() as unknown as SyncState;
        this.store.setSyncState(syncState);
      } while (this.store.syncState.currentBlock < this.store.syncState.highestBlock)

      this.network.message = this.$t('dashboard.nodeIsSynced', { currentBlock: this.store.syncState.currentBlock });
      this.network.state = "finished"
    },
    farmBlock(block: FarmedBlock) {
      Notify.create({
        color: "green",
        progress: true,
        // this is ugly, but will be removed in the new Dashboard design
        message: `${this.$t('dashboard.farmedBlock')}: ${block.blockNum} ${this.$t('dashboard.reward')} ${block.blockReward + block.feeReward} ${this.$t('dashboard.tokenName')}`,
        position: "bottom-right"
      })
    }
  }
})
</script>
