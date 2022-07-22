<template lang="pug">
q-page.q-pl-lg.q-pr-lg.q-pt-md
  .row.justify-center
  .row.q-pb-sm.justify-center
  div(v-if="store.status === 'startingNode'")
    .flex
      .absolute-center
        .row.justify-center
          q-spinner-orbit(color="grey" size="120px")
        h4 {{ $t('dashboard.loadingMsg')}}
  div(v-else)
    .row.q-gutter-md.q-pb-md(v-if="!expanded")
      .col
        plotCard
      .col
        netCard
    .row.q-gutter-md
      .col
        farmedList(
          :expanded="expanded"
          @expand="expand"
        )
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

export default defineComponent({
  components: { farmedList, netCard, plotCard },
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      expanded: false,
      util,
      peerInterval: 0,
    }
  },
  async mounted() {
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
      () => this.store.network.syncedAtNum,
      () => {
        if (this.store.network.state === "finished") {
          this.store.setNetworkMessage(this.$t('dashboard.syncedAt', { blockNumber: this.store.network.syncedAtNum }));
        }
      },
      { immediate: true }
    )

    if (!this.store.isFirstLoad) {
      util.infoLogger("DASHBOARD | starting node");
      await this.store.startNode(this.$client);
    }

    // TODO: consider moving fetching peers into store 
    this.fetchPeersCount(); // fetch initial peers count value
    this.peerInterval = window.setInterval(this.fetchPeersCount, 30000);
    await this.store.startFarmer(this.$client);
  },
  unmounted() {
    clearInterval(this.peerInterval)
  },
  methods: {
    async fetchPeersCount() {
      const peers = await this.$client.getPeersCount();
      this.store.setPeers(peers);
    },
    expand(val: boolean) {
      this.expanded = val
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
