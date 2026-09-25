package pl.gymbrat.backend.version;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Publiczny kontrakt wersji GymBrat (Java). Front Next może dołączyć changelog z TypeScript.
 */
@RestController
public class VersionController {
    private final String sourceRepo;
    private final String appVersion;
    private final String gitSha;

    public VersionController(
            @Value("${gymbrat.source-repo}") String sourceRepo,
            @Value("${gymbrat.app-version}") String appVersion,
            @Value("${gymbrat.git-sha:}") String gitSha
    ) {
        this.sourceRepo = sourceRepo;
        this.appVersion = appVersion;
        this.gitSha = gitSha == null ? "" : gitSha.trim();
    }

    @GetMapping("/api/version")
    public ResponseEntity<Map<String, Object>> version() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("app", "GymBrat");
        body.put("sourceRepo", sourceRepo);
        body.put("backend", Map.of(
                "language", "java",
                "framework", "spring-boot",
                "version", appVersion
        ));
        if (!gitSha.isEmpty()) {
            body.put("gitSha", gitSha);
        }
        body.put("changelog", List.of());
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, no-store")
                .body(body);
    }
}
