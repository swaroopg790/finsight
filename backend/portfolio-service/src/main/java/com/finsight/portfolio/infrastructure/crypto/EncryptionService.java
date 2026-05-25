package com.finsight.portfolio.infrastructure.crypto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM symmetric encryption for sensitive values (Plaid access tokens).
 *
 * Output format: Base64( IV[12 bytes] || Ciphertext+AuthTag )
 *
 * The key is derived via SHA-256 so any-length env var string produces a valid 32-byte key.
 * In production, rotate FINSIGHT_ENCRYPTION_KEY and re-encrypt stored tokens.
 */
@Service
public class EncryptionService {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH  = 12;   // 96-bit IV — recommended for GCM
    private static final int GCM_TAG_LENGTH = 128;  // bits

    private final SecretKeySpec secretKey;
    private final SecureRandom  secureRandom = new SecureRandom();

    public EncryptionService(@Value("${finsight.encryption.key}") String keyString) {
        try {
            // SHA-256 guarantees exactly 32 bytes regardless of input length
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(keyString.getBytes(StandardCharsets.UTF_8));
            this.secretKey = new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialise EncryptionService", e);
        }
    }

    /** Encrypts plaintext and returns a Base64-encoded blob safe to store in the DB. */
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Prepend IV so we can recover it during decryption
            byte[] combined = new byte[GCM_IV_LENGTH + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, GCM_IV_LENGTH);
            System.arraycopy(ciphertext, 0, combined, GCM_IV_LENGTH, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    /** Decrypts a blob produced by {@link #encrypt(String)}. */
    public String decrypt(String encryptedBase64) {
        try {
            byte[] combined    = Base64.getDecoder().decode(encryptedBase64);
            byte[] iv          = Arrays.copyOfRange(combined, 0, GCM_IV_LENGTH);
            byte[] ciphertext  = Arrays.copyOfRange(combined, GCM_IV_LENGTH, combined.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed — key mismatch or corrupted data", e);
        }
    }
}
