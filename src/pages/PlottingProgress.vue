<template lang="pug">
q-page.q-pa-lg.q-mr-lg.q-ml-lg
  .row.justify-center.q-mb-md
    .text-h4 {{ $t('plottingProgress.pageTitle') }}
  .row.justify-center
    p {{ $t('plottingProgress.infoDialog') }}
  .row.justify-center.q-mr-lg.q-ml-lg
    .col
      .row
        .col.q-mt-sm
          div {{ $t('plottingProgress.plotsDirectory') }}
          q-input(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="plotDirectory"
          )
      .row.items-center.q-gutter-md
        .col.relative-position
          q-linear-progress.rounded-borders(
            :value="progresspct / 100"
            rounded
            style="height: 40px"
            track-color="blue-2"
          )
            .absolute-full.flex.flex-center
              q-badge(color="white" size="lg" text-color="black")
                template(v-slot:default)
                  .q-pa-xs(style="font-size: 18px" v-if="progresspct > 0") {{ progresspct }}%
                  .q-pa-xs(style="font-size: 14px") {{ plottingData.status }}
          q-linear-progress.absolute-right(
            :value="0.9"
            indeterminate
            style="height: 1px; top: 39px"
            track-color="transparent"
            v-if="!plotFinished"
          )
      .row.justify-center.q-gutter-md.q-pt-md
        .col-1
        .col-3.relative-position
          q-icon.absolute(
            color="blue-1"
            name="downloading"
            size="180px"
            style="z-index: -100; right: 100px"
          )
          .q-mt-sm {{ $t('plottingProgress.plotted') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            suffix="GB"
            v-model="plottingData.finishedGB"
          )
          .q-mt-sm {{ $t('plottingProgress.remaining') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            suffix="GB"
            v-model="plottingData.remainingGB"
          )
        .col-2
        .col-3.relative-position
          q-icon.absolute(
            color="blue-1"
            name="schedule"
            size="180px"
            style="z-index: -100; right: 100px"
          )
          .q-mt-sm {{ $t('plottingProgress.elapsedTime') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="printElapsedTime"
          )
          .q-mt-sm {{ $t('plottingProgress.remainingTime') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="printRemainingTime"
          )

  .row.justify-end.q-mt-lg.absolute-bottom.q-pb-lg
    .col-auto.q-ml-xl.q-pr-md
      div {{ $t('plottingProgress.hint') }}
    .col.q-pr-md
      div {{ $t('plottingProgress.hintInfo') }}
    .col-auto.q-pr-md
    .col-expand
    .col-auto
      q-btn(
        :label="$t('plottingProgress.hints')"
        @click="viewIntro()"
        color="blue-8"
        icon-right="info"
        outline
        size="lg"
      )
    .col-auto
      q-btn(
        :label="$t('plottingProgress.next')"
        @click="$router.replace({ name: 'dashboard' })"
        color="blue-8"
        icon-right="play_arrow"
        outline
        size="lg"
        :disable="!plotFinished"
      )
      q-tooltip.q-pa-md(v-if="!plotFinished")
        p.q-mb-lg {{ $t('plottingProgress.waitPlotting') }}
</template>

<script lang="ts">
import { defineComponent } from "vue"
import * as util from "../lib/util"
import introModal from "../components/introModal.vue"
import { appConfig } from "../lib/appConfig"
import { SyncState } from "../lib/types";
import { useStore } from '../stores/store';

let farmerTimer: number

export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      elapsedms: 0,
      remainingms: 0,
      plottingData: {
        finishedGB: 0,
        remainingGB: 0,
        allocatedGB: 0,
        status: this.$t('plottingProgress.fetchingPlot'),
      },
      plotFinished: false,
      plotDirectory: "",
      syncState: {
        currentBlock: 0,
        highestBlock: 0,
        startingBlock: 0,
      }
    }
  },
  computed: {
    progresspct(): number {
      const progress = parseFloat(
        ((this.syncState.currentBlock * 100) / this.syncState.highestBlock).toFixed(2)
      )
      return isNaN(progress) ? 0 : progress <= 100 ? progress : 100
    },
    printRemainingTime(): string {
      const val =
        this.plotFinished || this.elapsedms === 0
          ? util.formatMS(0)
          : util.formatMS(this.remainingms)
      return val
    },
    printElapsedTime(): string {
      return util.formatMS(this.elapsedms)
    }
  },
  watch: {
    "plottingData.finishedGB"(val) {
      this.plottingData.finishedGB = parseFloat(
        this.plottingData.finishedGB.toFixed(2)
      )
      this.plottingData.remainingGB = parseFloat(
        (this.plottingData.allocatedGB - val).toFixed(2)
      )
      if (this.plottingData.finishedGB >= this.plottingData.allocatedGB)
        this.plottingData.finishedGB = this.plottingData.allocatedGB
    },
  },
  async mounted() {
    util.infoLogger("PLOTTING PROGRESS | getting plot config")
    await this.getPlotConfig()
    util.infoLogger("PLOTTING PROGRESS | starting node")
    await this.waitNode()
    this.startTimers()
    util.infoLogger("PLOTTING PROGRESS | starting plotting")
    this.startPlotting()
  },
  unmounted() {
    if (farmerTimer) clearInterval(farmerTimer)
  },
  methods: {
    async getPlotConfig() {
      this.store.setFirstLoad()
      const config = await appConfig.read()
      this.plottingData.remainingGB = config.plot.sizeGB
      this.plottingData.allocatedGB = config.plot.sizeGB
      this.plotDirectory = config.plot.location
    },
    async waitNode() {
      const { nodeName } = this.store;
      if (nodeName !== "") {
        await this.$client.startNode(this.plotDirectory, nodeName)
      } else {
        util.errorLogger("PLOTTING PROGRESS | node name was empty when tried to start node")
      }

    },
    pausePlotting() {
      this.plotFinished = true
      clearInterval(farmerTimer)
    },
    async farmingWrapper(): Promise<void> {
      const config = await appConfig.read()
      // TODO: remove client methods, call store methods instead: startNode, startFarming
      const farmerStarted = await this.$client.startFarming(this.plotDirectory, config.plot.sizeGB)
      if (!farmerStarted) {
        util.errorLogger("PLOTTING PROGRESS | Farmer start error!")
      }
      util.infoLogger("PLOTTING PROGRESS | farmer started")
      this.plottingData.allocatedGB = config.plot.sizeGB
      await this.$client.startSubscription({
        farmedBlockHandler: this.store.addFarmedBlock,
        newBlockHandler: this.store.updateBlockNum,
      });
      util.infoLogger("PLOTTING PROGRESS | block subscription started")
      this.syncState = (await this.$client.getSyncState()).toJSON() as unknown as SyncState;
      let isSyncing = await this.$client.isSyncing();

      do {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        this.syncState = (await this.$client.getSyncState()).toJSON() as unknown as SyncState;
        this.plottingData.status = `Syncing ${this.syncState.currentBlock} of ${this.syncState.highestBlock} blocks`
        this.plottingData.finishedGB = (this.syncState.currentBlock * this.plottingData.allocatedGB) / this.syncState.highestBlock;
        isSyncing = await this.$client.isSyncing();
      } while (isSyncing);
    },
    startTimers() {
      farmerTimer = window.setInterval(() => {
        this.elapsedms += 1000;
        const ms = (this.elapsedms * this.syncState.highestBlock) / this.syncState.currentBlock - this.elapsedms;
        this.remainingms = util.toFixed(ms, 2);
      }, 1000)
    },
    async startPlotting() {
      await this.farmingWrapper()
      this.pausePlotting()
    },
    async viewIntro() {
      await util.showModal(introModal)
    }
  }
})
</script>

<style lang="sass">
.plottingInput
  font-size: 20px
  padding-top: 5px
  margin-top: 0px
</style>
