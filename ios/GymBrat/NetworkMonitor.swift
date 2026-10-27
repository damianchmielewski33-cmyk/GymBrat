import Foundation
import Network

/// Monitor połączenia — natywny ekran offline (wymaganie jakości pod App Store).
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "pl.gymbrat.network")
    private(set) var isOnline = true

    var onChange: ((Bool) -> Void)?

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            DispatchQueue.main.async {
                guard let self else { return }
                self.isOnline = online
                self.onChange?(online)
            }
        }
        monitor.start(queue: queue)
    }
}
