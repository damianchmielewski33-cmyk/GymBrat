package pl.gymbrat.backend.android;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.Instant;
import java.util.Optional;

@Service
public class AndroidVersionService {
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final String apkUrl;
    private final String versionJsonClasspath;
    private final Optional<Integer> overrideCode;
    private final Optional<String> overrideName;
    private final Optional<String> overrideNotes;

    public AndroidVersionService(
            ObjectMapper objectMapper,
            ResourceLoader resourceLoader,
            @Value("${gymbrat.android.apk-url}") String apkUrl,
            @Value("${gymbrat.android.version-json:classpath:android-version.json}") String versionJsonClasspath,
            @Value("${gymbrat.android.version-code:0}") int overrideCode,
            @Value("${gymbrat.android.version-name:}") String overrideName,
            @Value("${gymbrat.android.notes:}") String overrideNotes
    ) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
        this.apkUrl = apkUrl;
        this.versionJsonClasspath = versionJsonClasspath;
        this.overrideCode = overrideCode > 0 ? Optional.of(overrideCode) : Optional.empty();
        this.overrideName = overrideName == null || overrideName.isBlank()
                ? Optional.empty()
                : Optional.of(overrideName.trim());
        this.overrideNotes = overrideNotes == null || overrideNotes.isBlank()
                ? Optional.empty()
                : Optional.of(overrideNotes.trim());
    }

    public AndroidVersionInfo current() {
        AndroidVersionInfo fromFile = readBundled().orElseGet(this::fallback);
        int code = overrideCode.orElse(fromFile.versionCode());
        String name = overrideName.orElse(fromFile.versionName());
        String notes = overrideNotes.orElse(fromFile.notes());
        String url = (fromFile.apkUrl() == null || fromFile.apkUrl().isBlank()) ? apkUrl : fromFile.apkUrl();
        if (apkUrl != null && !apkUrl.isBlank()) {
            url = apkUrl;
        }
        return new AndroidVersionInfo(
                code,
                name,
                url,
                fromFile.releasedAt() != null ? fromFile.releasedAt() : Instant.now().toString(),
                fromFile.commit(),
                notes,
                null
        );
    }

    private Optional<AndroidVersionInfo> readBundled() {
        try {
            Resource resource = resourceLoader.getResource(versionJsonClasspath);
            if (!resource.exists()) return Optional.empty();
            try (InputStream in = resource.getInputStream()) {
                JsonNode node = objectMapper.readTree(in);
                int code = node.path("versionCode").asInt(0);
                String name = node.path("versionName").asText(null);
                if (code <= 0 || name == null || name.isBlank()) return Optional.empty();
                return Optional.of(new AndroidVersionInfo(
                        code,
                        name,
                        node.path("apkUrl").asText(apkUrl),
                        node.hasNonNull("releasedAt") ? node.get("releasedAt").asText() : null,
                        node.hasNonNull("commit") ? node.get("commit").asText() : null,
                        node.hasNonNull("notes") ? node.get("notes").asText() : null,
                        null
                ));
            }
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private AndroidVersionInfo fallback() {
        return new AndroidVersionInfo(
                1,
                "0.1.0",
                apkUrl,
                Instant.now().toString(),
                null,
                "Wbudowana informacja o wersji GymBrat Android.",
                null
        );
    }
}
