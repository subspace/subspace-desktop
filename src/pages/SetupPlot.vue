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
            v-model="plotDirectory"
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
                v-model.number="allocatedGB"
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
                v-model="allocatedGB"
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
        :disable="(!validPath || allocatedGB <= 0)"
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
import { globalState as global } from "../lib/global"
import { appConfig } from "../lib/appConfig"
import { appData, appDataDialog } from "../lib/appData"
import mnemonicModal from "../components/mnemonicModal.vue"

const tauri = { path, fs }

// TODO: implement error handling - Implement error pages for potential worst case scenarios #253 
export default defineComponent({
  data() {
    return {
      revealKey: false,
      plotDirectory: "/",
      allocatedGB: 1,
      validPath: true,
      defaultPath: "/",
      driveStats: <native.DriveStats>{ freeBytes: 0, totalBytes: 0 },
      chartOptions,
      rewardAddress: ""
    }
  },
  computed: {
    chartData(): ChartDataType {
      return [
        this.stats.utilizedGB,
        this.stats.freeGB,
        this.allocatedGB,
      ]
    },
    stats(): StatsType {
      const totalDiskSizeGB = util.toFixed(this.driveStats.totalBytes / 1e9, 2)
      // node will occupy AT MOST 10GB (safe margin), so deduct 10GB from safe space
      const safeAvailableGB = this.driveStats.freeBytes / 1e9 - 10
      const utilizedGB = util.toFixed(totalDiskSizeGB - safeAvailableGB, 2)
      const freeGB = ((): number => {
        const val = util.toFixed(safeAvailableGB - this.allocatedGB, 2)
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
    allocatedGB(val) {
      // input component currently allows negative numbers as value, so we need to check
      if (val >= 0) {
        if (!this.stats?.safeAvailableGB) return
        if (val > this.stats?.safeAvailableGB) {
          this.$nextTick(() => {
            this.allocatedGB = parseFloat(this.stats?.safeAvailableGB.toFixed(0))
          })
        } else {
          this.$nextTick(() => {
            this.allocatedGB = util.toFixed(this.allocatedGB, 2)
          })
        }
      } else {
        this.allocatedGB = 0;
      }
    }
  },
  async mounted() {
    await this.updateDriveStats()
    this.defaultPath = (await tauri.path.dataDir()) + util.appName
    this.plotDirectory = this.defaultPath
  },
  async created() {
    this.$watch(
      "plotDirectory",
      debounce((val): null => {
        if (val.length === 0) {
          this.validPath = false
        } else {
          if (this.plotDirectory == this.defaultPath) {
            this.validPath = true
          } else {
            // TODO: check if path is valid on any OS
            this.validPath = true
          }
        }
        return null
      }, 500)
    )
  },
  methods: {
    async confirmCreateDir() {
      const dirExists = await native.dirExists(this.plotDirectory)

      if (dirExists) {
        util.infoLogger("SETUP PLOT | found the old plotting directory")
        const files = await tauri.fs
          .readDir(this.plotDirectory)
          .catch((error) => {
            util.errorLogger(error)
          })

        if (files) {
          console.log("FILES ARE: :", files)
          if (files.length === 0 || (files.length === 1 && files.some(item => item.name === "subspace-desktop.cfg"))){
            appDataDialog.existingDirectoryConfirm(
              this.plotDirectory,
              this.prepareForPlotting
            )
          // we are in FIRST TIME START, meaning there is are no existing plot
          // if there are some files in this folder, it's weird
          } else {
            appDataDialog.notEmptyDirectoryInfo(this.plotDirectory)
          }
        }
      } else if (!dirExists) {
        appDataDialog.newDirectoryConfirm(
          this.plotDirectory,
          this.prepareForPlotting
        )
      }
    },
    async prepareForPlotting() {
      if (this.plotDirectory.charAt(this.plotDirectory.length - 1) == "/")
        this.plotDirectory.slice(-1)
      await appData.createCustomDataDir(this.plotDirectory)
      util.infoLogger("SETUP PLOT | custom directory created")
      await this.checkIdentity()
      const nodeName = util.generateNodeName()
      global.setNodeName(nodeName);

      await appConfig.update({
          plot: { location: this.plotDirectory, sizeGB: this.allocatedGB },
          nodeName,
        })
      this.$router.replace({ name: "plottingProgress" })
    },
    async updateDriveStats() {
      const stats = await native.driveStats(this.plotDirectory)
      util.infoLogger("Drive Stats -> free: " + stats.freeBytes + "; total: " + stats.totalBytes)
      this.driveStats = stats
    },
    async selectDir() {
      const result = await native
        .selectDir(this.plotDirectory)
        .catch((error: unknown) => {
          util.errorLogger(error)
        })
      if (result) this.plotDirectory = result
      await this.updateDriveStats()
    },
    async checkIdentity() {
      const config = await appConfig.read()
      if (config.rewardAddress === "") {
        util.infoLogger("SETUP PLOT | reward address was empty, creating a new one")
        try {
          const { rewardAddress, mnemonic }  = await this.$client.createRewardAddress();
          this.rewardAddress = rewardAddress;
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
          await appConfig.update({
            rewardAddress: this.rewardAddress
          })
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
