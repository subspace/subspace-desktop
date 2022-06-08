use anyhow::Result;
use cirrus_runtime::GenesisConfig as ExecutionGenesisConfig;
use log::{error, warn};
use sc_chain_spec::ChainSpec;
use sc_executor::{NativeExecutionDispatch, WasmExecutionMethod, WasmtimeInstantiationStrategy};
use sc_network::config::{NodeKeyConfig, Secret};
use sc_service::config::{
    ExecutionStrategies, ExecutionStrategy, KeystoreConfig, NetworkConfiguration,
    OffchainWorkerConfig,
};
use sc_service::{
    BasePath, Configuration, DatabaseSource, KeepBlocks, PruningMode, Role, RpcMethods,
    TracingReceiver,
};
use sc_subspace_chain_specs::ConsensusChainSpec;
use sp_core::crypto::Ss58AddressFormat;
use std::env;
use std::path::PathBuf;
use std::sync::Once;
use subspace_runtime::GenesisConfig as ConsensusGenesisConfig;
use subspace_service::{FullClient, NewFull, SubspaceConfiguration};
use tokio::{runtime::Handle, sync::Mutex, task::JoinHandle};

static INITIALIZE_SUBSTRATE: Once = Once::new();

/// The maximum number of characters for a node name.

/// Default sub directory to store network config.
const DEFAULT_NETWORK_CONFIG_PATH: &str = "network";

/// The file name of the node's Ed25519 secret key inside the chain-specific
/// network config directory.
const NODE_KEY_ED25519_FILE: &str = "secret_ed25519";

/// The recommended open file descriptor limit to be configured for the process.
const RECOMMENDED_OPEN_FILE_DESCRIPTOR_LIMIT: u64 = 10_000;

pub(crate) struct ExecutorDispatch;

impl NativeExecutionDispatch for ExecutorDispatch {
    type ExtendHostFunctions = ();

    fn dispatch(method: &str, data: &[u8]) -> Option<Vec<u8>> {
        subspace_runtime::api::dispatch(method, data)
    }

    fn native_version() -> sc_executor::NativeVersion {
        subspace_runtime::native_version()
    }
}

#[tauri::command]
pub(crate) async fn start_node(path: String, node_name: String) {
    static NODE_HANDLE: Mutex<Option<JoinHandle<()>>> = Mutex::const_new(None);

    let mut node_handle_guard = NODE_HANDLE.lock().await;
    // if there is already a node running, stop it
    if let Some(guard) = node_handle_guard.take() {
        guard.abort();
        loop {
            if guard.is_finished() {
                break;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    // start the new node, and store its handle
    *node_handle_guard = Some(init_node(path.into(), node_name).await.unwrap());
}

async fn init_node(base_directory: PathBuf, node_name: String) -> Result<JoinHandle<()>> {
    let chain_spec: ConsensusChainSpec<ConsensusGenesisConfig, ExecutionGenesisConfig> =
        ConsensusChainSpec::from_json_bytes(include_bytes!("../chain-spec.json").as_ref())
            .map_err(anyhow::Error::msg)?;

    let full_client_fut = tokio::task::spawn_blocking(move || {
        Handle::current().block_on(create_full_client(chain_spec, base_directory, node_name))
    });
    let mut full_client = full_client_fut.await??;

    full_client.network_starter.start_network();

    let node_handle = tokio::spawn(async move {
        if let Err(error) = full_client.task_manager.future().await {
            error!("Task manager exited with error: {error}");
        } else {
            error!("Task manager exited without error");
        }
    });

    Ok(full_client.task_manager)
}

// TODO: Allow customization of a bunch of these things
async fn create_full_client<CS: ChainSpec + 'static>(
    chain_spec: CS,
    base_path: PathBuf,
    node_name: String,
) -> Result<NewFull<FullClient<subspace_runtime::RuntimeApi, ExecutorDispatch>>> {
    // This must only be initialized once
    INITIALIZE_SUBSTRATE.call_once(|| {
        dotenv::dotenv().ok();

        set_default_ss58_version(&chain_spec);

        sp_panic_handler::set(
            "https://discord.gg/vhKF9w3x",
            env!("SUBSTRATE_CLI_IMPL_VERSION"),
        );

        if let Some(new_limit) = fdlimit::raise_fd_limit() {
            if new_limit < RECOMMENDED_OPEN_FILE_DESCRIPTOR_LIMIT {
                warn!(
                    "Low open file descriptor limit configured for the process. \
                    Current value: {:?}, recommended value: {:?}.",
                    new_limit, RECOMMENDED_OPEN_FILE_DESCRIPTOR_LIMIT,
                );
            }
        }
    });

    let config = create_configuration(
        BasePath::Permanenent(base_path),
        chain_spec,
        Handle::current(),
        node_name,
    )?;

    subspace_service::new_full::<subspace_runtime::RuntimeApi, ExecutorDispatch>(config, true)
        .map_err(Into::into)
}

fn set_default_ss58_version<CS: ChainSpec>(chain_spec: &CS) {
    let maybe_ss58_address_format = chain_spec
        .properties()
        .get("ss58Format")
        .map(|v| {
            v.as_u64()
                .expect("ss58Format must always be an unsigned number; qed")
        })
        .map(|v| {
            v.try_into()
                .expect("ss58Format must always be within u16 range; qed")
        })
        .map(Ss58AddressFormat::custom);

    if let Some(ss58_address_format) = maybe_ss58_address_format {
        sp_core::crypto::set_default_ss58_version(ss58_address_format);
    }
}

/// Create a Configuration object for the node
fn create_configuration<CS: ChainSpec + 'static>(
    base_path: BasePath,
    chain_spec: CS,
    tokio_handle: tokio::runtime::Handle,
    node_name: String,
) -> Result<SubspaceConfiguration> {
    let impl_name = "Subspace-desktop".to_string();
    let impl_version = env!("SUBSTRATE_CLI_IMPL_VERSION").to_string();
    let config_dir = base_path.config_dir(chain_spec.id());
    let net_config_dir = config_dir.join(DEFAULT_NETWORK_CONFIG_PATH);
    let client_id = format!("{}/v{}", impl_name, impl_version);
    let mut network = NetworkConfiguration::new(
        node_name,
        client_id,
        NodeKeyConfig::Ed25519(Secret::File(net_config_dir.join(NODE_KEY_ED25519_FILE))),
        Some(net_config_dir),
    );
    network.listen_addresses = vec![
        "/ip6/::/tcp/30333".parse().expect("Multiaddr is correct"),
        "/ip4/0.0.0.0/tcp/30333"
            .parse()
            .expect("Multiaddr is correct"),
    ];
    network.boot_nodes = chain_spec.boot_nodes().to_vec();

    // Full + Light clients
    network.default_peers_set.in_peers = 25 + 100;
    let role = Role::Authority;
    let (keystore_remote, keystore) = (None, KeystoreConfig::InMemory);
    let telemetry_endpoints = chain_spec.telemetry_endpoints().clone();

    // Default value are used for many of parameters
    Ok(SubspaceConfiguration {
        base: Configuration {
            impl_name,
            impl_version,
            tokio_handle,
            transaction_pool: Default::default(),
            network,
            keystore_remote,
            keystore,
            database: DatabaseSource::ParityDb {
                path: config_dir.join("paritydb").join("full"),
            },
            state_cache_size: 67_108_864,
            state_cache_child_ratio: None,
            // TODO: Change to constrained eventually (need DSN for this)
            state_pruning: Some(PruningMode::keep_blocks(1024)),
            keep_blocks: KeepBlocks::Some(1024),
            wasm_method: WasmExecutionMethod::Compiled {
                instantiation_strategy: WasmtimeInstantiationStrategy::PoolingCopyOnWrite,
            },
            wasm_runtime_overrides: None,
            execution_strategies: ExecutionStrategies {
                syncing: ExecutionStrategy::AlwaysWasm,
                importing: ExecutionStrategy::AlwaysWasm,
                block_construction: ExecutionStrategy::AlwaysWasm,
                offchain_worker: ExecutionStrategy::AlwaysWasm,
                other: ExecutionStrategy::AlwaysWasm,
            },
            rpc_http: None,
            rpc_ws: Some("127.0.0.1:9947".parse().expect("IP and port are valid")),
            rpc_ipc: None,
            // necessary in order to use `peers` method to show number of node peers during sync
            rpc_methods: RpcMethods::Unsafe,
            rpc_ws_max_connections: Default::default(),
            // Below CORS are default from Substrate
            rpc_cors: Some(vec![
                "http://localhost:*".to_string(),
                "http://127.0.0.1:*".to_string(),
                "https://localhost:*".to_string(),
                "https://127.0.0.1:*".to_string(),
                "https://polkadot.js.org".to_string(),
                "tauri://localhost".to_string(),
                "https://tauri.localhost".to_string(),
                "http://localhost:3009".to_string(),
            ]),
            rpc_max_payload: None,
            rpc_max_request_size: None,
            rpc_max_response_size: None,
            rpc_id_provider: None,
            ws_max_out_buffer_capacity: None,
            prometheus_config: None,
            telemetry_endpoints,
            default_heap_pages: None,
            offchain_worker: OffchainWorkerConfig::default(),
            force_authoring: env::var("FORCE_AUTHORING")
                .map(|force_authoring| force_authoring.as_str() == "1")
                .unwrap_or_default(),
            disable_grandpa: false,
            dev_key_seed: None,
            tracing_targets: None,
            tracing_receiver: TracingReceiver::Log,
            chain_spec: Box::new(chain_spec),
            max_runtime_instances: 8,
            announce_block: true,
            role,
            base_path: Some(base_path),
            informant_output_format: Default::default(),
            runtime_cache_size: 2,
            rpc_max_subs_per_conn: None,
        },
        force_new_slot_notifications: false,
    })
}
