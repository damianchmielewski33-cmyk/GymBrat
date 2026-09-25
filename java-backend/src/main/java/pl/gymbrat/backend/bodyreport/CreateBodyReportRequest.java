package pl.gymbrat.backend.bodyreport;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CreateBodyReportRequest(
        Double weightKg,
        Double waistCm,
        Double chestCm,
        Double thighCm,
        Double armCm,
        Double abdomenCm,
        @Min(1) @Max(10) Integer trainingEnergy,
        @Min(1) @Max(10) Integer sleepQuality,
        @Min(1) @Max(10) Integer dayEnergy,
        @Min(1) @Max(10) Integer digestionScore,
        @Size(max = 16) String cardioCompliance,
        @Size(max = 16) String dietCompliance,
        @Size(max = 16) String trainingCompliance,
        @Size(max = 20_000) String complianceNotes,
        @Size(max = 20_000) String additionalInfo,
        @Size(max = 8) List<@Size(max = 200_000) String> photoDataUrls
) {}
