use anyhow::{anyhow, Result};
use log::info;
use std::path::PathBuf;
use subspace_core_primitives::PublicKey;
use subspace_farmer::multi_farming::{MultiFarming, Options as MultiFarmingOptions};
use subspace_farmer::{Identity, NodeRpcClient, ObjectMappings, Plot, RpcClient};
use tokio::sync::mpsc::Sender;

/// Start farming by using plot in specified path and connecting to WebSocket server at specified
/// address.
pub(crate) async fn farm(
    base_directory: PathBuf,
    node_rpc_url: &str,
    reward_address: Option<PublicKey>,
    plot_size: u64,
    error_sender: Sender<()>,
) -> Result<(), anyhow::Error> {
    raise_fd_limit();
    let reward_address = if let Some(reward_address) = reward_address {
        reward_address
    } else {
        let identity = Identity::open_or_create(&base_directory)?;
        identity.public_key().to_bytes().into()
    };

    info!("Connecting to node at {}", node_rpc_url);
    let client = NodeRpcClient::new(node_rpc_url).await?;

    let metadata = client
        .farmer_metadata()
        .await
        .map_err(|error| anyhow!(error))?;

    let max_plot_size = metadata.max_plot_size;

    info!("Opening object mapping");
    let object_mappings = tokio::task::spawn_blocking({
        let base_directory = base_directory.clone();

        move || ObjectMappings::open_or_create(&base_directory)
    })
    .await??;

    let multi_farming = MultiFarming::new(
        MultiFarmingOptions {
            base_directory: base_directory.clone(),
            client,
            object_mappings: object_mappings.clone(),
            reward_address,
            bootstrap_nodes: vec![],
            listen_on: vec![],
        },
        plot_size,
        max_plot_size,
        move |plot_index, public_key, max_piece_count| {
            Plot::open_or_create(
                base_directory.join(format!("plot{plot_index}")),
                public_key,
                max_piece_count,
            )
        },
        true,
    )
    .await?;

    tokio::spawn(async move {
        let result = multi_farming.wait().await;
        match result {
            Err(error) => {
                log::error!("{error}");
                error_sender.send(()).await.unwrap() // this send should always be successful
            }
            Ok(_) => unreachable!("wait function should not return Ok()"),
        }
    });

    Ok(())
}

pub(crate) fn parse_reward_address(s: &str) -> Result<PublicKey, sp_core::crypto::PublicError> {
    s.parse::<sp_core::sr25519::Public>()
        .map(|key| PublicKey::from(key.0))
}

pub(crate) fn raise_fd_limit() {
    match std::panic::catch_unwind(fdlimit::raise_fd_limit) {
        Ok(Some(limit)) => {
            log::info!("Increase file limit from soft to hard (limit is {limit})")
        }
        Ok(None) => log::debug!("Failed to increase file limit"),
        Err(err) => {
            let err = if let Some(err) = err.downcast_ref::<&str>() {
                *err
            } else if let Some(err) = err.downcast_ref::<String>() {
                err
            } else {
                unreachable!("Should be unreachable as `fdlimit` uses panic macro, which should return either `&str` or `String`.")
            };
            log::warn!("Failed to increase file limit: {err}")
        }
    }
}
