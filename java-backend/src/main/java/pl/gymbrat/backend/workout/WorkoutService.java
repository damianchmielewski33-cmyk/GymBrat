package pl.gymbrat.backend.workout;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class WorkoutService {
    private final ObjectMapper objectMapper;
    private final Map<String, List<StoredWorkout>> byUser = new ConcurrentHashMap<>();

    public WorkoutService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public StoredWorkout complete(String userId, CompleteWorkoutRequest req) {
        String date = LocalDate.now(ZoneOffset.UTC).toString();
        int cardio = req.cardioMinutes() == null
                ? 0
                : Math.max(0, (int) Math.round(req.cardioMinutes()));
        List<CompleteWorkoutRequest.ExercisePayload> exercises =
                req.exercises() == null ? List.of() : req.exercises();
        String exercisesJson;
        try {
            exercisesJson = objectMapper.writeValueAsString(exercises);
        } catch (JsonProcessingException e) {
            exercisesJson = "[]";
        }
        String title = req.title() == null || req.title().isBlank() ? "Trening" : req.title().trim();
        StoredWorkout workout = new StoredWorkout(
                UUID.randomUUID().toString(),
                userId,
                req.workoutPlanId(),
                date,
                cardio,
                exercisesJson,
                title,
                req.startedAt(),
                req.endedAt()
        );
        byUser.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(0, workout);
        return workout;
    }

    public record StoredWorkout(
            String id,
            String userId,
            String workoutPlanId,
            String date,
            int cardioMinutes,
            String exercisesJson,
            String title,
            Double startedAt,
            Double endedAt
    ) {}
}
