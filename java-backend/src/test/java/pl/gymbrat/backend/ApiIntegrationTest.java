package pl.gymbrat.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pl.gymbrat.backend.security.UserContextFilter;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
    @Autowired
    MockMvc mockMvc;

    @Test
    void versionReturnsJavaBackendMeta() throws Exception {
        mockMvc.perform(get("/api/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app").value("GymBrat"))
                .andExpect(jsonPath("$.sourceRepo").value(containsString("GymBrat")))
                .andExpect(jsonPath("$.backend.language").value("java"));
    }

    @Test
    void androidVersionReturnsJson() throws Exception {
        mockMvc.perform(get("/api/android/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionCode").value(4))
                .andExpect(jsonPath("$.versionName").value("0.1.3"))
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
                .andExpect(jsonPath("$.app").value("gymbrat-backend"))
                .andExpect(jsonPath("$.language").value("java"));
    }

    @Test
    void bodyReportsRequireUserHeader() throws Exception {
        mockMvc.perform(get("/api/body-reports"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.ok").value(false));
    }

    @Test
    void bodyReportsCreateAndList() throws Exception {
        mockMvc.perform(post("/api/body-reports")
                        .header(UserContextFilter.USER_ID_HEADER, "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weightKg\":80.5,\"waistCm\":90}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.id").isString());

        mockMvc.perform(get("/api/body-reports")
                        .header(UserContextFilter.USER_ID_HEADER, "user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.reports[0].weightKg").value(80.5));
    }

    @Test
    void workoutsComplete() throws Exception {
        mockMvc.perform(post("/api/workouts/complete")
                        .header(UserContextFilter.USER_ID_HEADER, "user-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Push\",\"cardioMinutes\":10,\"exercises\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.date").isString());
    }
}
