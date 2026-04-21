use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// Returns the URL rewritten for internal delivery, or an Err if the scheme
/// is explicitly blocked. Exposes the narrow pre-dispatch logic of
/// `fetch_url` so it can be exercised in isolation.
pub fn sanitize_url(url: &str) -> Result<String, String> {
    if url.starts_with("file://") {
        return Err("Unsupported URL scheme".to_string());
    }
    Ok(url.replace("169.254.169.254", "metadata"))
}

/// Fetch a URL, supporting http/https via reqwest and dict:// via raw TCP.
/// This is the intentionally vulnerable handler -- no scheme or host restrictions.
pub async fn fetch_url(url: &str) -> Result<String, String> {
    // Rewrite the link-local metadata IP to the internal Docker hostname.
    // Players submit 169.254.169.254 (the real AWS metadata address) but
    // Docker cannot route to link-local IPs across containers. The metadata
    // service is reachable by its Docker Compose service name instead.
    let url = sanitize_url(url)?;
    let url = url.as_str();

    if url.starts_with("dict://") {
        return fetch_dict(url).await;
    }

    // Default: use reqwest for http/https and anything else it supports
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    resp.text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))
}

/// Handle dict:// URLs by opening a raw TCP connection and sending the
/// path component as a Redis command.
///
/// Format: dict://<host>:<port>/<command>
/// Example: dict://redis:6379/GET veridian:flag3
async fn fetch_dict(url: &str) -> Result<String, String> {
    let without_scheme = url
        .strip_prefix("dict://")
        .ok_or("Invalid dict URL")?;

    // Split host:port from the command path
    let (host_port, command) = match without_scheme.find('/') {
        Some(idx) => (&without_scheme[..idx], &without_scheme[idx + 1..]),
        None => (without_scheme, ""),
    };

    let (host, port) = match host_port.rfind(':') {
        Some(idx) => (
            &host_port[..idx],
            host_port[idx + 1..]
                .parse::<u16>()
                .map_err(|_| "Invalid port in dict URL")?,
        ),
        None => (host_port, 2628), // default DICT port
    };

    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Connection to {} failed: {}", addr, e))?;

    // If there is a command, send it as a raw line
    if !command.is_empty() {
        let cmd_line = format!("{}\r\n", command);
        stream
            .write_all(cmd_line.as_bytes())
            .await
            .map_err(|e| format!("Failed to send command: {}", e))?;
    }

    // Send QUIT to close cleanly
    stream
        .write_all(b"QUIT\r\n")
        .await
        .map_err(|e| format!("Failed to send QUIT: {}", e))?;

    // Read the response with a timeout
    let mut buf = Vec::with_capacity(4096);
    let read_result = tokio::time::timeout(Duration::from_secs(3), async {
        let mut tmp = [0u8; 4096];
        loop {
            match stream.read(&mut tmp).await {
                Ok(0) => break,
                Ok(n) => buf.extend_from_slice(&tmp[..n]),
                Err(_) => break,
            }
            if buf.len() > 65536 {
                break;
            }
        }
    })
    .await;

    if read_result.is_err() {
        // Timeout is fine, we still have partial data
    }

    Ok(String::from_utf8_lossy(&buf).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_url_rejects_file_scheme() {
        assert!(sanitize_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn sanitize_url_rewrites_aws_metadata_ip() {
        let out = sanitize_url("http://169.254.169.254/latest/meta-data/").unwrap();
        assert_eq!(out, "http://metadata/latest/meta-data/");
    }

    #[test]
    fn sanitize_url_preserves_benign_urls() {
        assert_eq!(
            sanitize_url("https://example.com/index").unwrap(),
            "https://example.com/index"
        );
    }
}
