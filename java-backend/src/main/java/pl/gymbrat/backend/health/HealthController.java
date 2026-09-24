package pl.gymbrat.backend.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    @GetMapping({"/", "/api/health"})
    public Map<String, Object> health() {
        return Map.of(
                "app", "gymbrat-android-backend",
                "status", "ok",
                "language", "java"
        );
    }
}
