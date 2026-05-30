package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.domain.model.SpendingCategory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Classifies bank transactions into {@link SpendingCategory} buckets.
 *
 * <p>Classification priority (highest to lowest):
 * <ol>
 *   <li>Plaid category path — maps well-known Plaid primary/secondary categories</li>
 *   <li>Merchant name keywords — covers common merchants not caught by Plaid categories</li>
 * </ol>
 *
 * <p>Designed to be deterministic and free of external calls — runs inline at sync time.
 */
@Slf4j
@Service
public class TransactionCategorizationService {

    // ── Plaid category → SpendingCategory mappings ───────────────────────────

    /** First-pass: map Plaid primary categories (first element of the category list). */
    private static final Map<String, SpendingCategory> PLAID_PRIMARY = Map.of(
            "payroll",       SpendingCategory.INCOME,
            "income",        SpendingCategory.INCOME,
            "transfer",      SpendingCategory.TRANSFER,
            "payment",       SpendingCategory.TRANSFER,
            "medical",       SpendingCategory.HEALTHCARE
    );

    /** Second-pass: substring match on any element of the Plaid category list (lower-cased). */
    private static final Map<String, SpendingCategory> PLAID_SUBSTRING = Map.ofEntries(
            Map.entry("groceries",       SpendingCategory.GROCERIES),
            Map.entry("supermarket",     SpendingCategory.GROCERIES),
            Map.entry("restaurant",      SpendingCategory.DINING),
            Map.entry("coffee",          SpendingCategory.DINING),
            Map.entry("fast food",       SpendingCategory.DINING),
            Map.entry("food delivery",   SpendingCategory.DINING),
            Map.entry("dining",          SpendingCategory.DINING),
            Map.entry("subscription",    SpendingCategory.SUBSCRIPTIONS),
            Map.entry("streaming",       SpendingCategory.SUBSCRIPTIONS),
            Map.entry("music",           SpendingCategory.SUBSCRIPTIONS),
            Map.entry("software",        SpendingCategory.SUBSCRIPTIONS),
            Map.entry("electric",        SpendingCategory.UTILITIES),
            Map.entry("utilities",       SpendingCategory.UTILITIES),
            Map.entry("phone",           SpendingCategory.UTILITIES),
            Map.entry("internet",        SpendingCategory.UTILITIES),
            Map.entry("gas station",     SpendingCategory.TRANSPORT),
            Map.entry("rideshare",       SpendingCategory.TRANSPORT),
            Map.entry("taxi",            SpendingCategory.TRANSPORT),
            Map.entry("transit",         SpendingCategory.TRANSPORT),
            Map.entry("parking",         SpendingCategory.TRANSPORT),
            Map.entry("entertainment",   SpendingCategory.ENTERTAINMENT),
            Map.entry("sport",           SpendingCategory.ENTERTAINMENT),
            Map.entry("pharmacies",      SpendingCategory.HEALTHCARE),
            Map.entry("pharmacy",        SpendingCategory.HEALTHCARE),
            Map.entry("healthcare",      SpendingCategory.HEALTHCARE)
    );

    // ── Merchant keyword → SpendingCategory mappings ─────────────────────────

    private static final Map<String, SpendingCategory> MERCHANT_KEYWORDS = Map.ofEntries(
            // Groceries
            Map.entry("whole foods",      SpendingCategory.GROCERIES),
            Map.entry("trader joe",       SpendingCategory.GROCERIES),
            Map.entry("kroger",           SpendingCategory.GROCERIES),
            Map.entry("safeway",          SpendingCategory.GROCERIES),
            Map.entry("wegmans",          SpendingCategory.GROCERIES),
            Map.entry("publix",           SpendingCategory.GROCERIES),
            Map.entry("sprouts",          SpendingCategory.GROCERIES),
            Map.entry("aldi",             SpendingCategory.GROCERIES),
            Map.entry("costco",           SpendingCategory.GROCERIES),
            // Dining
            Map.entry("starbucks",        SpendingCategory.DINING),
            Map.entry("chipotle",         SpendingCategory.DINING),
            Map.entry("mcdonald",         SpendingCategory.DINING),
            Map.entry("doordash",         SpendingCategory.DINING),
            Map.entry("ubereats",         SpendingCategory.DINING),
            Map.entry("grubhub",          SpendingCategory.DINING),
            Map.entry("sweetgreen",       SpendingCategory.DINING),
            Map.entry("panera",           SpendingCategory.DINING),
            Map.entry("dunkin",           SpendingCategory.DINING),
            Map.entry("subway",           SpendingCategory.DINING),
            Map.entry("taco bell",        SpendingCategory.DINING),
            Map.entry("chick-fil-a",      SpendingCategory.DINING),
            Map.entry("pizza",            SpendingCategory.DINING),
            Map.entry("sushi",            SpendingCategory.DINING),
            // Subscriptions
            Map.entry("netflix",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("spotify",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("hulu",             SpendingCategory.SUBSCRIPTIONS),
            Map.entry("disney+",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("apple tv",         SpendingCategory.SUBSCRIPTIONS),
            Map.entry("amazon prime",     SpendingCategory.SUBSCRIPTIONS),
            Map.entry("hbo max",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("youtube premium",  SpendingCategory.SUBSCRIPTIONS),
            Map.entry("adobe",            SpendingCategory.SUBSCRIPTIONS),
            Map.entry("icloud",           SpendingCategory.SUBSCRIPTIONS),
            Map.entry("chatgpt",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("openai",           SpendingCategory.SUBSCRIPTIONS),
            Map.entry("linkedin premium", SpendingCategory.SUBSCRIPTIONS),
            Map.entry("dropbox",          SpendingCategory.SUBSCRIPTIONS),
            Map.entry("microsoft 365",    SpendingCategory.SUBSCRIPTIONS),
            Map.entry("google one",       SpendingCategory.SUBSCRIPTIONS),
            Map.entry("gym",              SpendingCategory.SUBSCRIPTIONS),
            Map.entry("planet fitness",   SpendingCategory.SUBSCRIPTIONS),
            Map.entry("equinox",          SpendingCategory.SUBSCRIPTIONS),
            // Utilities
            Map.entry("pg&e",             SpendingCategory.UTILITIES),
            Map.entry("con edison",       SpendingCategory.UTILITIES),
            Map.entry("electric",         SpendingCategory.UTILITIES),
            Map.entry("water",            SpendingCategory.UTILITIES),
            Map.entry("sewer",            SpendingCategory.UTILITIES),
            Map.entry("xfinity",          SpendingCategory.UTILITIES),
            Map.entry("comcast",          SpendingCategory.UTILITIES),
            Map.entry("verizon",          SpendingCategory.UTILITIES),
            Map.entry("at&t",             SpendingCategory.UTILITIES),
            Map.entry("t-mobile",         SpendingCategory.UTILITIES),
            // Transport
            Map.entry("uber",             SpendingCategory.TRANSPORT),
            Map.entry("lyft",             SpendingCategory.TRANSPORT),
            Map.entry("shell",            SpendingCategory.TRANSPORT),
            Map.entry("chevron",          SpendingCategory.TRANSPORT),
            Map.entry("bp gas",           SpendingCategory.TRANSPORT),
            Map.entry("metro",            SpendingCategory.TRANSPORT),
            Map.entry("bart",             SpendingCategory.TRANSPORT),
            Map.entry("mta",              SpendingCategory.TRANSPORT),
            // Shopping
            Map.entry("amazon",           SpendingCategory.SHOPPING),
            Map.entry("target",           SpendingCategory.SHOPPING),
            Map.entry("walmart",          SpendingCategory.SHOPPING),
            Map.entry("apple store",      SpendingCategory.SHOPPING),
            Map.entry("best buy",         SpendingCategory.SHOPPING),
            Map.entry("nike",             SpendingCategory.SHOPPING),
            Map.entry("h&m",              SpendingCategory.SHOPPING),
            Map.entry("zara",             SpendingCategory.SHOPPING),
            // Healthcare
            Map.entry("cvs",              SpendingCategory.HEALTHCARE),
            Map.entry("walgreens",        SpendingCategory.HEALTHCARE),
            Map.entry("medical",          SpendingCategory.HEALTHCARE),
            Map.entry("dental",           SpendingCategory.HEALTHCARE),
            Map.entry("hospital",         SpendingCategory.HEALTHCARE),
            // Entertainment
            Map.entry("amc",              SpendingCategory.ENTERTAINMENT),
            Map.entry("cinemark",         SpendingCategory.ENTERTAINMENT),
            Map.entry("ticketmaster",     SpendingCategory.ENTERTAINMENT),
            Map.entry("eventbrite",       SpendingCategory.ENTERTAINMENT),
            Map.entry("stubhub",          SpendingCategory.ENTERTAINMENT),
            // Income
            Map.entry("payroll",          SpendingCategory.INCOME),
            Map.entry("direct deposit",   SpendingCategory.INCOME),
            Map.entry("interest income",  SpendingCategory.INCOME),
            Map.entry("dividend",         SpendingCategory.INCOME),
            Map.entry("refund",           SpendingCategory.INCOME)
    );

    /**
     * Classifies a bank transaction into a {@link SpendingCategory}.
     *
     * @param merchantName   cleaned merchant/payee name (may be null)
     * @param rawName        raw Plaid transaction name (fallback)
     * @param plaidCategories Plaid's own category list (e.g. ["Food and Drink", "Restaurants"])
     * @return the best-fit SpendingCategory, never null
     */
    public SpendingCategory classify(String merchantName, String rawName,
                                     List<String> plaidCategories) {
        // 1. Check Plaid primary category
        if (plaidCategories != null && !plaidCategories.isEmpty()) {
            String primary = plaidCategories.get(0).toLowerCase(Locale.ROOT);
            SpendingCategory fromPrimary = PLAID_PRIMARY.get(primary);
            if (fromPrimary != null) return fromPrimary;

            // 2. Substring match against all Plaid categories
            for (String cat : plaidCategories) {
                String lower = cat.toLowerCase(Locale.ROOT);
                for (Map.Entry<String, SpendingCategory> entry : PLAID_SUBSTRING.entrySet()) {
                    if (lower.contains(entry.getKey())) return entry.getValue();
                }
            }
        }

        // 3. Merchant keyword match
        String display = merchantName != null ? merchantName : rawName;
        if (display != null) {
            String lower = display.toLowerCase(Locale.ROOT);
            for (Map.Entry<String, SpendingCategory> entry : MERCHANT_KEYWORDS.entrySet()) {
                if (lower.contains(entry.getKey())) return entry.getValue();
            }
        }

        return SpendingCategory.OTHER;
    }
}
