<template lang="pug">
q-page.q-pa-lg.q-mr-lg.q-ml-lg
  .row.justify-center.q-mb-md
    .text-h4 {{ $t('setupPlot.pageTitle') }}
  .row.justify-center
    p {{ $t('setupPlot.infoDialog') }}
  .row.justify-center.q-mr-lg.q-ml-lg
    .col
      .row
        .col.q-mt-sm
          div {{ $t('setupPlot.plotsDirectory') }}
          q-input.q-field--highlighted(
            :error="!validPath"
            :error-message="$t('setupPlot.invalidDir')"
            color="blue"
            dense
            input-class="setupPlotInput"
            outlined
            v-model="store.plotDir"
          )
            template(v-slot:after)
              q-btn.shadow-0(
                @click="selectDir()"
                color="blue"
                flat
                icon="folder"
                size="lg"
              )
      .row.items-center.q-gutter-md
        .col-4
          .row
            .col.q-pr-md
              .q-mt-sm {{ $t('setupPlot.utilized') }}
              q-input.bg-grey-3(
                dense
                input-class="setupPlotInput"
                outlined
                readonly
                suffix="GB"
                v-model="stats.utilizedGB"
              )
                q-tooltip.q-pa-sm
                  p {{ $t('setupPlot.utilizedSpace') }}
              .q-mt-sm {{ $t('setupPlot.available') }}
              q-input(
                :error="unsafeFree"
                dense
                hide-bottom-space
                input-class="setupPlotInput"
                outlined
                readonly
                suffix="GB"
                v-model="stats.freeGB"
              )
                q-tooltip.q-pa-sm
                  p {{ $t('setupPlot.availableSpace') }}
              .q-mt-sm {{ $t('setupPlot.allocated') }}
              // TODO: remove validation and restrict input to positive numbers when possible (Quasar component limitation)
              q-input(
                type="number"
                bg-color="blue-2"
                dense
                input-class="setupPlotInput"
                outlined
                suffix="GB"
                v-model.number="store.plotSizeGB"
                :rules="[val => val > 0 || $t('setupPlot.allocatedErrorMsg')]"
              )
                q-tooltip.q-pa-sm
                  p {{ $t('setupPlot.allocatedSpace') }}

        .col.q-pr-md
          .row.justify-center(
            style="transform: scale(-1, 1)"
          )
            apexchart(
              :options="chartOptions"
              :series="chartData"
              type="donut"
              width="200px"
            )
          .row.q-mt-md
            .col-1
            .col
              q-slider(
                :max="this.stats.safeAvailableGB"
                :min="1"
                :step="5"
                color="blue"
                snap
                style="height: 25px"
                v-model="store.plotSizeGB"
              )
            .col-1
  .row.justify-end.q-mt-sm.absolute-bottom.q-pb-md
    .col-auto.q-pr-md
      div {{ $t('setupPlot.hint') }}
    .col.q-pr-md
      div {{ $t('setupPlot.hint2') }}
    .col-expand
    .col-auto
      q-btn(
        :disable="(!validPath || store.plotSizeGB <= 0)"
        @click="confirmCreateDir()"
        color="blue-8"
        icon-right="downloading"
        :label="$t('setupPlot.start')"
        outline
        size="lg"
      )
      q-tooltip.q-pa-md(v-if="!validPath")
        p.q-mb-lg {{ $t('setupPlot.tooltip') }}
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { debounce } from "quasar"
import * as path from "@tauri-apps/api/path"
import * as fs from "@tauri-apps/api/fs"

import * as util from "../lib/util"
import { chartOptions, ChartDataType, StatsType } from "../lib/types"
import * as native from "../lib/native"
import { appData, appDataDialog } from "../lib/appData"
import mnemonicModal from "../components/mnemonicModal.vue"
import { useStore } from '../stores/store';

const tauri = { path, fs }

// TODO: implement error handling - Implement error pages for potential worst case scenarios #253 
// TODO: consider moving client, tauri and native methods elsewhere - use store methods instead
export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      revealKey: false,
      validPath: true,
      driveStats: <native.DriveStats>{ freeBytes: 0, totalBytes: 0 },
      chartOptions,
    }
  },
  computed: {
    chartData(): ChartDataType {
      return [
        this.stats.utilizedGB,
        this.stats.freeGB,
        // small hack to make chart look better, otherwise plot size is not visible
        this.store.plotSizeGB < 5 ? this.store.plotSizeGB + 5 : 
        this.store.plotSizeGB < 10 ? this.store.plotSizeGB + 3 : 
        this.store.plotSizeGB 
      ]
    },
    stats(): StatsType {
      const totalDiskSizeGB = util.toFixed(this.driveStats.totalBytes / 1e9, 2)
      // node will occupy AT MOST 10GB (safe margin), so deduct 10GB from safe space
      const safeAvailableGB = this.driveStats.freeBytes / 1e9 - 10
      const utilizedGB = util.toFixed(totalDiskSizeGB - safeAvailableGB, 2)
      const freeGB = ((): number => {
        const val = util.toFixed(safeAvailableGB - this.store.plotSizeGB, 2)
        if (val >= 0) {
          return val
        } else {
          return 0
        }
      })()

      return {
        totalDiskSizeGB,
        safeAvailableGB,
        utilizedGB,
        freeGB
      }
    },
    unsafeFree(): boolean {
      return this.stats.freeGB < 20
    }
  },
  watch: {
    "stats.freeGB"(val) {
      if (val < 0) {
        this.$nextTick(() => {
          this.stats.freeGB = 0
          console.log(this.stats.freeGB)
        })
      }
    },
    'store.plotSizeGB'(val) {
      // input component currently allows negative numbers as value, so we need to check
      if (val >= 0) {
        if (!this.stats?.safeAvailableGB) return
        if (val > this.stats?.safeAvailableGB) {
          this.$nextTick(() => {
            const size = parseFloat(this.stats?.safeAvailableGB.toFixed(0))
            this.store.setPlotSize(size);
          })
        } else {
          this.$nextTick(() => {
            const size = util.toFixed(this.store.plotSizeGB, 2)
            this.store.setPlotSize(size);
          })
        }
      } else {
        this.store.setPlotSize(0);
      }
    }
  },
  async mounted() {
    await this.updateDriveStats()
    const path = (await tauri.path.dataDir()) + util.appName;
    this.store.setPlotDir(path);
  },
  async created() {
    this.$watch(
      "store.plotDir",
      debounce((val): null => {
        if (val.length === 0) {
          this.validPath = false
        } else {
          // TODO: check if path is valid on any OS
          this.validPath = true
        }
        return null
      }, 500)
    )
  },
  methods: {
    async confirmCreateDir() {
      const dirExists = await native.dirExists(this.store.plotDir)

      if (dirExists) {
        util.infoLogger("SETUP PLOT | found the old plotting directory")
        const files = await tauri.fs
          .readDir(this.store.plotDir)
          .catch((error) => {
            util.errorLogger(error)
          })

        if (files) {
          console.log("FILES ARE: :", files)
          if (files.length === 0 || (files.length === 1 && files.some(item => item.name === "subspace-desktop.cfg"))){
            appDataDialog.existingDirectoryConfirm(
              this.store.plotDir,
              this.startPlotting
            )
          // we are in FIRST TIME START, meaning there is are no existing plot
          // if there are some files in this folder, it's weird
          } else {
            appDataDialog.notEmptyDirectoryInfo(this.store.plotDir)
          }
        }
      } else if (!dirExists) {
        appDataDialog.newDirectoryConfirm(
          this.store.plotDir,
          this.startPlotting
        )
      }
    },
    async startPlotting() {
      await appData.createCustomDataDir(this.store.plotDir)
      util.infoLogger("SETUP PLOT | custom directory created")
      await this.checkIdentity();
      await this.store.confirmPlottingSetup();
      this.$router.replace({ name: "plottingProgress" });
    },
    async updateDriveStats() {
      const stats = await native.driveStats(this.store.plotDir)
      util.infoLogger("Drive Stats -> free: " + stats.freeBytes + "; total: " + stats.totalBytes)
      this.driveStats = stats
    },
    async selectDir() {
      const result = await native
        .selectDir(this.store.plotDir)
        .catch((error: unknown) => {
          util.errorLogger(error)
        })
      if (result) {
        this.store.setPlotDir(result);
      }
      await this.updateDriveStats()
    },
    async checkIdentity() {
      if (this.store.rewardAddress === "") {
        util.infoLogger("SETUP PLOT | reward address was empty, creating a new one")
        try {
          const { rewardAddress, mnemonic }  = await this.$client.createRewardAddress();
          this.store.setRewardAddress(rewardAddress);
          await this.viewMnemonic(mnemonic);
        } catch (error) {
          util.errorLogger(error);
        }
      } else {
        util.infoLogger("SETUP PLOT | reward address was initialized before, proceeding to plotting")
      }
    },
    async viewMnemonic(mnemonic: string): Promise<void> {
      const modal = await util.showModal(mnemonicModal, { mnemonic });
      return new Promise((resolve) => {
        modal?.onDismiss(async () => {
          await this.store.confirmRewardAddress();
          resolve()
        })
      })
    }
  }
})
</script>

<style lang="sass">
.setupPlotInput
  font-size: 20px
  padding-top: 5px
  margin-top: 0px
</style>
