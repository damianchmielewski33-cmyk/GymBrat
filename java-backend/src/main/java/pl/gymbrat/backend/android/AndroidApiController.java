package pl.gymbrat.backend.android;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/android")
@CrossOrigin(origins = "*")
public class AndroidApiController {
    private final AndroidVersionService versionService;

    public AndroidApiController(AndroidVersionService versionService) {
        this.versionService = versionService;
    }

    @GetMapping("/version")
    public ResponseEntity<AndroidVersionInfo> version() {
        AndroidVersionInfo info = versionService.current()
                .withDownloadPath("/api/android/download?source=in-app-update");
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=60")
                .body(info);
    }

    @GetMapping("/download")
    public ResponseEntity<Void> download() {
        AndroidVersionInfo info = versionService.current();
        return ResponseEntity.status(302)
                .location(URI.create(info.apkUrl()))
                .build();
    }
}
