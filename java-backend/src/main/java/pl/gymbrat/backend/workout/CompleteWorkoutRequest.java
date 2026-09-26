package pl.gymbrat.backend.workout;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CompleteWorkoutRequest(
        @Size(max = 200) String title,
        Double startedAt,
        Double endedAt,
        @Min(0) @Max(24 * 60) Double cardioMinutes,
        @Size(max = 128) String workoutPlanId,
        @Size(max = 200) List<ExercisePayload> exercises
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ExercisePayload(
            @Size(max = 128) String id,
            @Size(max = 500) String name,
            @Size(max = 4000) String note,
            @Size(max = 200) List<SetPayload> sets
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SetPayload(
            Integer reps,
            Double weight,
            Boolean done,
            Double rpe
    ) {}
}
