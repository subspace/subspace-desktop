import { boot } from 'quasar/wrappers'
import VueApexCharts from "vue3-apexcharts";
import { globalState } from "../lib/global"
import { Client } from "../lib/client"
import { createApi } from '../lib/util';
import { AutoLauncher } from "../lib/autoLauncher"
import { appConfig } from "../lib/appConfig";

import { interpret, Interpreter } from 'xstate';
import { createStateMachine, StateContext } from "../lib/state";

const LOCAL_RPC = process.env.LOCAL_API_WS || "ws://localhost:9947"

declare module "@vue/runtime-core" {
  export interface ComponentCustomProperties {
    $client: Client;
    $autoLauncher: AutoLauncher;
    $stateService: Interpreter<StateContext>;
  }
}

export default boot(async ({ app }) => {
  try {
    await appConfig.init()
    const { nodeName } = (await appConfig.read());
    globalState.setNodeName(nodeName);
    await globalState.loadLangData()
    const api = createApi(LOCAL_RPC);
    const client = new Client(api);
    const stateMachine = createStateMachine(client);
    const stateService = interpret(stateMachine);
    stateService
      .onTransition((state) => {
        // TODO: remove in prod
        console.log('state transition', state)
      })
      .start();
    const autoLauncher = new AutoLauncher();
    await autoLauncher.init();
    app.config.globalProperties.$stateService = stateService;
    app.config.globalProperties.$client = client;
    app.config.globalProperties.$autoLauncher = autoLauncher;
    app.use(VueApexCharts)
  } catch (error) {
    console.log('boot failed: ', error);
  }
})
