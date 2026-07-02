//! Resolves the credentials `cap upload` needs without making an agent hunt for an API key.
//!
//! Priority: explicit `CAP_API_KEY`/`CAP_SERVER_URL` env vars (for CI/headless), then the login the
//! desktop app already stored. The CLI is the same product as Cap Desktop, so if the user is signed
//! in there, `cap upload` just works — no key to copy, no env var to set. The desktop persists its
//! auth as plain JSON via tauri-plugin-store, so we read it directly without any Tauri dependency.

use serde::Serialize;
use serde_json::Value;

use crate::{OutputFormat, distribution, write_json};

#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CredentialSource {
    /// CAP_API_KEY env var.
    Env,
    /// The login stored by Cap Desktop.
    Desktop,
    /// No credential found.
    None,
}

pub struct Credentials {
    pub api_key: String,
    pub server: String,
    pub source: CredentialSource,
    pub user_id: Option<String>,
}

fn load_desktop_store() -> Option<Value> {
    let data_dir = dirs::data_dir()?;
    distribution::desktop_bundle_ids()
        .into_iter()
        .find_map(|id| {
            let bytes = std::fs::read(data_dir.join(id).join("store")).ok()?;
            let store: Value = serde_json::from_slice(&bytes).ok()?;
            // Only accept a store that actually carries an auth secret.
            store
                .get("auth")
                .and_then(|auth| auth.get("secret"))
                .is_some()
                .then_some(store)
        })
}

fn store_api_key(store: &Value) -> Option<String> {
    let secret = store.get("auth")?.get("secret")?;
    // ApiKey { api_key } or Session { token } — both are sent as `Authorization: Bearer <value>`.
    secret
        .get("api_key")
        .or_else(|| secret.get("token"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn store_server(store: &Value) -> Option<String> {
    store
        .get("general_settings")?
        .get("serverUrl")?
        .as_str()
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_server(server: String) -> String {
    server.trim_end_matches('/').to_string()
}

fn env_var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

fn resolve_server_url(
    env_server: Option<String>,
    store_server: Option<String>,
    default_server: &str,
) -> String {
    normalize_server(
        env_server
            .or(store_server)
            .unwrap_or_else(|| default_server.to_string()),
    )
}

/// Resolve the upload credential and target server. Returns a clear, actionable error when neither an
/// env var nor a desktop login is available.
pub fn resolve() -> Result<Credentials, String> {
    let store = load_desktop_store();
    let server = resolve_server_url(
        env_var("CAP_SERVER_URL"),
        store.as_ref().and_then(store_server),
        distribution::default_server_url(),
    );

    if let Some(api_key) = env_var("CAP_API_KEY") {
        return Ok(Credentials {
            api_key,
            server,
            source: CredentialSource::Env,
            user_id: None,
        });
    }

    if let Some(store) = &store
        && let Some(api_key) = store_api_key(store)
    {
        let user_id = store
            .get("auth")
            .and_then(|auth| auth.get("user_id"))
            .and_then(Value::as_str)
            .map(str::to_string);
        return Ok(Credentials {
            api_key,
            server,
            source: CredentialSource::Desktop,
            user_id,
        });
    }

    Err(
        "Not signed in. Sign in to Cap Desktop (the CLI reuses its login), or set CAP_API_KEY to a \
         Cap auth key from Settings."
            .to_string(),
    )
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStatus {
    authenticated: bool,
    source: CredentialSource,
    server: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hint: Option<String>,
}

/// `cap auth status` — report whether a credential is available and where it came from, without ever
/// printing the secret. Lets an agent check before attempting an upload.
pub fn status(format: OutputFormat) -> Result<(), String> {
    let status = match resolve() {
        Ok(creds) => AuthStatus {
            authenticated: true,
            source: creds.source,
            server: creds.server,
            user_id: creds.user_id,
            hint: None,
        },
        Err(hint) => {
            let server = resolve_server_url(
                env_var("CAP_SERVER_URL"),
                load_desktop_store().as_ref().and_then(store_server),
                distribution::default_server_url(),
            );
            AuthStatus {
                authenticated: false,
                source: CredentialSource::None,
                server,
                user_id: None,
                hint: Some(hint),
            }
        }
    };

    match format {
        OutputFormat::Json => write_json(&status),
        OutputFormat::Text => {
            if status.authenticated {
                let source = match status.source {
                    CredentialSource::Env => "CAP_API_KEY env var",
                    CredentialSource::Desktop => "Cap Desktop login",
                    CredentialSource::None => "none",
                };
                println!("authenticated: yes (via {source})");
                println!("server: {}", status.server);
            } else {
                println!("authenticated: no");
                println!("server: {}", status.server);
                if let Some(hint) = &status.hint {
                    println!("{hint}");
                }
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_resolution_prefers_env_then_desktop_then_packaged_default() {
        assert_eq!(
            resolve_server_url(
                Some("https://env.example/".to_string()),
                Some("https://desktop.example".to_string()),
                "https://cap.take3tech.dev",
            ),
            "https://env.example"
        );
        assert_eq!(
            resolve_server_url(
                None,
                Some("https://desktop.example/".to_string()),
                "https://cap.take3tech.dev",
            ),
            "https://desktop.example"
        );
        assert_eq!(
            resolve_server_url(None, None, "https://cap.take3tech.dev"),
            "https://cap.take3tech.dev"
        );
    }

    #[test]
    fn store_server_reads_desktop_general_settings() {
        let store = serde_json::json!({
            "general_settings": {
                "serverUrl": "https://cap.take3tech.dev"
            }
        });

        assert_eq!(
            store_server(&store).as_deref(),
            Some("https://cap.take3tech.dev")
        );
    }
}
