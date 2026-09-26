package pl.gymbrat.backend.bodyreport;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.gymbrat.backend.security.UserContext;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/body-reports")
public class BodyReportController {
    private final BodyReportStore store;

    public BodyReportController(BodyReportStore store) {
        this.store = store;
    }

    @GetMapping
    public Map<String, Object> list(HttpServletRequest request) {
        String userId = UserContext.requireUserId(request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("reports", store.listForUser(userId));
        return body;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest request,
            @Valid @RequestBody CreateBodyReportRequest payload
    ) {
        String userId = UserContext.requireUserId(request);
        BodyReportDto created = store.create(userId, payload);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("id", created.id());
        return ResponseEntity.ok(body);
    }
}
