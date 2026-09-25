package pl.gymbrat.backend.bodyreport;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record BodyReportDto(
        String id,
        String createdAt,
        Double weightKg,
        Double waistCm,
        Double chestCm,
        Double thighCm,
        Double armCm,
        Double abdomenCm,
        Integer trainingEnergy,
        Integer sleepQuality,
        Integer dayEnergy,
        Integer digestionScore,
        String cardioCompliance,
        String dietCompliance,
        String trainingCompliance,
        String complianceNotes,
        String additionalInfo,
        List<PhotoDto> photos
) {
    public record PhotoDto(String id, String dataUrl) {}
}
