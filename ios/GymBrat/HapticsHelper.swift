import UIKit

enum HapticsHelper {
    static func vibrate(patternCsv: String) {
        // CSV ms jak navigator.vibrate — uproszczenie: krótki / dłuższy impuls.
        let parts = patternCsv.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        let duration = parts.first ?? 20
        let style: UIImpactFeedbackGenerator.FeedbackStyle = duration >= 40 ? .medium : .light
        let gen = UIImpactFeedbackGenerator(style: style)
        gen.prepare()
        gen.impactOccurred()
    }
}
