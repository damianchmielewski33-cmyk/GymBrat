package pl.gymbrat.backend.bodyreport;

import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public class BodyReportStore {
    private final Map<String, List<BodyReportDto>> byUser = new ConcurrentHashMap<>();

    public List<BodyReportDto> listForUser(String userId) {
        return byUser.getOrDefault(userId, List.of()).stream()
                .sorted(Comparator
                        .comparing(BodyReportDto::createdAt, Comparator.reverseOrder())
                        .thenComparing(BodyReportDto::id, Comparator.reverseOrder()))
                .limit(50)
                .toList();
    }

    public BodyReportDto create(String userId, CreateBodyReportRequest req) {
        List<BodyReportDto.PhotoDto> photos = new ArrayList<>();
        if (req.photoDataUrls() != null) {
            for (String dataUrl : req.photoDataUrls()) {
                if (dataUrl == null || dataUrl.isBlank()) continue;
                photos.add(new BodyReportDto.PhotoDto(UUID.randomUUID().toString(), dataUrl));
            }
        }
        BodyReportDto report = new BodyReportDto(
                UUID.randomUUID().toString(),
                Instant.now().toString(),
                req.weightKg(),
                req.waistCm(),
                req.chestCm(),
                req.thighCm(),
                req.armCm(),
                req.abdomenCm(),
                req.trainingEnergy(),
                req.sleepQuality(),
                req.dayEnergy(),
                req.digestionScore(),
                req.cardioCompliance(),
                req.dietCompliance(),
                req.trainingCompliance(),
                req.complianceNotes(),
                req.additionalInfo(),
                List.copyOf(photos)
        );
        byUser.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(0, report);
        return report;
    }
}
