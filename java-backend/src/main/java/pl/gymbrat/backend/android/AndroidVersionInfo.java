package pl.gymbrat.backend.android;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AndroidVersionInfo(
        int versionCode,
        String versionName,
        String apkUrl,
        String releasedAt,
        String commit,
        String notes,
        String downloadPath
) {
    public AndroidVersionInfo withDownloadPath(String path) {
        return new AndroidVersionInfo(
                versionCode,
                versionName,
                apkUrl,
                releasedAt,
                commit,
                notes,
                path
        );
    }
}
