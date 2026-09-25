package pl.gymbrat.backend.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {
    private final String appVersion;

    public HealthController(@Value("${gymbrat.app-version}") String appVersion) {
        this.appVersion = appVersion;
    }

    @GetMapping({"/", "/api/health"})
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("app", "gymbrat-backend");
        body.put("status", "ok");
        body.put("language", "java");
        body.put("version", appVersion);
        return body;
    }
}
