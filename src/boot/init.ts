import { boot } from 'quasar/wrappers'
import VueApexCharts from "vue3-apexcharts";
import { globalState } from "../lib/global"
import client, { Client } from "../lib/client"
import { AutoLauncher } from "../lib/autoLauncher"
import { appConfig } from "../lib/appConfig";

declare module "@vue/runtime-core" {
  export interface ComponentCustomProperties {
    $client: Client;
    $autoLauncher: AutoLauncher;
  }
}

export default boot(async ({ app }) => {
  try {
    await appConfig.init()
    const { nodeName } = (await appConfig.read());
    globalState.setNodeName(nodeName);
    await globalState.loadLangData()
    const autoLauncher = new AutoLauncher();
    await autoLauncher.init();
    app.config.globalProperties.$client = client;
    app.config.globalProperties.$autoLauncher = autoLauncher;
    app.use(VueApexCharts)
  } catch (error) {
    console.log('boot failed: ', error);
  }
})
