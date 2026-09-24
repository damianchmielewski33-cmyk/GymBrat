package pl.gymbrat.backend.android;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AndroidApiControllerTest {
    @Autowired
    MockMvc mockMvc;

    @Test
    void versionReturnsJson() throws Exception {
        mockMvc.perform(get("/api/android/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionCode").value(1))
                .andExpect(jsonPath("$.versionName").value("0.1.0"))
                .andExpect(jsonPath("$.apkUrl").value(containsString("gymbrat.apk")))
                .andExpect(jsonPath("$.downloadPath").value("/api/android/download?source=in-app-update"));
    }

    @Test
    void downloadRedirects() throws Exception {
        mockMvc.perform(get("/api/android/download"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("gymbrat.apk")));
    }

    @Test
    void healthOk() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app").value("gymbrat-android-backend"))
                .andExpect(jsonPath("$.language").value("java"));
    }
}
