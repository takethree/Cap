const PUBLIC_SERVER_URL: &str = "https://cap.so";
const PUBLIC_BUNDLE_IDS: &str = "so.cap.desktop,so.cap.desktop.dev";

pub fn default_server_url() -> &'static str {
    configured_default_server_url(option_env!("CAP_DEFAULT_SERVER_URL"))
}

pub fn installer_base_url() -> &'static str {
    configured_installer_base_url(
        option_env!("CAP_INSTALLER_BASE_URL"),
        option_env!("CAP_DEFAULT_SERVER_URL"),
    )
}

pub fn desktop_bundle_ids() -> Vec<&'static str> {
    parse_desktop_bundle_ids(option_env!("CAP_DESKTOP_BUNDLE_IDS")).collect()
}

fn parse_desktop_bundle_ids(value: Option<&'static str>) -> impl Iterator<Item = &'static str> {
    value
        .filter(|value| !value.is_empty())
        .unwrap_or(PUBLIC_BUNDLE_IDS)
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn configured_default_server_url(value: Option<&'static str>) -> &'static str {
    value
        .filter(|value| !value.is_empty())
        .unwrap_or(PUBLIC_SERVER_URL)
}

fn configured_installer_base_url(
    installer_base_url: Option<&'static str>,
    default_server_url: Option<&'static str>,
) -> &'static str {
    installer_base_url
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| configured_default_server_url(default_server_url))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_server_uses_public_cap_when_unconfigured() {
        assert_eq!(configured_default_server_url(None), "https://cap.so");
        assert_eq!(configured_installer_base_url(None, None), "https://cap.so");
        assert_eq!(
            parse_desktop_bundle_ids(None).collect::<Vec<_>>(),
            ["so.cap.desktop", "so.cap.desktop.dev"]
        );
    }

    #[test]
    fn parses_configured_desktop_bundle_ids() {
        assert_eq!(
            configured_default_server_url(Some("https://cap.take3tech.dev")),
            "https://cap.take3tech.dev"
        );
        assert_eq!(
            configured_installer_base_url(
                Some("https://cap.take3tech.dev"),
                Some("https://unused.example")
            ),
            "https://cap.take3tech.dev"
        );
        assert_eq!(
            configured_installer_base_url(None, Some("https://cap.take3tech.dev")),
            "https://cap.take3tech.dev"
        );
        assert_eq!(
            parse_desktop_bundle_ids(Some(
                "so.cap.desktop.take3, so.cap.desktop, , so.cap.desktop.dev"
            ))
            .collect::<Vec<_>>(),
            [
                "so.cap.desktop.take3",
                "so.cap.desktop",
                "so.cap.desktop.dev"
            ]
        );
    }
}
