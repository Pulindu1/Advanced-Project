package com.dunholm.service;

import com.dunholm.config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final JwtConfig cfg;
    private final ResourceLoader resourceLoader;

    private byte[] publicKeyPemBytes;
    private PublicKey publicKey;
    private PrivateKey privateKey;

    public JwtService(JwtConfig cfg, ResourceLoader resourceLoader) {
        this.cfg = cfg;
        this.resourceLoader = resourceLoader;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        loadPublicKey();
        loadPrivateKey();
    }

    private void loadPublicKey() throws Exception {
        Resource r = resourceLoader.getResource(cfg.getPublicKeyLocation());
        if (!r.exists()) {
            log.warn("JWT public key not found at {}", cfg.getPublicKeyLocation());
            return;
        }
        try (InputStream in = r.getInputStream()) {
            publicKeyPemBytes = in.readAllBytes();
        }
        byte[] der = decodePem(new String(publicKeyPemBytes, StandardCharsets.UTF_8));
        KeyFactory kf = KeyFactory.getInstance("RSA");
        publicKey = kf.generatePublic(new X509EncodedKeySpec(der));
    }

    private void loadPrivateKey() throws Exception {
        String pem = cfg.getPrivateKeyPem();
        if (pem == null || pem.isBlank()) {
            String loc = cfg.getPrivateKeyLocation();
            if (loc != null && !loc.isBlank()) {
                Resource r = resourceLoader.getResource(loc);
                if (r.exists()) {
                    try (InputStream in = r.getInputStream()) {
                        pem = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    }
                }
            }
        }
        if (pem == null || pem.isBlank()) {
            log.warn("JWT private key not provided; signing disabled");
            return;
        }
        byte[] der = decodePem(pem);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        privateKey = kf.generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private static byte[] decodePem(String pem) {
        String stripped = pem
            .replaceAll("-----BEGIN [A-Z ]+-----", "")
            .replaceAll("-----END [A-Z ]+-----", "")
            .replaceAll("\\s", "");
        return Decoders.BASE64.decode(stripped);
    }

    public String issue(String subject, Map<String, Object> extraClaims) {
        if (privateKey == null) {
            throw new IllegalStateException("JWT private key not configured");
        }
        long now = Instant.now().getEpochSecond();
        long exp = now + cfg.getExpiryMinutes() * 60L;
        return Jwts.builder()
            .subject(subject)
            .issuer(cfg.getIssuer())
            .issuedAt(new Date(now * 1000L))
            .expiration(new Date(exp * 1000L))
            .claims(extraClaims)
            .signWith(privateKey, Jwts.SIG.RS256)
            .compact();
    }

    public Claims verifyToken(String token) {
        if (!cfg.isTrustAlgorithmHeader()) {
            Jws<Claims> jws = Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token);
            return jws.getPayload();
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Malformed token");
        }
        String headerJson = new String(Decoders.BASE64URL.decode(parts[0]), StandardCharsets.UTF_8);
        String alg = extractAlg(headerJson);
        if (alg == null) {
            throw new IllegalArgumentException("Missing alg header");
        }
        if ("none".equalsIgnoreCase(alg)) {
            throw new IllegalArgumentException("alg=none is rejected");
        }
        if ("HS256".equalsIgnoreCase(alg)) {
            SecretKeySpec hmacKey = new SecretKeySpec(publicKeyPemBytes, "HmacSHA256");
            Jws<Claims> jws = Jwts.parser()
                .verifyWith(hmacKey)
                .build()
                .parseSignedClaims(token);
            return jws.getPayload();
        }
        if ("RS256".equalsIgnoreCase(alg)) {
            Jws<Claims> jws = Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token);
            return jws.getPayload();
        }
        throw new IllegalArgumentException("Unsupported alg: " + alg);
    }

    private static String extractAlg(String headerJson) {
        int i = headerJson.indexOf("\"alg\"");
        if (i < 0) return null;
        int colon = headerJson.indexOf(':', i);
        if (colon < 0) return null;
        int q1 = headerJson.indexOf('"', colon);
        if (q1 < 0) return null;
        int q2 = headerJson.indexOf('"', q1 + 1);
        if (q2 < 0) return null;
        return headerJson.substring(q1 + 1, q2);
    }

    public byte[] getPublicKeyPemBytes() { return publicKeyPemBytes; }
}
