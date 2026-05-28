package com.finsight.portfolio.infrastructure.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Thin wrapper around Spring's JavaMailSender.
 *
 * Dev-mode behaviour (default):
 *   When {@code finsight.mail.dev-mode=true} (or when no SMTP host is configured),
 *   emails are logged to the console instead of being sent. This means:
 *     - No SMTP server required for local development
 *     - Alert logic can be fully exercised without real email delivery
 *
 * Production behaviour:
 *   Set {@code FINSIGHT_MAIL_DEV=false} and configure spring.mail.* properties
 *   (host, port, username, password) via environment variables.
 */
@Slf4j
@Service
public class EmailService {

    /** Injected only when spring.mail.host is configured (optional). */
    private final JavaMailSender mailSender;
    private final String         from;
    private final boolean        devMode;

    public EmailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${finsight.mail.from:noreply@finsight.io}") String from,
            @Value("${finsight.mail.dev-mode:true}") boolean devMode) {
        this.mailSender = mailSender;
        this.from       = from;
        this.devMode    = devMode;

        if (devMode || mailSender == null) {
            log.info("EmailService running in DEV MODE — emails will be logged, not sent");
        }
    }

    /**
     * Sends a plain-text email, or logs it when in dev mode.
     * Never throws — failures are logged as warnings so callers don't need try/catch.
     *
     * @param to      recipient email address
     * @param subject email subject line
     * @param body    plain-text body
     */
    public void send(String to, String subject, String body) {
        if (devMode || mailSender == null) {
            log.info("""
                    [EMAIL DEV MODE]
                    To:      {}
                    Subject: {}
                    Body:
                    {}
                    """, to, subject, body);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (Exception e) {
            // Alert emails are best-effort; never let a failed send crash the scheduler
            log.warn("Failed to send email to {} (subject='{}'): {}", to, subject, e.getMessage());
        }
    }
}
