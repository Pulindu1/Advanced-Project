package com.dunholm.service;

import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.io.Decoders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;

@Service
public class VaultEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(VaultEncryptionService.class);

    private final ResourceLoader resourceLoader;

    @Value("${doc.public-key-location}")
    private String docPublicKeyLocation;

    @Value("${file.vault-path}")
    private String vaultPath;

    @Value("${app.config.dunholm-handoff-a:DR_KEY_PART1_PLACEHOLDER}")
    private String drApiKeyPart1;

    @Value("${app.vault.shared-part2:dr-part2-7f1a9c5e3b8d4a6f}")
    private String sharedPart2;

    public VaultEncryptionService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public void generatePerUserVaults(JsonNode flagsNode) {
        if (flagsNode == null) {
            log.warn("No flags provided; skipping vault generation");
            return;
        }
        PublicKey docPublic;
        try {
            docPublic = loadDocPublicKey();
        } catch (Exception e) {
            log.error("Cannot load doc public key for vault generation: {}", e.getMessage());
            return;
        }
        Path vaultDir = Path.of(vaultPath);
        try {
            Files.createDirectories(vaultDir);
        } catch (Exception e) {
            log.warn("Could not ensure vault directory {}: {}", vaultDir, e.getMessage());
        }

        byte[] aesKey = deriveAesKey();
        int emitted = 0;
        Iterator<Map.Entry<String, JsonNode>> it = flagsNode.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String username = e.getKey();
            JsonNode f = e.getValue();
            String flag5 = f.path("flag5").asText("");
            String plaintext = buildNarrativePlaintext(username, flag5);
            try {
                byte[] iv = new byte[12];
                new SecureRandom().nextBytes(iv);
                Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
                SecretKey sk = new SecretKeySpec(aesKey, "AES");
                aes.init(Cipher.ENCRYPT_MODE, sk, new GCMParameterSpec(128, iv));
                byte[] ct = aes.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

                Cipher rsa = Cipher.getInstance("RSA/ECB/PKCS1Padding");
                rsa.init(Cipher.ENCRYPT_MODE, docPublic);
                byte[] wrappedKey = rsa.doFinal(aesKey);

                String blob = renderEnvelope(username, wrappedKey, iv, ct);
                Path out = vaultDir.resolve("classified-trial-results-" + username + ".enc");
                Files.writeString(out, blob, StandardCharsets.UTF_8);
                emitted++;
            } catch (Exception ex) {
                log.warn("Vault encryption failed for {}: {}", username, ex.getMessage());
            }
        }
        log.info("Emitted {} per-user vault files at {}", emitted, vaultDir);
    }

    private byte[] deriveAesKey() {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest((drApiKeyPart1 + sharedPart2).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private PublicKey loadDocPublicKey() throws Exception {
        Resource r = resourceLoader.getResource(docPublicKeyLocation);
        if (!r.exists()) {
            throw new IllegalStateException("doc public key not found at " + docPublicKeyLocation);
        }
        byte[] pemBytes;
        try (InputStream in = r.getInputStream()) {
            pemBytes = in.readAllBytes();
        }
        String stripped = new String(pemBytes, StandardCharsets.UTF_8)
            .replaceAll("-----BEGIN [A-Z ]+-----", "")
            .replaceAll("-----END [A-Z ]+-----", "")
            .replaceAll("\\s", "");
        byte[] der = Decoders.BASE64.decode(stripped);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePublic(new X509EncodedKeySpec(der));
    }

    private String buildNarrativePlaintext(String username, String flag5) {
        return String.join("\n",
            "DUNHOLM RESEARCH, TRIALVAULT CLASSIFIED RELEASE",
            "Release reference: DR-INC-2024-003",
            "Classification: RESTRICTED (Board and Security Lead only)",
            "Audience: external auditor " + username,
            "",
            "Phase 2 dossier for DR-2024-017 (NIMMOD-2)",
            "The following notes were assembled by the security sub-committee after",
            "confirming that the competitor disclosure matched sections of this dossier",
            "verbatim. The full stolen package is thirty-two pages of safety monitoring,",
            "biomarker panels, and the draft MHRA response. The abstract is preserved",
            "here so the board has a single reference during the formal investigation.",
            "",
            "Flag (audit receipt): " + flag5,
            "",
            "Access timeline:",
            "Coordination via TrialVault internal messaging. See system logs for access",
            "timeline. The logs are served by the management endpoint already in scope",
            "for this audit.",
            "",
            "Next steps for the auditor:",
            "1. Record this flag in the audit worksheet.",
            "2. Review the log file named trialvault.log for the access trail preceding",
            "   the competitor disclosure.",
            "3. Present the findings to the incident review board.",
            ""
        );
    }

    private String renderEnvelope(String username, byte[] wrappedKey, byte[] iv, byte[] ct) {
        StringBuilder sb = new StringBuilder();
        sb.append("# DUNHOLM RESEARCH TRIALVAULT, classified release envelope\n");
        sb.append("# Audience: ").append(username).append("\n");
        sb.append("# Scheme: RSA-512 + AES-256-GCM hybrid\n");
        sb.append("# The RSA-wrapped key, IV, and ciphertext follow. Base64.\n");
        sb.append("\n");
        sb.append("[ALG] hybrid: rsa-512/pkcs1v15 wraps aes-256-gcm\n");
        sb.append("[WRAPPED_KEY_B64] ").append(Base64.getEncoder().encodeToString(wrappedKey)).append("\n");
        sb.append("[IV_B64] ").append(Base64.getEncoder().encodeToString(iv)).append("\n");
        sb.append("[CIPHERTEXT_B64] ").append(Base64.getEncoder().encodeToString(ct)).append("\n");
        sb.append("\n# To decrypt:\n");
        sb.append("# 1. Factor n from doc-public.pem into p, q (try factordb.com first).\n");
        sb.append("# 2. Recover d = e^-1 mod (p-1)(q-1), unwrap the AES key.\n");
        sb.append("# 3. Alternatively: the AES key = SHA-256(DR_API_KEY_PART1 || encryption_key_part2).\n");
        sb.append("#    Use whichever path is available; both converge on the same key.\n");
        return sb.toString();
    }
}
