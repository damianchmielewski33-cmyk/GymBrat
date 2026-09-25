package pl.gymbrat.backend.workout;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.gymbrat.backend.security.UserContext;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/workouts")
public class WorkoutController {
    private final WorkoutService workoutService;

    public WorkoutController(WorkoutService workoutService) {
        this.workoutService = workoutService;
    }

    @PostMapping("/complete")
    public Map<String, Object> complete(
            HttpServletRequest request,
            @Valid @RequestBody CompleteWorkoutRequest payload
    ) {
        String userId = UserContext.requireUserId(request);
        WorkoutService.StoredWorkout saved = workoutService.complete(userId, payload);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("id", saved.id());
        body.put("date", saved.date());
        return body;
    }
}
