package com.dunholm.service;

import com.dunholm.config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private static Path tempDir;
    private static byte[] publicPemBytes;
    private static PrivateKey privateKey;
    private static PublicKey publicKey;

    @BeforeAll
    static void setUpKeys() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        KeyPair kp = kpg.generateKeyPair();
        privateKey = kp.getPrivate();
        publicKey = kp.getPublic();

        String publicPem = "-----BEGIN PUBLIC KEY-----\n"
            + Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(publicKey.getEncoded())
            + "\n-----END PUBLIC KEY-----\n";
        String privatePem = "-----BEGIN PRIVATE KEY-----\n"
            + Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(privateKey.getEncoded())
            + "\n-----END PRIVATE KEY-----\n";
        publicPemBytes = publicPem.getBytes(StandardCharsets.UTF_8);

        tempDir = Files.createTempDirectory("jwt-test");
        Files.write(tempDir.resolve("public.pem"), publicPemBytes);
        Files.write(tempDir.resolve("private.pem"), privatePem.getBytes(StandardCharsets.UTF_8));
    }

    private JwtService buildService(boolean trustAlgorithmHeader) throws Exception {
        JwtConfig cfg = new JwtConfig() {
            @Override public String getPublicKeyLocation() { return "file:" + tempDir.resolve("public.pem"); }
            @Override public String getPrivateKeyLocation() { return "file:" + tempDir.resolve("private.pem"); }
            @Override public String getPrivateKeyPem() { return ""; }
            @Override public String getIssuer() { return "test"; }
            @Override public String getCookieName() { return "trialvault_token"; }
            @Override public long getExpiryMinutes() { return 60; }
            @Override public boolean isTrustAlgorithmHeader() { return trustAlgorithmHeader; }
        };
        JwtService svc = new JwtService(cfg, new DefaultResourceLoader());
        svc.afterPropertiesSet();
        return svc;
    }

    @Test
    void legitimate_rs256_token_verifies_when_alg_header_trusted() throws Exception {
        JwtService svc = buildService(true);
        String token = svc.issue("abcd12", Map.of("username", "abcd12", "role", "researcher"));
        Claims claims = svc.verifyToken(token);
        assertEquals("abcd12", claims.getSubject());
        assertEquals("researcher", claims.get("role"));
    }

    @Test
    void hs256_forged_token_with_public_pem_as_secret_verifies() throws Exception {
        JwtService svc = buildService(true);
        SecretKeySpec hmacKey = new SecretKeySpec(publicPemBytes, "HmacSHA256");
        long now = System.currentTimeMillis();
        String forged = Jwts.builder()
            .subject("abcd12")
            .issuer("test")
            .issuedAt(new Date(now))
            .expiration(new Date(now + 3_600_000L))
            .claims(Map.of("username", "abcd12", "role", "cto_admin"))
            .signWith(hmacKey, Jwts.SIG.HS256)
            .compact();
        Claims claims = svc.verifyToken(forged);
        assertEquals("cto_admin", claims.get("role"));
    }

    @Test
    void alg_none_is_rejected_even_when_header_trusted() throws Exception {
        JwtService svc = buildService(true);
        String header = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"sub\":\"abcd12\",\"role\":\"cto_admin\"}".getBytes(StandardCharsets.UTF_8));
        String unsigned = header + "." + payload + ".";

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> svc.verifyToken(unsigned)
        );
        assertTrue(ex.getMessage().toLowerCase().contains("none"));
    }

    @Test
    void alg_header_ignored_when_trust_flag_off() throws Exception {
        JwtService svc = buildService(false);
        SecretKeySpec hmacKey = new SecretKeySpec(publicPemBytes, "HmacSHA256");
        long now = System.currentTimeMillis();
        String forged = Jwts.builder()
            .subject("abcd12")
            .issuer("test")
            .issuedAt(new Date(now))
            .expiration(new Date(now + 3_600_000L))
            .claims(Map.of("role", "cto_admin"))
            .signWith(hmacKey, Jwts.SIG.HS256)
            .compact();

        assertThrows(Exception.class, () -> svc.verifyToken(forged));
    }
}
