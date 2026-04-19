package com.dunholm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {

    @Value("${jwt.public-key-location}")
    private String publicKeyLocation;

    @Value("${jwt.private-key-pem:}")
    private String privateKeyPem;

    @Value("${jwt.private-key-location:}")
    private String privateKeyLocation;

    @Value("${jwt.issuer}")
    private String issuer;

    @Value("${jwt.cookie-name}")
    private String cookieName;

    @Value("${jwt.expiry-minutes}")
    private long expiryMinutes;

    @Value("${jwt.verification.trust-algorithm-header:false}")
    private boolean trustAlgorithmHeader;

    public String getPublicKeyLocation() { return publicKeyLocation; }
    public String getPrivateKeyPem() { return privateKeyPem; }
    public String getPrivateKeyLocation() { return privateKeyLocation; }
    public String getIssuer() { return issuer; }
    public String getCookieName() { return cookieName; }
    public long getExpiryMinutes() { return expiryMinutes; }
    public boolean isTrustAlgorithmHeader() { return trustAlgorithmHeader; }
}
