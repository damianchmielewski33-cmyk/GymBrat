import UIKit

/// Natywny stan braku sieci / błędu ładowania — nie sam pusty WebView.
final class OfflineErrorView: UIView {
    var onRetry: (() -> Void)?

    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Theme.background
        isHidden = true
        accessibilityViewIsModal = true

        titleLabel.text = "Brak połączenia"
        titleLabel.font = UIFont.systemFont(ofSize: 22, weight: .bold)
        titleLabel.textColor = Theme.textPrimary
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        bodyLabel.text = "Sprawdź internet i spróbuj ponownie. GymBrat potrzebuje sieci, żeby wczytać dziennik treningowy."
        bodyLabel.font = UIFont.systemFont(ofSize: 15, weight: .regular)
        bodyLabel.textColor = Theme.textSecondary
        bodyLabel.textAlignment = .center
        bodyLabel.numberOfLines = 0
        bodyLabel.translatesAutoresizingMaskIntoConstraints = false

        var config = UIButton.Configuration.filled()
        config.title = "Spróbuj ponownie"
        config.baseBackgroundColor = Theme.gold
        config.baseForegroundColor = Theme.background
        config.cornerStyle = .medium
        config.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 22, bottom: 14, trailing: 22)
        retryButton.configuration = config
        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        retryButton.accessibilityLabel = "Spróbuj ponownie wczytać GymBrat"

        addSubview(titleLabel)
        addSubview(bodyLabel)
        addSubview(retryButton)

        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -40),
            bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            bodyLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            bodyLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            retryButton.topAnchor.constraint(equalTo: bodyLabel.bottomAnchor, constant: 24),
            retryButton.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func show(title: String, message: String) {
        titleLabel.text = title
        bodyLabel.text = message
        isHidden = false
        alpha = 1
    }

    func hide() {
        isHidden = true
    }

    @objc private func retryTapped() {
        onRetry?()
    }
}
